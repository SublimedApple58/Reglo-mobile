/**
 * Seed del form sheet «Luoghi» dell'allievo (REG-705). Stesso pattern
 * seed-and-callback degli altri sheet nativi: la scheda allievo apre il foglio
 * con luoghi, scelta attuale e callback; il foglio salva sul backend e passa
 * alla scheda la risposta (niente optimistic update).
 */
export type StudentLocationsData = {
  studentName?: string | null;
  locations: { id: string; name: string; address: string | null; isPrecise: boolean }[];
  selectedIds: string[];
  primaryId: string | null;
  /** Salva sul backend e restituisce lo stato vero. Il foglio si chiude dopo. */
  onSave: (input: { locationIds: string[]; primaryId: string | null }) => Promise<void>;
};

let _data: StudentLocationsData | null = null;
const _listeners = new Set<() => void>();

export const studentLocationsStore = {
  set(data: StudentLocationsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): StudentLocationsData | null {
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
