/**
 * Drives the native `home/add-action` formSheet — the instructor's "+" menu.
 * The parent (IstruttoreHomeScreen) seeds which actions are available and owns
 * the handlers; the route renders the rows and calls back. Mirrors the
 * seed-and-callback pattern of `quickBookStore`.
 */
export type HomeAddSheetData = {
  /** Whether the "Prenota guida" action is available for this instructor. */
  canBook: boolean;
  onBook: () => void;
  onBlock: () => void;
  onExam: () => void;
  onSick: () => void;
};

let _data: HomeAddSheetData | null = null;
const _listeners = new Set<() => void>();

export const homeAddSheetStore = {
  set(data: HomeAddSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): HomeAddSheetData | null {
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
