import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInstructorTabs } from '../hooks/useInstructorTabs';

/**
 * Tab bar «B · vetro a tutta larghezza» (Tiziano 28/10): la barra sta SOPRA
 * le schermate. Le quattro radici dell'istruttore (Agenda, Road, Allievi, Tu)
 * scorrono sotto il vetro e si tengono in fondo lo spazio della barra con
 * `useTabBarOverlap()`; tutte le altre schermate hanno lo spazio riservato
 * dal layout delle tab (`sceneStyle`), quindi nulla resta coperto.
 */

/** Altezza della barra senza la safe area (misurata da `AppTabBar`). */
let bodyHeight = 0;
const listeners = new Set<() => void>();

export const TAB_BAR_BODY_ESTIMATE = 54;

export function setTabBarBodyHeight(h: number) {
  const r = Math.round(h);
  if (r === bodyHeight || r <= 0) return;
  bodyHeight = r;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Altezza intera della barra (safe area compresa). */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const body = useSyncExternalStore(subscribe, () => bodyHeight);
  return (body || TAB_BAR_BODY_ESTIMATE) + Math.max(insets.bottom, 8);
}

/** Spazio da lasciare in fondo nelle radici che scorrono sotto il vetro (0 se la scena ha già lo spazio). */
export function useTabBarOverlap(): number {
  const { instructorApp } = useInstructorTabs();
  const h = useTabBarHeight();
  return instructorApp ? h : 0;
}
