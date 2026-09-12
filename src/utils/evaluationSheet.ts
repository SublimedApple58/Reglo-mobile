/**
 * Pagellino di valutazione (REG-443) — regole condivise col backend
 * (lib/autoscuole/evaluation-sheet.ts su reglo). Le voci le decide
 * l'autoscuola; qui serve solo sapere da quante stelline si parte.
 */

/* ── Configurazione delle voci (Altro → Pagellino) ───────────────────────── */

/** Stelline ammesse per una voce. Gemello di `EVALUATION_SCALES` sul web. */
export const EVALUATION_SCALES = [3, 5] as const;
export type EvaluationScale = (typeof EVALUATION_SCALES)[number];

export const DEFAULT_EVALUATION_SCALE: EvaluationScale = 5;

/** Tetto di voci per autoscuola: oltre, il pagellino non si compila più
 *  "in pochi secondi" (che è il punto della feature). Validato anche dal BE. */
export const MAX_EVALUATION_ITEMS = 12;

export const MAX_EVALUATION_LABEL_LENGTH = 60;

/** Modello base proposto a chi non ha mai configurato il pagellino. */
export const BASE_EVALUATION_TEMPLATE: ReadonlyArray<{
  label: string;
  scaleMax: EvaluationScale;
}> = [
  { label: 'Sicurezza e precedenze', scaleMax: 5 },
  { label: 'Controllo del veicolo', scaleMax: 5 },
  { label: 'Manovre e parcheggio', scaleMax: 5 },
  { label: 'Osservazione e specchietti', scaleMax: 5 },
  { label: 'Comportamento in strada', scaleMax: 5 },
];

export const asEvaluationScale = (value: unknown): EvaluationScale =>
  EVALUATION_SCALES.includes(value as EvaluationScale)
    ? (value as EvaluationScale)
    : DEFAULT_EVALUATION_SCALE;

/** Punteggio di partenza: metà scala arrotondata per eccesso (3 su 5, 2 su 3). */
export const defaultEvaluationScore = (scaleMax: number): number =>
  Math.max(1, Math.ceil((Number.isFinite(scaleMax) ? scaleMax : 5) / 2));

/** Stelline più grandi sulle scale corte: il pollice ha più spazio. */
export const starSizeForScale = (scaleMax: number): number => (scaleMax <= 3 ? 30 : 26);

/**
 * Riga di pagellino: `score` è null quando la voce è "non valutabile" su
 * quella guida. `notApplicable` manca sulle righe salvate prima della feature.
 */
export type EvaluationRowLike = {
  score: number | null;
  scaleMax: number;
  notApplicable?: boolean;
};

export type EvaluationSummary = {
  /** Voci effettivamente valutate: le escluse non contano. */
  count: number;
  average: number | null;
  scaleMax: number | null;
  skipped: number;
};

/**
 * Riepilogo del pagellino per lo storico guide: la media ha senso solo se le
 * voci condividono la scala; con scale miste si mostra il conteggio. Le voci
 * "non valutabili" restano fuori da media e conteggio.
 * Gemello di `evaluationSummary` in reglo/lib/autoscuole/evaluation-sheet.ts.
 */
export const evaluationSummary = (
  rows: ReadonlyArray<EvaluationRowLike> | null | undefined,
): EvaluationSummary | null => {
  if (!rows?.length) return null;
  const scored = rows.filter(
    (r): r is EvaluationRowLike & { score: number } => !r.notApplicable && r.score != null,
  );
  const skipped = rows.length - scored.length;
  if (!scored.length) return { count: 0, average: null, scaleMax: null, skipped };
  const scales = new Set(scored.map((r) => r.scaleMax));
  if (scales.size > 1) return { count: scored.length, average: null, scaleMax: null, skipped };
  const average = scored.reduce((sum, r) => sum + r.score, 0) / scored.length;
  return { count: scored.length, average, scaleMax: scored[0].scaleMax, skipped };
};

