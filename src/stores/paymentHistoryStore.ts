import type { PaymentHistoryEvent } from '../types/regloApi';

/**
 * Seed del foglio "Guida" di Pagamenti (REG-637, rifatto REG-639): dettaglio
 * di una guida con stato, storico pagamento e l'azione per cambiarlo.
 *
 * Stesso pattern seed degli altri fogli nativi: la schermata Pagamenti ha già
 * lo storico in mano (arriva con la lista guide), quindi il foglio apre pieno,
 * senza spinner e senza chiamate.
 */
export type PaymentHistoryData = {
  /** Es. «Mer 28 ottobre · 10:36». */
  lessonLabel: string;
  /** Es. «Guida · Tiziano 1». */
  lessonSubtitle?: string | null;
  /** Stato a parole, come nella riga («Da pagare», «Pagata», «Annullata»…). */
  stateLabel: string;
  events: PaymentHistoryEvent[];
  /**
   * Cambio di stato (se chi guarda può farlo): etichetta della CTA e scrittura.
   * `run` risolve `true` se il BE ha confermato; il foglio allora si chiude.
   */
  action?: { label: string; run: () => Promise<boolean> } | null;
};

let _data: PaymentHistoryData | null = null;
const _listeners = new Set<() => void>();

export const paymentHistoryStore = {
  set(data: PaymentHistoryData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): PaymentHistoryData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
