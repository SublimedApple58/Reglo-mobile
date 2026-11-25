/**
 * REG-790 — «Vedi la guida» dalla conferma di uno scambio: la tab Guide apre
 * il foglio di quella guida appena l'ha nel suo elenco (con le sue azioni).
 */
let _id: string | null = null;
const _listeners = new Set<() => void>();

export const openLessonRequestStore = {
  set(id: string) {
    _id = id;
    _listeners.forEach((fn) => fn());
  },
  get(): string | null {
    return _id;
  },
  clear() {
    _id = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
