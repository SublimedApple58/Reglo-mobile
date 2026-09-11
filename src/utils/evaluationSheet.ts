/**
 * Pagellino di valutazione (REG-443) — regole condivise col backend
 * (lib/autoscuole/evaluation-sheet.ts su reglo). Le voci le decide
 * l'autoscuola; qui serve solo sapere da quante stelline si parte.
 */

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
