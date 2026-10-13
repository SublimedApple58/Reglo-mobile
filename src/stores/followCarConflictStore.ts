import type { BookingBatchCheckEntry } from '../types/regloApi';

/**
 * Drives the «Auto al seguito occupata» sheet (REG-608 / T7).
 *
 * Con una sola auto al seguito per tutte le date della prenotazione multipla,
 * bastava che fosse occupata una volta per far fallire tutto, con un messaggio
 * che non diceva nemmeno quale auto fosse. Qui `BookingForm` pubblica l'esito
 * della prova a vuoto e riceve indietro le date da creare: **il punto e'
 * trovare un'altra auto, non un'altra data**.
 */

/** L'auto sostitutiva scelta: un id, `null` per "senza auto al seguito", `'remove'` per togliere la guida. */
export type ConflictChoice = string | null | 'remove';

/** Una data del batch pronta per il backend. `followVehicleId` assente = eredita l'auto condivisa. */
export type ConflictResolvedEntry = {
  startsAt: string;
  endsAt: string;
  followVehicleId?: string | null;
};

export type FollowCarConflictData = {
  entries: BookingBatchCheckEntry[];
  freeCount: number;
  conflictCount: number;
  /** Un'auto libera in TUTTE le date in conflitto (scorciatoia "Applica a tutte"). */
  suggestedForAll: { id: string; name: string } | null;
  /** Chiamata alla conferma: la sheet si e' gia' chiusa, la prenotazione la fa il form. */
  onConfirm: (entries: ConflictResolvedEntry[]) => void;
};

let _data: FollowCarConflictData | null = null;
const _listeners = new Set<() => void>();

/**
 * Oltre questo numero di date in conflitto il contenuto supera lo schermo: un
 * `formSheet` con `fitToContents` non sa misurare una `ScrollView`, quindi si
 * passa al page sheet nativo che scrolla il proprio corpo (stessa regola di
 * `optionsPickerPath`). Mai una scatola che scorre dentro un foglio fermo.
 */
export const FOLLOW_CAR_CONFLICT_HUG_MAX = 3;

export const followCarConflictPath = () =>
  (_data?.conflictCount ?? 0) > FOLLOW_CAR_CONFLICT_HUG_MAX
    ? ('/(tabs)/home/follow-car-conflict-long' as const)
    : ('/(tabs)/home/follow-car-conflict' as const);

export const followCarConflictStore = {
  set(data: FollowCarConflictData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): FollowCarConflictData | null {
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
