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

/** iOS entry screen: bianco, logo e tre ingressi in ordine di priorità —
 *  Registrati (CTA nera), Primo accesso (CTA bianca) e Accedi (link discreto).
 *  Login = form sheet nativo, registrazione = page sheet, primo accesso = push. */
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

      <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
        {/* Priorità (Tiziano 09/11): chi è nuovo si registra; chi è già stato
            iscritto dall'autoscuola fa il primo accesso; chi ha già un account
            accede, voce più discreta in fondo. */}
        <ClayButton
          title="Registrati come allievo"
          onPress={() => router.push('/(auth)/signup')}
          testID="welcome-signup"
        />
        <ClayButton
          title="Primo accesso"
          variant="secondary"
          onPress={() => router.push('/(auth)/first-access')}
          testID="welcome-first-access"
        />
        <Text style={styles.help}>Ti ha già iscritto l&apos;autoscuola? Scegli Primo accesso.</Text>

        <Pressable
          onPress={() => router.push('/(auth)/login-sheet')}
          hitSlop={10}
          style={({ pressed }) => [styles.login, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="welcome-login"
        >
          <Text style={styles.loginText}>
            Hai già un account? <Text style={styles.loginLink}>Accedi</Text>
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
  help: { fontSize: 13.5, lineHeight: 18, color: MUTED, textAlign: 'center', marginTop: -4 },
  login: { alignItems: 'center', paddingVertical: 10, marginTop: 14 },
  loginText: { fontSize: 15, color: MUTED },
  loginLink: { fontWeight: '600', color: INK },
  pressed: { opacity: 0.55 },
});
