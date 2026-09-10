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
 * Riepilogo del pagellino per lo storico guide: la media ha senso solo se le
 * voci condividono la scala; con scale miste si mostra il conteggio.
 * Gemello di `evaluationSummary` in reglo/lib/autoscuole/evaluation-sheet.ts.
 */
export const evaluationSummary = (
  rows: ReadonlyArray<{ score: number; scaleMax: number }> | null | undefined,
): { count: number; average: number | null; scaleMax: number | null } | null => {
  if (!rows?.length) return null;
  const scales = new Set(rows.map((r) => r.scaleMax));
  if (scales.size > 1) return { count: rows.length, average: null, scaleMax: null };
  const average = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
  return { count: rows.length, average, scaleMax: rows[0].scaleMax };
};

/** "4,2/5" all'italiana; null con scale miste. */
export const formatEvaluationAverage = (
  summary: { average: number | null; scaleMax: number | null } | null,
): string | null =>
  summary && summary.average != null && summary.scaleMax != null
    ? `${summary.average.toFixed(1).replace('.', ',')}/${summary.scaleMax}`
    : null;
