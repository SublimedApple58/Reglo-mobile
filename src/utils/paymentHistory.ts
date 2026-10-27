import type { PaymentHistoryEvent, PaymentHistoryKind } from '../types/regloApi';

/**
 * REG-637 — "quando e da chi" sullo stato pagamento di una guida.
 *
 * Copia gemella di `reglo/components/pages/Autoscuole/LessonPaymentTrail.tsx`
 * (etichette e `lastEventMatchesState`): cambiarle insieme, o web e app
 * raccontano la stessa guida in due modi.
 */

export const PAYMENT_EVENT_LABEL: Record<PaymentHistoryKind, string> = {
  paid: 'Segnata pagata',
  unpaid: 'Segnata da pagare',
  cleared: 'Stato pagamento rimosso',
  credit_applied: 'Coperta da credito',
  credit_refunded: 'Credito restituito',
};

/**
 * Etichetta corta per la riga sotto la guida («Pagata · 9 ott, 19:30 · Mario
 * Rossi»): su telefono la riga è stretta e data e nome sono ciò che conta.
 * Lo storico (foglio) usa quella estesa.
 */
export const PAYMENT_EVENT_SHORT_LABEL: Record<PaymentHistoryKind, string> = {
  paid: 'Pagata',
  unpaid: 'Da pagare',
  cleared: 'Stato rimosso',
  credit_applied: 'A credito',
  credit_refunded: 'Credito restituito',
};

/** Micro-accento del punto davanti all'evento: l'unico colore della riga. */
export const PAYMENT_EVENT_DOT: Record<PaymentHistoryKind, string> = {
  paid: '#15803D',
  unpaid: '#C9A200',
  cleared: '#B4B4BD',
  credit_applied: '#7C3AED',
  credit_refunded: '#B4B4BD',
};

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** «27 ott» (+ anno se non è quello in corso) e «11:17», nell'ora del telefono. */
export const formatPaymentEventWhen = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { day, time };
};

/**
 * L'ultimo gesto racconta ancora lo stato attuale? Se dopo la guida è cambiata
 * da sola (annullo, penale) la riga mentirebbe: allora non la si mostra.
 */
export const lastEventMatchesState = (
  event: PaymentHistoryEvent,
  state: { manualPaymentStatus?: string | null; creditApplied?: boolean | null },
) => {
  const covered = !!state.creditApplied;
  switch (event.kind) {
    case 'paid':
      return state.manualPaymentStatus === 'paid' && !covered;
    case 'unpaid':
      return state.manualPaymentStatus === 'unpaid' && !covered;
    case 'cleared':
      return state.manualPaymentStatus == null && !covered;
    case 'credit_applied':
      return covered;
    case 'credit_refunded':
      return !covered;
  }
};
