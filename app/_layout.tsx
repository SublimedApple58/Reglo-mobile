import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { peekLaunchPushIntent } from '../src/services/pushNotifications';
import { colors } from '../src/theme';

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
    persistThrottleTimer = setTimeout(async () => {
      try {
        await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(client));
      } catch {}
    }, 1000);
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
    if (!inTabs) {
      router.replace('/(tabs)/home');
    }
  }, [status, autoscuolaRole, router, segments, signOut, refreshMe]);

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

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <Slot />;
};

export default function RootLayout() {
  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ??
    '';
  const merchantIdentifier =
    (Constants.expoConfig?.extra?.stripeMerchantIdentifier as string | undefined) ??
    'merchant.com.tiziano.developer.reglo-mobile';

  const content = (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: fileSystemPersister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <SessionProvider>
        <GestureHandlerRootView style={styles.root}>
          <AuthGate />
        </GestureHandlerRootView>
      </SessionProvider>
    </PersistQueryClientProvider>
  );

  if (!stripePublishableKey) {
    return content;
  }

  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      merchantIdentifier={merchantIdentifier}
    >
      {content}
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
