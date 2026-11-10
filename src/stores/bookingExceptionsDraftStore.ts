/**
 * Prenotazione allievi «solo eccezioni»: guida il sotto-foglio
 * `notes/booking-exceptions` aperto da «Prenotazione guide» (gruppo autonomo).
 * Chi lo apre pubblica i casi attuali e la callback; il foglio modifica una
 * bozza locale e la restituisce con «Fatto». Il salvataggio vero lo fa il
 * foglio padre, in una sola chiamata.
 */
export type BookingExceptionCases = {
  slotFill: boolean;
  groupSeats: boolean;
  lastMinute: boolean;
  lastMinuteHours: number;
};

export type BookingExceptionsDraft = {
  /** Sottotitolo: per chi valgono (es. «Percorso auto»). */
  subtitle: string;
  value: BookingExceptionCases;
  onConfirm: (value: BookingExceptionCases) => void;
};

let _data: BookingExceptionsDraft | null = null;
const _listeners = new Set<() => void>();

export const bookingExceptionsDraftStore = {
  set(data: BookingExceptionsDraft) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): BookingExceptionsDraft | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
