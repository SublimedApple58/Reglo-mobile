import { Platform } from 'react-native';

/**
 * Native form-sheet presentation presets (Expo Router `Stack.Screen` options).
 *
 * THE ANDROID PROBLEM: `sheetAllowedDetents: 'fitToContents'` measures the sheet's
 * content height ONCE (at mount) on Android and never re-measures when the content
 * grows later — e.g. an instructor list that loads async. The sheet stays frozen at
 * the early (too-short) height and the bottom of the form — the CTA — gets clipped
 * below the visible area, with no way to scroll to it. (On iOS UIKit re-measures and
 * scrolls automatically, so `fitToContents` is perfect there.)
 *
 * THE FIX (`TALL_SHEET`): on Android we stop asking the OS to size the sheet and give
 * it a deterministic tall detent. The screen then scrolls its own body and pins its
 * footer/CTA — so the CTA is ALWAYS reachable regardless of when data arrives, font
 * scale, or device height. iOS keeps the native content-hugging behaviour untouched.
 *
 * Screens that opt into `TALL_SHEET` MUST make their body scrollable with a sticky
 * footer on Android (see `SheetScaffold`, or the per-screen Android branch).
 */
const BASE = { presentation: 'formSheet', sheetGrabberVisible: false, headerShown: false } as const;

/** Forms / detail sheets with a footer-CTA or async-growing content. */
export const TALL_SHEET = {
  ...BASE,
  sheetAllowedDetents: (Platform.OS === 'android' ? [0.92] : 'fitToContents') as number[] | 'fitToContents',
} as const;

/** Short, static pickers (wheels, tiny menus) — safe to hug on both platforms. */
export const HUG_SHEET = {
  ...BASE,
  sheetAllowedDetents: 'fitToContents' as const,
} as const;

/**
 * Variable-length forms that can grow TALLER THAN THE SCREEN (e.g. a form whose
 * sections toggle on/off). A `fitToContents` form sheet clips the overflow on
 * iOS (it hugs content but cannot exceed the max detent and does not scroll), so
 * these use a full-height **page sheet** (`presentation: 'modal'`) and scroll
 * their own body with a pinned footer on BOTH platforms.
 */
export const PAGE_SHEET = {
  presentation: 'modal',
  headerShown: false,
} as const;

/**
 * Form sheet (card look, NOT a full-height modal) che scrolla SEMPRE il proprio
 * corpo. A differenza di `TALL_SHEET`, usa un detent FISSO anche su iOS (niente
 * `fitToContents`, che è ciò che impedisce lo scroll: la sheet abbraccia il
 * contenuto e ne taglia l'eccesso). Con un detent fisso la sheet ha un'altezza
 * definita → un `ScrollView` interno (`SheetScaffold fill`) scrolla su ENTRAMBE
 * le piattaforme. Usare per liste a lunghezza variabile che vogliono restare
 * "card" (es. "Le tue guide") invece di un page sheet a tutto schermo.
 */
export const SCROLL_SHEET = {
  presentation: 'formSheet',
  sheetGrabberVisible: false,
  headerShown: false,
  sheetAllowedDetents: [0.92] as number[],
} as const;
