import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { consumePendingOrLaunchPushIntent } from '../src/services/pushNotifications';
import { colors } from '../src/theme';

const AuthGate = () => {
  const { status, autoscuolaRole } = useSession();
  const segments = useSegments();
  const router = useRouter();

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
      if (!inAuth || leaf !== 'role-blocked') {
        router.replace('/(auth)/role-blocked');
      }
      return;
    }

    if (!inTabs) {
      router.replace('/(tabs)/home');
    }
  }, [status, autoscuolaRole, router, segments]);

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
  return (
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
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundTop,
  },
});
