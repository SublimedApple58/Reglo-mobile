import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegloLogo } from '../components/RegloLogo';
import { ClayButton } from '../components/clay';

const NAVY = '#111111';
const INK = '#1F1F1F';
const MUTED = '#8E8E8E';

/** iOS entry screen: light brand backdrop with two entry points. The actual
 *  forms are presented as native sheets (login = form sheet, signup = page sheet). */
export const AuthWelcomeScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.brand, { paddingTop: insets.top + 150 }]}>
        <View style={styles.sunShadow}>
          <RegloLogo size={116} tone="black" />
        </View>
        <Text style={styles.title}>Benvenuto in Reglo</Text>
        <Text style={styles.sub}>La tua autoscuola, in tasca</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        {/* CTA clay come «Continua» del primo accesso: capsula piena, volume
            vero, al tocco scala e sprofonda senza rimbalzo (ClayPressable). */}
        <ClayButton title="Accedi" onPress={() => router.push('/(auth)/login-sheet')} testID="welcome-login" />
        <ClayButton
          title="Registrati come allievo"
          variant="secondary"
          onPress={() => router.push('/(auth)/signup')}
          testID="welcome-signup"
        />
        <Pressable
          onPress={() => router.push('/(auth)/first-access')}
          hitSlop={8}
          style={({ pressed }) => [styles.firstAccess, pressed && { opacity: 0.6 }]}
          testID="welcome-first-access"
        >
          <Text style={styles.firstAccessText}>
            L&apos;autoscuola ti ha già iscritto? <Text style={styles.firstAccessLink}>Primo accesso</Text>
          </Text>
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

  actions: { gap: 14 },
  firstAccess: { alignItems: 'center', paddingTop: 6 },
  firstAccessText: { fontSize: 14.5, color: MUTED },
  firstAccessLink: { fontWeight: '600', color: INK },
});
