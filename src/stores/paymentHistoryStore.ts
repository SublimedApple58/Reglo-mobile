import type { PaymentHistoryEvent } from '../types/regloApi';

/**
 * Seed del foglio "Storico pagamento" di una guida (REG-637).
 *
 * Stesso pattern seed degli altri fogli nativi: la schermata Pagamenti ha già
 * lo storico in mano (arriva con la lista guide), quindi il foglio apre pieno,
 * senza spinner e senza chiamate.
 */
export type PaymentHistoryData = {
  /** Es. «Mar 6 ottobre · 16:00». */
  lessonLabel: string;
  events: PaymentHistoryEvent[];
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
