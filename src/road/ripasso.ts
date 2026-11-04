import type { RoadMarker } from '../types/regloApi';

/**
 * REG-715 — ripasso con l'allievo a fine guida.
 *
 * Ordine (approvato da Tiziano 04/11): prima «da migliorare», poi le neutre
 * (segnalazioni senza segno), poi «fatto bene»; dentro ogni gruppo in ordine
 * di tempo. L'ordine si fissa all'apertura per `clientId`: una correzione
 * (cambio di segno) non fa saltare le schede, un'eliminazione le accorcia.
 */
export function ripassoOrder(markers: RoadMarker[]): string[] {
  const rank = (m: RoadMarker) => (m.sentiment === 'bad' ? 0 : m.sentiment === 'good' ? 2 : 1);
  const t = (m: RoadMarker) => Date.parse(m.recordedAt) || 0;
  return [...markers].sort((a, b) => rank(a) - rank(b) || t(a) - t(b)).map((m) => m.clientId || m.id);
}

/**
 * «Compila il pagellino» dall'ultima scheda: il ripasso si chiude e il
 * pagellino si apre dal riepilogo (stesso foglio e stesso salvataggio di oggi).
 */
let wantsPagellino = false;
export const ripassoHandoff = {
  requestPagellino() {
    wantsPagellino = true;
  },
  take() {
    const v = wantsPagellino;
    wantsPagellino = false;
    return v;
  },
};
