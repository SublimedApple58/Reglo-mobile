/**
 * Seed dei due form sheet della «Panoramica istruttori» del titolare
 * (OwnerInstructorScreen, REG-639): `instructor-invite` e
 * `instructor-availability`, registrati sia nello stack `role/` (tab Istruttore
 * del titolare) sia in `more/` (INSTRUCTOR_OWNER, da «Tu»).
 *
 * Il chiamante pubblica il contesto + le callback, poi pusha la route.
 */
export type InviteSheetData = {
  /** Invito andato a buon fine: il chiamante mostra il suo avviso. */
  onSent: () => void;
};

export type AvailabilitySheetData = {
  instructorId: string;
  /** Nome per esteso: il foglio usa il primo nome nel titolo. */
  instructorName: string;
  /** settings.availabilityWeeks dell'autoscuola (default 4). */
  availabilityWeeks: number;
};

type Data = { invite: InviteSheetData | null; availability: AvailabilitySheetData | null };

let _data: Data = { invite: null, availability: null };
const _listeners = new Set<() => void>();
const emit = () => _listeners.forEach((fn) => fn());

export const ownerInstructorSheetStore = {
  setInvite(invite: InviteSheetData) {
    _data = { ..._data, invite };
    emit();
  },
  setAvailability(availability: AvailabilitySheetData) {
    _data = { ..._data, availability };
    emit();
  },
  getInvite(): InviteSheetData | null {
    return _data.invite;
  },
  getAvailability(): AvailabilitySheetData | null {
    return _data.availability;
  },
  clearInvite() {
    _data = { ..._data, invite: null };
    emit();
  },
  clearAvailability() {
    _data = { ..._data, availability: null };
    emit();
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
