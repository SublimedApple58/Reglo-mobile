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
