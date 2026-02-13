import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { StripeProvider } from '@stripe/stripe-react-native';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { consumePendingOrLaunchPushIntent } from '../src/services/pushNotifications';
import { colors } from '../src/theme';

const AuthGate = () => {
  const { status, autoscuolaRole, signOut } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const forcedLogoutRef = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;
    const [root, leaf] = segments as unknown as string[];
    const inAuth = root === '(auth)';
    const inTabs = root === '(tabs)';

    if (status === 'unauthenticated') {
      const allowedAuthLeaves = new Set(['login', 'signup', 'invite']);
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
      if (forcedLogoutRef.current) {
        return;
      }
      forcedLogoutRef.current = true;
      signOut()
        .catch(() => undefined)
        .finally(() => {
          router.replace('/(auth)/login');
        });
      return;
    }

    forcedLogoutRef.current = false;
    if (!inTabs) {
      router.replace('/(tabs)/home');
    }
  }, [status, autoscuolaRole, router, segments, signOut]);

  useEffect(() => {
    if (status !== 'ready' || !autoscuolaRole) return;
    const [root, leaf] = segments as unknown as string[];
    consumePendingOrLaunchPushIntent()
      .then((intent) => {
        if (intent !== 'slot_fill_offer') return;
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
    <SessionProvider>
      <View style={styles.root}>
        <LinearGradient
          colors={[colors.backgroundTop, colors.backgroundBottom]}
          locations={[0, 0.75]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AuthGate />
      </View>
    </SessionProvider>
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
    backgroundColor: colors.backgroundTop,
  },
});
