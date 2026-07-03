import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthField } from '../components/AuthField';
import { GradientCTABackground, primaryCtaShadow } from '../components/GradientCTA';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E
const IVORY = '#F5EFE6';
const NAVY_300 = '#AEB4CC';
const NAVY_400 = '#6E7596';

type SignupScreenProps = {
  /** 'inline' = Android full navy screen · 'sheet' = iOS native page sheet */
  mode?: 'inline' | 'sheet';
};

export const SignupScreen = ({ mode = 'inline' }: SignupScreenProps) => {
  const { signUp } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signUp({
        name,
        email: email.trim(),
        phone: phone.trim(),
        password,
        confirmPassword: password,
        schoolCode: schoolCode.trim().toUpperCase(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita');
    } finally {
      setLoading(false);
    }
  };

  const dark = mode === 'inline';

  const form = (
    <>
      <AuthField label="Nome completo" dark={dark} placeholder="Mario Rossi" value={name} onChangeText={setName} />
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
        label="Numero di cellulare"
        dark={dark}
        placeholder="+39 ..."
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <AuthField label="Password" dark={dark} password placeholder="••••••••" value={password} onChangeText={setPassword} />

      <View style={styles.codeWrap}>
        <Text style={[styles.codeLabel, { color: dark ? NAVY_300 : '#14141F' }]}>Codice di invito</Text>
        <TextInput
          style={[styles.codeInput, dark ? styles.codeInputDark : styles.codeInputLight]}
          value={schoolCode}
          onChangeText={(t) => setSchoolCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          placeholderTextColor={dark ? '#7E84A0' : '#9AA1BB'}
        />
        <Text style={[styles.codeHint, { color: dark ? NAVY_400 : NAVY_400 }]}>
          Ricevuto dalla tua autoscuola o dall'istruttore
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const cta = (
    <Pressable
      onPress={loading ? undefined : handleSignup}
      style={({ pressed }) => [
        styles.cta,
        dark ? styles.ctaIvory : styles.ctaNavy,
        pressed && styles.ctaPressed,
      ]}
    >
      {!dark && <GradientCTABackground radius={15} />}
      {loading ? (
        <ActivityIndicator color={dark ? NAVY : '#FFFFFF'} />
      ) : (
        <Text style={[styles.ctaText, { color: dark ? NAVY : '#FFFFFF' }]}>Crea account</Text>
      )}
    </Pressable>
  );

  const footer = (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: NAVY_400 }]}>Hai già un account?</Text>
      <Text style={[styles.footerLink, { color: dark ? IVORY : NAVY }]} onPress={() => router.back()}>
        Accedi
      </Text>
    </View>
  );

  // ── iOS native page sheet ──
  if (mode === 'sheet') {
    return (
      <View style={styles.sheetRoot}>
        <StatusBar style="dark" />
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={20} color={NAVY_400} />
        </Pressable>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sheetTitle}>Crea il tuo account</Text>
            <Text style={styles.sheetSub}>Bastano pochi dati e il codice di invito</Text>
            {form}
            {cta}
            {footer}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Android — full navy inline ──
  return (
    <View style={styles.inlineRoot}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.inlineBody,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.inlineTitle}>Crea il tuo account</Text>
          <Text style={styles.inlineSub}>Bastano pochi dati e il codice di invito</Text>
          {form}
          {cta}
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  // sheet (iOS)
  sheetRoot: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 18 },
  close: {
    position: 'absolute',
    top: 16,
    right: 18,
    zIndex: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 36 },
  sheetTitle: { fontSize: 24, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  sheetSub: { fontSize: 14, fontWeight: '400', color: NAVY_400, marginTop: 6 },

  // inline (Android)
  inlineRoot: { flex: 1, backgroundColor: NAVY },
  inlineBody: { paddingHorizontal: 28 },
  inlineTitle: { fontSize: 27, fontWeight: '600', color: IVORY, letterSpacing: -0.4 },
  inlineSub: { fontSize: 14.5, fontWeight: '400', color: NAVY_300, marginTop: 6 },

  // code field
  codeWrap: { marginTop: 16 },
  codeLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginLeft: 3 },
  codeInput: {
    height: 60,
    borderRadius: 15,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 12,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  codeInputLight: { backgroundColor: colors.navy[50], borderColor: colors.navy[200], color: NAVY },
  codeInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(245,239,230,0.20)',
    color: IVORY,
  },
  codeHint: { fontSize: 11.5, marginTop: 7, marginLeft: 3 },

  // shared
  error: { fontSize: 14, fontWeight: '500', color: colors.destructive, marginTop: 12, textAlign: 'center' },
  cta: { height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600' },
});
