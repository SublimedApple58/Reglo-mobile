/**
 * Drives the `home/manage-lesson-correct` form sheet — la correzione dell'esito
 * di una guida passata (Segna Presente / Segna Assente). Il chiamante
 * (IstruttoreHomeScreen via manage-lesson) pubblica l'esito attuale + la callback
 * che applica lo stato, poi pusha la route.
 */
export type CorrectOutcomeData = {
  /** Esito corrente, per marcare "attuale" sull'opzione giusta. */
  currentOutcome: 'checked_in' | 'no_show' | null;
  /** Applica il nuovo esito (correzione). */
  onPick: (action: 'checked_in' | 'no_show') => void;
};

let _data: CorrectOutcomeData | null = null;
const _listeners = new Set<() => void>();

export const correctOutcomeStore = {
  set(data: CorrectOutcomeData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): CorrectOutcomeData | null {
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
