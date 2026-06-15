import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegloLogo } from '../components/RegloLogo';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E
const IVORY = '#F5EFE6';
const NAVY_300 = '#AEB4CC';

/** iOS entry screen: navy brand backdrop with two entry points. The actual
 *  forms are presented as native sheets (login = form sheet, signup = page sheet). */
export const AuthWelcomeScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.brand, { paddingTop: insets.top + 110 }]}>
        <RegloLogo size={200} animated />
        <Text style={styles.title}>Benvenuto in Reglo</Text>
        <Text style={styles.sub}>La tua autoscuola, in tasca</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => router.push('/(auth)/login-sheet')}
          style={({ pressed }) => [styles.btnIvory, pressed && styles.pressed]}
        >
          <Text style={styles.btnIvoryText}>Accedi</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
        >
          <Text style={styles.btnGhostText}>Registrati come allievo</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 28 },
  brand: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: IVORY,
    textAlign: 'center',
    marginTop: -8,
  },
  sub: { fontSize: 14.5, fontWeight: '400', color: NAVY_300, textAlign: 'center', marginTop: 8 },
  actions: { gap: 12 },
  btnIvory: {
    height: 54,
    borderRadius: 15,
    backgroundColor: IVORY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  btnIvoryText: { fontSize: 16, fontWeight: '600', color: NAVY },
  btnGhost: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(245,239,230,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 16, fontWeight: '600', color: IVORY },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
});
