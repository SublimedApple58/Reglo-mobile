import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Android: i form sheet nativi stanno DENTRO la scena della tab, e la tab bar
 * (disegnata dopo, sopra le scene) copriva la loro parte bassa, CTA compresa
 * (su tablet «Continua» di «<Nome> su Road» non si poteva toccare). Su iOS il
 * foglio copre la tab bar da sé. Qui ogni foglio aperto si conta e, finché ce
 * n'è almeno uno, la tab bar si toglie: stesso risultato di iOS.
 */
let open = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => open > 0;

/** Da chiamare nel corpo di ogni foglio: conta finché è montato (solo Android). */
export function useSheetPresence(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    open += 1;
    emit();
    return () => {
      open = Math.max(0, open - 1);
      emit();
    };
  }, []);
}

/** `true` se su Android c'è almeno un form sheet aperto. */
export function useAnySheetOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
