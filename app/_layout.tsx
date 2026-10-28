import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StyleSheet } from 'react-native';
import { QueryClient, defaultShouldDehydrateQuery, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { ForceUpdateScreen } from '../src/screens/ForceUpdateScreen';
import { currentAppVersion, isBelowVersion, isLegacyBlocked } from '../src/config/forceUpdate';
import { regloApi } from '../src/services/regloApi';
import { peekLaunchPushIntent } from '../src/services/pushNotifications';
import {
  INSTRUCTOR_LINK_ROUTE,
  subscribePendingInstructorLink,
  takePendingInstructorLinkCode,
} from '../src/utils/pendingInstructorLink';
import { colors } from '../src/theme';
import { RoadController } from '../src/road/RoadController';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useAutoscuolaSettings } from '../src/hooks/queries/useAutoscuolaSettings';
import { isInstructor } from '../src/utils/roles';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes (default; per-query overrides in hooks)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours — must be >= persister maxAge
      retry: 1,
    },
  },
});

// File-based persister using expo-file-system (available in current prod build)
const CACHE_FILE = `${FileSystem.documentDirectory}reglo-query-cache.json`;
let persistThrottleTimer: ReturnType<typeof setTimeout> | null = null;

const fileSystemPersister = {
  persistClient: (client: unknown) => {
    if (persistThrottleTimer) clearTimeout(persistThrottleTimer);
    // Serializzare la cache (~400 KB) costa sul thread JS: si scrive a
    // interazioni finite, mai durante una transizione o un'animazione
    // (REG-639 fluidità).
    persistThrottleTimer = setTimeout(() => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(client));
        } catch {}
      });
    }, 2000);
  },
  restoreClient: async () => {
    try {
      const data = await FileSystem.readAsStringAsync(CACHE_FILE);
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try { await FileSystem.deleteAsync(CACHE_FILE, { idempotent: true }); } catch {}
  },
};

// Wire up RN AppState to TanStack Query focusManager
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') {
      handleFocus(state === 'active');
    }
  });
  return () => subscription.remove();
});

// Pause queries when offline instead of throwing errors
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const AuthGate = () => {
  const { status, autoscuolaRole, signOut, refreshMe } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const roleRetryRef = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;
    const [root, leaf] = segments as unknown as string[];
    const inAuth = root === '(auth)';
    const inTabs = root === '(tabs)';
    // REG-638: la modalità Road vive fuori dalle tab (`app/road`), a tutto schermo.
    const inRoad = root === 'road';

    if (status === 'unauthenticated') {
      // Cancel all in-flight queries and clear cache to prevent
      // stale API calls with invalidated token (crashes on instructor logout)
      queryClient.cancelQueries();
      queryClient.clear();
      const allowedAuthLeaves = new Set([
        'login',
        'login-sheet',
        'signup',
        'invite',
        'password-reset',
        'password-reset-sheet',
      ]);
      if (!inAuth || !allowedAuthLeaves.has(leaf ?? '')) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (status === 'company_select') {
      if (!inAuth || leaf !== 'company-select') {
        router.replace('/(auth)/company-select');
      }
      return;
    }

    if (!autoscuolaRole) {
      // Role is null — could be a transient data issue. Retry refreshMe once
      // before giving up and forcing logout.
      if (roleRetryRef.current) {
        // Already retried — force logout
        roleRetryRef.current = false;
        signOut()
          .catch(() => undefined)
          .finally(() => {
            router.replace('/(auth)/login');
          });
        return;
      }
      roleRetryRef.current = true;
      refreshMe().catch(() => undefined);
      return;
    }

    roleRetryRef.current = false;
    if (!inTabs && !inRoad) {
      router.replace('/(tabs)/home');
    }
  }, [status, autoscuolaRole, router, segments, signOut, refreshMe]);

  // REG-451: link di associazione istruttore arrivato mentre l'app si apriva
  // (o prima del login) → apri il flusso ora che la sessione è pronta.
  const [linkTick, setLinkTick] = useState(0);
  useEffect(() => subscribePendingInstructorLink(() => setLinkTick((n) => n + 1)), []);
  useEffect(() => {
    if (status !== 'ready' || !autoscuolaRole) return;
    const code = takePendingInstructorLinkCode();
    if (!code) return;
    const t = setTimeout(() => {
      router.push({ pathname: INSTRUCTOR_LINK_ROUTE, params: { code } });
    }, 350);
    return () => clearTimeout(t);
  }, [autoscuolaRole, router, status, linkTick]);

  useEffect(() => {
    if (status !== 'ready' || !autoscuolaRole) return;
    const [root, leaf] = segments as unknown as string[];
    peekLaunchPushIntent()
      .then((intent) => {
        if (!intent) return;
        if (intent !== 'slot_fill_offer' && intent !== 'available_slots') return;
        if (root !== '(tabs)' || leaf !== 'home') {
          router.replace('/(tabs)/home');
        }
      })
      .catch(() => undefined);
  }, [autoscuolaRole, router, segments, status]);

  // Giro Road (Tiziano 28/10): l'istruttore vede la tab bar già giusta. Al
  // primo avvio senza impostazioni in cache il velo di caricamento resta finché
  // non arrivano (max ~1,5 s), poi sparisce in dissolvenza: la barra si compone
  // sotto con lo stato noto. Con la cache le impostazioni ci sono subito.
  const settings = useAutoscuolaSettings();
  const [veilTimedOut, setVeilTimedOut] = useState(false);
  const waitSettings = status === 'ready' && isInstructor(autoscuolaRole) && settings.data === undefined && !veilTimedOut;
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setTimeout(() => setVeilTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <>
      {status !== 'loading' ? (
        <>
          <Slot />
          <RoadController />
        </>
      ) : null}
      {status === 'loading' || waitSettings ? (
        <Animated.View style={StyleSheet.absoluteFill} exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.Never)}>
          <LoadingScreen />
        </Animated.View>
      ) : null}
    </>
  );
};

// Backend-driven force-update gate: on launch, ask the backend for the minimum
// supported version and block (ForceUpdateScreen) if this build is below it.
// Works on iOS + Android, toggled from the backend. Fails OPEN — any error/no
// network → never blocks. Disabled in dev.
function useForceUpdate(): boolean {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await regloApi.getAppConfig();
        const running = currentAppVersion();
        const min =
          Platform.OS === 'ios'
            ? cfg?.minSupportedVersion?.ios
            : cfg?.minSupportedVersion?.android;
        if (!cancelled && running && min && isBelowVersion(running, min)) {
          setBlocked(true);
        }
      } catch {
        // fail open — never block the app on a config/network error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return blocked;
}

export default function RootLayout() {
  const forceUpdate = useForceUpdate();
  // Sync legacy block fires before any app screen renders (safe on old binaries);
  // the backend-driven `forceUpdate` handles dynamic raises for 2.0.0+ binaries.
  if (isLegacyBlocked() || forceUpdate) {
    return <ForceUpdateScreen />;
  }
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: fileSystemPersister,
        maxAge: 24 * 60 * 60 * 1000,
        // `meta.persist === false` resta solo in memoria (es. tracciati Road).
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.meta?.persist !== false && defaultShouldDehydrateQuery(q) },
      }}
    >
      <SessionProvider>
        <GestureHandlerRootView style={styles.root}>
          <AuthGate />
        </GestureHandlerRootView>
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
