import type { RoadDetail } from '../types/regloApi';

/** Seed della mappa a tutto schermo del percorso (dettaglio guida allievo). */
let data: RoadDetail | null = null;
/**
 * REG-694: il foglio «Percorso Road» si apre al tocco, prima dei dati. Finché
 * `pending` c'è, il foglio mostra lo scheletro, l'errore con «Riprova» o il vuoto;
 * `set(detail)` lo chiude. La mappa grande legge sempre `data`.
 */
export type RoadPercorsoPending = {
  appointmentId: string;
  /** `empty` = la guida non ha un percorso registrato (risposta vera, non un errore). */
  status: 'loading' | 'error' | 'empty';
  /** Orario già noto a chi apre: il titolo c'è da subito e non cambia all'arrivo. */
  hint: { startedAt: string; endedAt?: string | null } | null;
};
let pending: RoadPercorsoPending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const roadRouteMapStore = {
  set(next: RoadDetail | null) {
    data = next;
    pending = null;
    emit();
  },
  get: () => data,
  setPending(next: RoadPercorsoPending | null) {
    pending = next;
    emit();
  },
  pending: () => pending,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
