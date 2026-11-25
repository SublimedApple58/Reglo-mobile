import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * REG-790 — la guida appena diventata dell'allievo, per il momento di
 * conferma: dal foglio «Orari» (prenotazione, `variant: 'booked'`) o dagli
 * Scambi (guida presa a un compagno, `variant: 'swap'`). Si scrive solo a
 * risposta del server arrivata (niente optimistic update).
 */
export type BookingConfirmation = {
  variant: 'booked' | 'swap';
  lesson: AutoscuolaAppointmentWithRelations;
  vehiclesEnabled: boolean;
  /** «Vedi la guida»: chi ha aperto il flusso sa come aprire il foglio della guida. */
  onOpenLesson?: (lesson: AutoscuolaAppointmentWithRelations) => void;
};

let _data: BookingConfirmation | null = null;
const _listeners = new Set<() => void>();

export const bookingConfirmedStore = {
  set(data: BookingConfirmation) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): BookingConfirmation | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
