import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInstructorTabs } from '../hooks/useInstructorTabs';
import { useSession } from '../context/SessionContext';
import { isOwner } from '../utils/roles';

/**
 * Tab bar «B · vetro» (Tiziano 28/10) e, su iOS, tab bar NATIVA Liquid Glass
 * (REG-800): la barra sta SOPRA le schermate.
 *
 * - Android (barra JS `AppTabBar`): le radici dell'istruttore e del titolare
 *   scorrono sotto il vetro e si tengono in fondo lo spazio della barra con
 *   `useTabBarOverlap()`; tutte le altre schermate hanno lo spazio riservato
 *   dal layout delle tab (`sceneStyle`).
 * - iOS (barra nativa): il sistema non sposta il contenuto. Le radici sotto il
 *   vetro (ora anche quelle dell'allievo in pratica) usano `useTabBarOverlap()`
 *   come su Android; le altre pagine a schermo pieno prendono lo spazio dalle
 *   opzioni dello stack della loro tab (`useTabStackOptions`). I fogli no.
 */

/* ── Altezza ── */

/** Altezza della barra JS senza la safe area (misurata da `AppTabBar`). */
let bodyHeight = 0;
/** iOS: altezza della «Torna in Road» che galleggia sopra la barra nativa. */
let miniBarHeight = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const TAB_BAR_BODY_ESTIMATE = 54;
/**
 * iOS, barra nativa: altezza del `UITabBar` sopra la safe area (49 pt, anche
 * con il vetro di iOS 26, dove la capsula galleggia dentro questo spazio).
 */
export const NATIVE_TAB_BAR_BODY = 49;

export function setTabBarBodyHeight(h: number) {
  const r = Math.round(h);
  if (r === bodyHeight || r <= 0) return;
  bodyHeight = r;
  emit();
}

export function setTabBarMiniHeight(h: number) {
  const r = Math.max(0, Math.round(h));
  if (r === miniBarHeight) return;
  miniBarHeight = r;
  emit();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/* ── Che barra c'è (lo decide `app/(tabs)/_layout.tsx`) ── */

export type TabBarKind = 'js' | 'native' | 'none';

type TabSceneInfo = {
  kind: TabBarKind;
  /** iOS: tab la cui radice scorre sotto il vetro. */
  underGlass: ReadonlySet<string>;
};

const DEFAULT_INFO: TabSceneInfo = { kind: 'js', underGlass: new Set() };
export const TabSceneContext = createContext<TabSceneInfo>(DEFAULT_INFO);

/** `'native'` se la barra è quella di sistema di iOS (Liquid Glass). */
export function useTabBarKind(): TabBarKind {
  return useContext(TabSceneContext).kind;
}

/** Altezza intera della barra (safe area compresa; con la «Torna in Road» su iOS). */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const { kind } = useContext(TabSceneContext);
  const body = useSyncExternalStore(subscribe, () => bodyHeight);
  const mini = useSyncExternalStore(subscribe, () => miniBarHeight);
  if (kind === 'none') return 0;
  if (kind === 'native') return NATIVE_TAB_BAR_BODY + insets.bottom + mini;
  return (body || TAB_BAR_BODY_ESTIMATE) + Math.max(insets.bottom, 8);
}

/** iOS: altezza della sola barra nativa (dove poggia la «Torna in Road»). */
export function useNativeTabBarBase(): number {
  const insets = useSafeAreaInsets();
  return NATIVE_TAB_BAR_BODY + insets.bottom;
}

/** Spazio da lasciare in fondo nelle radici che scorrono sotto il vetro (0 se la scena ha già lo spazio). */
export function useTabBarOverlap(): number {
  const { instructorApp } = useInstructorTabs();
  // REG-794: anche le radici dei titolari (Oggi, Agenda, Allievi, Tu) stanno sotto il vetro.
  const { autoscuolaRole } = useSession();
  const { kind } = useContext(TabSceneContext);
  const h = useTabBarHeight();
  // REG-800: con la barra nativa di iOS ci passano sotto anche Home, Guide e
  // Scambi dell'allievo (le loro schermate usano già questo spazio).
  if (kind === 'native') return h;
  if (kind === 'none') return 0;
  return instructorApp || isOwner(autoscuolaRole) ? h : 0;
}

/* ── iOS: spazio delle pagine dentro gli stack delle tab ── */

/**
 * Pagine a schermo pieno (push) degli stack delle tab: con la barra nativa
 * prendono lo spazio della barra in fondo. Tutto il resto degli stack sono
 * fogli o modali a tutto schermo, che coprono la barra da sé.
 */
export const TAB_FULL_PAGES = new Set([
  'availability', 'notifications', 'swaps', 'group-lesson-invites',
  'cluster-settings',
  // REG-646: punti critici nella tab Road.
  'punti-critici',
  'settings', 'appearance', 'instructor-hours', 'locations', 'vehicles', 'evaluation-sheet',
  // Push senza opzioni negli stack (REG-800: elencate perché su iOS non c'è più
  // lo spazio a livello di scena).
  'upcoming', 'notes', '[studentId]',
  'quiz-chapters', 'quiz-results', 'quiz-session', 'exam-schede', 'scheda-grid', 'topic-list',
  'chapters', 'results', 'session',
]);

type StackOptions = { contentStyle?: StyleProp<ViewStyle> } & Record<string, unknown>;

/**
 * Opzioni dello stack di una tab: su Android le restituisce com'erano; con la
 * barra nativa di iOS aggiunge in fondo lo spazio della barra alle pagine che
 * non ci scorrono sotto.
 */
export function useTabStackOptions<T extends StackOptions>(tab: string, base: T): T | ((p: { route: { name: string } }) => T) {
  const { kind, underGlass } = useContext(TabSceneContext);
  const h = useTabBarHeight();
  return useMemo(() => {
    if (kind !== 'native') return base;
    const rootPad = underGlass.has(tab) ? 0 : h;
    return ({ route }: { route: { name: string } }) => {
      const pad = route.name === 'index' ? rootPad : TAB_FULL_PAGES.has(route.name) ? h : 0;
      return pad > 0 ? { ...base, contentStyle: [base.contentStyle, { paddingBottom: pad }] } : base;
    };
  }, [kind, underGlass, tab, h, base]);
}

/** iOS: spazio in fondo per una tab senza stack (es. «Notifiche»). */
export function useTabRootPadding(tab: string): number {
  const { kind, underGlass } = useContext(TabSceneContext);
  const h = useTabBarHeight();
  return kind === 'native' && !underGlass.has(tab) ? h : 0;
}