/** "4,2/5" all'italiana; null con scale miste o senza nessun voto. */
export const formatEvaluationAverage = (
  summary: { average: number | null; scaleMax: number | null } | null,
): string | null =>
  summary && summary.average != null && summary.scaleMax != null
    ? `${summary.average.toFixed(1).replace('.', ',')}/${summary.scaleMax}`
    : null;

/**
 * Etichetta della chip "Pagellino": media, conteggio (scale miste) o
 * "non applicabile" quando tutte le voci sono escluse. Gemello del web.
 */
export const evaluationSummaryLabel = (summary: EvaluationSummary | null): string | null => {
  if (!summary) return null;
  if (!summary.count) return 'non applicabile';
  return formatEvaluationAverage(summary) ?? `${summary.count} voci`;
};

/** Testo della singola voce esclusa, identico su web e app. */
export const EVALUATION_NOT_APPLICABLE_LABEL = 'non valutabile';

/* ── Media del pagellino su tutto lo storico di un allievo ───────────────── */

export type StudentEvaluationAverage = {
  itemId: string;
  label: string;
  scaleMax: number;
  /** Media dei voti dati su questa voce. */
  average: number;
  /** Quante guide hanno un voto su questa voce. */
  count: number;
};

export type StudentEvaluationAggregate = {
  items: StudentEvaluationAverage[];
  /** Guide con almeno un voto (le annullate non contano). */
  lessonCount: number;
  /** Media di tutti i voti; null con scale miste. */
  average: number | null;
  scaleMax: number | null;
  /** Voce con la media più bassa in proporzione alla sua scala. */
  weakest: StudentEvaluationAverage | null;
};

/**
 * Media per voce su tutte le guide di un allievo (scheda allievo).
 * Gemello di `aggregateStudentEvaluations` in reglo/lib/autoscuole/evaluation-sheet.ts
 * — con una differenza: l'app non conosce l'elenco delle voci configurate
 * dall'autoscuola, quindi l'ordine si ricava dalla PRIMA guida in cui ciascuna
 * voce compare (le guide arrivano dalla più recente) e manca il conteggio delle
 * voci mai valutate, che sul web viene dalla configurazione.
 *
 * Fuori dal calcolo: guide annullate, voci "non valutabili" e voci senza voto.
 */
export const aggregateStudentEvaluations = (
  lessons: ReadonlyArray<{
    cancelledAt?: string | null;
    evaluations?: ReadonlyArray<EvaluationRowLike & { itemId: string; label: string }> | null;
  }> | null | undefined,
): StudentEvaluationAggregate | null => {
  if (!lessons?.length) return null;
  const acc = new Map<string, { label: string; scaleMax: number; sum: number; count: number }>();
  let lessonCount = 0;

  for (const lesson of lessons) {
    if (lesson.cancelledAt) continue;
    let scoredHere = false;
    for (const row of lesson.evaluations ?? []) {
      if (row.notApplicable || row.score == null) continue;
      scoredHere = true;
      const prev = acc.get(row.itemId);
      if (prev) {
        prev.sum += row.score;
        prev.count += 1;
      } else {
        acc.set(row.itemId, { label: row.label, scaleMax: row.scaleMax, sum: row.score, count: 1 });
      }
    }
    if (scoredHere) lessonCount += 1;
  }

  if (!acc.size) return null;

  // L'ordine di inserimento nella Map È l'ordine di prima comparsa.
  const items: StudentEvaluationAverage[] = [...acc.entries()].map(([itemId, row]) => ({
    itemId,
    label: row.label,
    scaleMax: row.scaleMax,
    average: row.sum / row.count,
    count: row.count,
  }));

  const scales = new Set(items.map((i) => i.scaleMax));
  const totalScores = items.reduce((sum, i) => sum + i.count, 0);
  const average =
    scales.size === 1
      ? items.reduce((sum, i) => sum + i.average * i.count, 0) / totalScores
      : null;
  const weakest =
    items.length > 1
      ? items.reduce((min, i) => (i.average / i.scaleMax < min.average / min.scaleMax ? i : min))
      : null;

  return {
    items,
    lessonCount,
    average,
    scaleMax: scales.size === 1 ? items[0].scaleMax : null,
    weakest,
  };
};
