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

/** Tetto di voci per autoscuola. Era 12 (soglia di UX, non tecnica), alzato a
 *  40 il 2026-09-18. Validato anche dal BE: gemella di MAX_EVALUATION_ITEMS in
 *  `reglo/lib/autoscuole/evaluation-sheet.ts`, vanno tenute allineate. */
export const MAX_EVALUATION_ITEMS = 40;

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

/* ── Livello del pagellino: l'ultimo voto per voce (Road novembre R2) ────── */

export type StudentEvaluationLevel = {
  itemId: string;
  label: string;
  scaleMax: number;
  /** L'ultimo voto dato su questa voce. */
  score: number;
  /** Inizio della guida dell'ultimo voto. */
  lastAt: string | null;
};

export type StudentEvaluationLevels = {
  items: StudentEvaluationLevel[];
  /** Media dei livelli (una voce = un voto); null con scale miste. */
  average: number | null;
  scaleMax: number | null;
  /** Voce col livello più basso, in proporzione alla scala. */
  weakest: StudentEvaluationLevel | null;
};

/**
 * Road novembre R2 (Tiziano 10/11/2026) — il pagellino come LIVELLO del
 * ragazzo: per ogni voce l'ultimo voto dato, in qualunque guida. Sostituisce
 * la media nella scheda allievo e nella vista dell'allievo.
 * Gemello di `studentEvaluationLevels` in reglo/lib/autoscuole/evaluation-sheet.ts
 * (come per la media, l'app non conosce le voci mai valutate). Ordine: quello
 * di prima comparsa partendo dalla guida più recente.
 */
export const studentEvaluationLevels = (
  lessons: ReadonlyArray<{
    startsAt?: string | null;
    cancelledAt?: string | null;
    evaluations?: ReadonlyArray<EvaluationRowLike & { itemId: string; label: string }> | null;
  }> | null | undefined,
): StudentEvaluationLevels | null => {
  if (!lessons?.length) return null;
  const at = (d: string | null | undefined) => (d ? new Date(d).getTime() : 0);
  const sorted = [...lessons].sort((a, b) => at(b.startsAt) - at(a.startsAt));
  const acc = new Map<string, StudentEvaluationLevel>();
  for (const lesson of sorted) {
    if (lesson.cancelledAt) continue;
    for (const row of lesson.evaluations ?? []) {
      if (row.notApplicable || row.score == null || acc.has(row.itemId)) continue;
      acc.set(row.itemId, {
        itemId: row.itemId,
        label: row.label,
        scaleMax: row.scaleMax,
        score: Math.min(row.score, row.scaleMax),
        lastAt: lesson.startsAt ?? null,
      });
    }
  }
  if (!acc.size) return null;
  const items = [...acc.values()];
  const scales = new Set(items.map((i) => i.scaleMax));
  const average = scales.size === 1 ? items.reduce((s, i) => s + i.score, 0) / items.length : null;
  const weakest =
    items.length > 1 ? items.reduce((min, i) => (i.score / i.scaleMax < min.score / min.scaleMax ? i : min)) : null;
  return { items, average, scaleMax: scales.size === 1 ? items[0].scaleMax : null, weakest };
};

const LEVEL_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** «oggi», «ieri», «3 nov» (+ anno se non è quest'anno): data dell'ultimo voto. */
export const evaluationLevelDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'ieri';
  return `${d.getDate()} ${LEVEL_MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};
