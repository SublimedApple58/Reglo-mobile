import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegloLogo } from '../components/RegloLogo';
import { GradientCTABackground, primaryCtaShadow } from '../components/GradientCTA';

const NAVY = '#1A1A2E';
const INK = '#1B1B27';
const MUTED = '#8A8A96';

/** iOS entry screen: light brand backdrop with two entry points. The actual
 *  forms are presented as native sheets (login = form sheet, signup = page sheet). */
export const AuthWelcomeScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.brand, { paddingTop: insets.top }]}>
        <View style={styles.sunShadow}>
          <RegloLogo size={116} tone="navy" />
        </View>
        <Text style={styles.title}>Benvenuto in Reglo</Text>
        <Text style={styles.sub}>La tua autoscuola, in tasca</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => router.push('/(auth)/login-sheet')}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
        >
          <GradientCTABackground radius={16} />
          <Text style={styles.btnPrimaryText}>Accedi</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressedGhost]}
        >
          <Text style={styles.btnGhostText}>Registrati come allievo</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 28 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Raised sun: soft drop shadow cast from the mark's shape (bottom lifts /
  // lightens), matching the depth of the home-screen icon.
  sunShadow: {
    shadowColor: NAVY,
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: INK,
    textAlign: 'center',
    marginTop: 30,
  },
  sub: { fontSize: 15, fontWeight: '400', color: MUTED, textAlign: 'center', marginTop: 9 },

  actions: { gap: 13 },
  // Primary — 3D navy gradient CTA (app-wide lift: gradient bg + colored shadow).
  // NB: no `overflow: 'hidden'` — it would clip the colored shadow (the gradient
  // clips its own rounded corners), see GradientCTA.
  btnPrimary: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryCtaShadow,
  },
  btnPrimaryText: { fontSize: 16.5, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.1 },
  // Secondary — white pill with a soft lift + hairline border.
  btnGhost: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#ECECEF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  btnGhostText: { fontSize: 16, fontWeight: '600', color: INK },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  pressedGhost: { backgroundColor: '#FAFAFA', transform: [{ scale: 0.985 }] },
});
