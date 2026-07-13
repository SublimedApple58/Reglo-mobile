import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegloLogo } from '../components/RegloLogo';

const NAVY = '#1A1A2E';
const INK = '#222222';
const MUTED = '#929292';
const BORDER = '#DDDDDD';

/** iOS entry screen: light brand backdrop with two entry points. The actual
 *  forms are presented as native sheets (login = form sheet, signup = page sheet). */
export const AuthWelcomeScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.brand, { paddingTop: insets.top + 100 }]}>
        <RegloLogo size={104} tone="navy" animated />
        <Text style={styles.title}>Benvenuto in Reglo</Text>
        <Text style={styles.sub}>La tua autoscuola, in tasca</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => router.push('/(auth)/login-sheet')}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
        >
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
  brand: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: INK,
    textAlign: 'center',
    marginTop: 20,
  },
  sub: { fontSize: 14.5, fontWeight: '400', color: MUTED, textAlign: 'center', marginTop: 8 },
  actions: { gap: 12 },
  btnPrimary: {
    height: 54,
    borderRadius: 15,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  btnGhost: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 16, fontWeight: '600', color: INK },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  pressedGhost: { backgroundColor: '#FAFAFA' },
});
