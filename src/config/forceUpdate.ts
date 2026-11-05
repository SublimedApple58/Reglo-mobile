import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * Force-update gate (backend-driven).
 *
 * The app fetches the minimum supported version from `/api/mobile/app-config` on
 * launch and shows `ForceUpdateScreen` if its own version is lower. This works
 * for BOTH iOS and Android and is toggled from the backend (no per-version OTA
 * juggling). See app/_layout.tsx for the gate, and the backend route for the
 * switch. Fails OPEN — if the config can't be fetched, the app is never blocked.
 */

// TODO: set the real numeric App Store id of Reglo so the button deep-links to
// the app's store page. (Reglo - autoscuole)
export const APP_STORE_ID = '6759302065';
const ANDROID_PACKAGE = 'com.tiziano.developer.reglomobile';

export const storeUrl = (): string =>
  Platform.OS === 'ios'
    ? APP_STORE_ID
      ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
      : 'itms-apps://apps.apple.com/'
    : `market://details?id=${ANDROID_PACKAGE}`;

/**
 * Versione NATIVA installata (CFBundleShortVersionString / versionName, es.
 * "2.4.1"), cioè quella dello store. Non `Updates.runtimeVersion`: dalla 2.4.1
 * il runtime è fissato a "2.4.0" anche su binari più nuovi (runtimeVersion
 * pinnata per gli OTA), quindi confrontare il runtime col minimo del backend
 * bloccherebbe o lascerebbe passare il binario sbagliato.
 * `expo-application` è nel binario da sempre (dipendenza di expo-notifications):
 * caricato pigro e protetto, se mancasse si ripiega sul runtime. null in Expo Go.
 */
let nativeVersion: string | null | undefined;
export const currentAppVersion = (): string | null => {
  if (nativeVersion === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Application = require('expo-application') as typeof import('expo-application');
      nativeVersion = Application.nativeApplicationVersion ?? null;
    } catch {
      nativeVersion = null;
    }
  }
  return nativeVersion ?? Updates.runtimeVersion ?? null;
};

/**
 * Hard floor for the SYNC legacy block. Any binary below this is blocked
 * IMMEDIATELY at the root (before rendering any app screen), because very old
 * binaries may lack native modules the current JS uses (e.g. react-native-svg,
 * added in 1.1.2) and would crash if those screens rendered while the async
 * backend check is still in flight. The backend min-version (below) handles
 * dynamic raises for binaries at/above this floor (which share the native set).
 * Never lower this; raise the floor for live versions via the backend instead.
 */
const HARD_MIN_VERSION = '2.0.0';

/** Sync block for legacy binaries (< HARD_MIN_VERSION). No-op in dev. */
export const isLegacyBlocked = (): boolean => {
  if (__DEV__) return false;
  const v = currentAppVersion();
  return !!v && isBelowVersion(v, HARD_MIN_VERSION);
};

/** True if `version` is strictly below `min` (numeric semver compare). */
export const isBelowVersion = (version: string, min: string): boolean => {
  const v = version.split('.').map((n) => parseInt(n, 10) || 0);
  const m = min.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(v.length, m.length); i++) {
    const a = v[i] ?? 0;
    const b = m[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
};
