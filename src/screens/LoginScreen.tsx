import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthField } from '../components/AuthField';
import { GradientCTABackground, primaryCtaShadow } from '../components/GradientCTA';
import { RegloLogo } from '../components/RegloLogo';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E
const IVORY = '#F5EFE6';
const NAVY_300 = '#AEB4CC';
const NAVY_400 = '#6E7596';

type LoginScreenProps = {
  /** 'inline' = Android B1 full navy screen · 'sheet' = iOS native form sheet */
  mode?: 'inline' | 'sheet';
};

export const LoginScreen = ({ mode = 'inline' }: LoginScreenProps) => {
  const { signIn } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login non riuscito');
    } finally {
      setLoading(false);
    }
  };

  const onForgot = () =>
    router.push(mode === 'sheet' ? '/(auth)/password-reset-sheet' : '/(auth)/password-reset');

  const dark = mode === 'inline';

  const fields = (
    <>
      <AuthField
        label="Email"
        dark={dark}
        placeholder="nome@email.it"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <AuthField
        label="Password"
        dark={dark}
        password
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
      />
      <Pressable onPress={onForgot} hitSlop={8} style={styles.forgotWrap}>
        <Text style={[styles.forgot, { color: dark ? NAVY_300 : NAVY }]}>Password dimenticata?</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  // ── iOS native form sheet ──
  if (mode === 'sheet') {
    return (
      <View style={styles.sheetRoot}>
        <StatusBar style="dark" />
        <View style={styles.sheetTopBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={20} color={NAVY_400} />
          </Pressable>
        </View>
        <Text style={styles.sheetTitle}>Accedi</Text>
        <Text style={styles.sheetSub}>Bentornato 👋</Text>
        {fields}
        <CtaButton label="Accedi" tone="navy" loading={loading} onPress={handleLogin} />
      </View>
    );
  }

  // ── Android B1 — full navy inline ──
  return (
    <View style={[styles.inlineRoot, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="light" />
      <View style={styles.glow} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <RegloLogo size={56} />
          <View>
            <Text style={styles.brandTitle}>Bentornato</Text>
            <Text style={styles.brandSub}>Accedi alla tua autoscuola</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>{fields}</View>
        <CtaButton label="Accedi" tone="ivory" loading={loading} onPress={handleLogin} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Sei un allievo?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/signup')}>
            Registrati
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const CtaButton = ({
  label,
  tone,
  loading,
  onPress,
}: {
  label: string;
  tone: 'navy' | 'ivory';
  loading: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={loading ? undefined : onPress}
    style={({ pressed }) => [
      styles.cta,
      tone === 'navy' ? styles.ctaNavy : styles.ctaIvory,
      pressed && styles.ctaPressed,
    ]}
  >
    {tone === 'navy' && <GradientCTABackground radius={15} />}
    {loading ? (
      <ActivityIndicator color={tone === 'navy' ? '#FFFFFF' : NAVY} />
    ) : (
      <Text style={[styles.ctaText, { color: tone === 'navy' ? '#FFFFFF' : NAVY }]}>{label}</Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  // sheet (iOS) — plain root, the native form sheet provides the rounded chrome.
  sheetRoot: { backgroundColor: '#FFFFFF', paddingTop: 16, paddingHorizontal: 24, paddingBottom: 32 },
  sheetTopBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -2 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 21, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13.5, fontWeight: '400', color: NAVY_400, marginTop: 2 },

  // inline (Android)
  inlineRoot: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 28 },
  glow: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: IVORY,
    opacity: 0.05,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  brandTitle: { fontSize: 27, fontWeight: '600', letterSpacing: -0.4, color: IVORY },
  brandSub: { fontSize: 14.5, fontWeight: '400', color: NAVY_300, marginTop: 4 },

  // shared
  forgotWrap: { alignSelf: 'flex-end', marginTop: 11 },
  forgot: { fontSize: 13, fontWeight: '600' },
  error: { fontSize: 14, fontWeight: '500', color: colors.destructive, marginTop: 12, textAlign: 'center' },
  cta: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  ctaNavy: {
    ...primaryCtaShadow,
  },
  ctaIvory: {
    backgroundColor: IVORY,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  ctaPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  ctaText: { fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto' },
  footerText: { fontSize: 14, color: NAVY_400 },
  footerLink: { fontSize: 14, fontWeight: '600', color: IVORY },
});
