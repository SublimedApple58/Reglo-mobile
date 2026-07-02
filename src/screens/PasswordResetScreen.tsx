import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { GradientCTABackground } from '../components/GradientCTA';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import { notificationAsync, NotificationFeedbackType } from '../utils/haptics';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E
const IVORY = '#F5EFE6';
const NAVY_300 = '#AEB4CC';
const NAVY_400 = '#6E7596';

const RESEND_SECONDS = 60;

type Step = 'email' | 'code' | 'password';

type PasswordResetScreenProps = {
  /** 'inline' = Android B1 full navy screen · 'sheet' = iOS native form sheet */
  mode?: 'inline' | 'sheet';
};

const STEP_COPY: Record<Step, { title: string; sub: (email: string) => string }> = {
  email: {
    title: 'Reimposta password',
    sub: () => 'Inserisci la tua email: ti invieremo un codice a 6 cifre.',
  },
  code: {
    title: 'Controlla l’email',
    sub: (email) => `Abbiamo inviato un codice a ${email || 'la tua email'}.`,
  },
  password: {
    title: 'Nuova password',
    sub: () => 'Scegli una nuova password per il tuo account.',
  },
};

export const PasswordResetScreen = ({ mode = 'inline' }: PasswordResetScreenProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applyAuthPayload } = useSession();
  const dark = mode === 'inline';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const close = () => router.back();

  const goToStep = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const back = () => {
    if (step === 'password') return goToStep('code');
    if (step === 'code') return goToStep('email');
    close();
  };

  // ── Step 1: request the code ──
  const onRequest = useCallback(async () => {
    if (loading) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Inserisci un’email valida.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await regloApi.passwordResetRequest({ email: trimmed });
      setEmail(trimmed);
      setCooldown(RESEND_SECONDS);
      setToast({ text: 'Se l’email è registrata, ti abbiamo inviato un codice.', tone: 'info' });
      goToStep('code');
    } catch (err) {
      setError('Qualcosa è andato storto. Riprova.');
    } finally {
      setLoading(false);
    }
  }, [email, loading]);

  // Resend without leaving the code step.
  const onResend = useCallback(async () => {
    if (cooldown > 0) return;
    try {
      await regloApi.passwordResetRequest({ email: email.trim().toLowerCase() });
      setCooldown(RESEND_SECONDS);
      setToast({ text: 'Codice inviato di nuovo.', tone: 'info' });
    } catch {
      setToast({ text: 'Impossibile inviare il codice. Riprova.', tone: 'danger' });
    }
  }, [cooldown, email]);

  // ── Step 2: verify the code ──
  const onVerify = useCallback(async () => {
    if (loading) return;
    if (code.trim().length !== 6) {
      setError('Inserisci il codice a 6 cifre.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await regloApi.passwordResetVerify({ email: email.trim().toLowerCase(), code: code.trim() });
      goToStep('password');
    } catch (err) {
      setError(err instanceof RegloApiError ? err.message : 'Codice non valido o scaduto.');
    } finally {
      setLoading(false);
    }
  }, [code, email, loading]);

  // ── Step 3: set the new password ──
  const onConfirm = useCallback(async () => {
    if (loading) return;
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await regloApi.passwordResetConfirm({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
        confirmPassword,
      });
      await notificationAsync(NotificationFeedbackType.Success);
      if (result.autoLogin) {
        // Establishing the session flips the root status → the layout routes
        // into the app automatically (same path as signIn).
        await applyAuthPayload(result.payload);
      } else {
        setToast({ text: 'Password aggiornata. Accedi con le nuove credenziali.', tone: 'success' });
        setTimeout(() => router.replace('/(auth)/login'), 1200);
      }
    } catch (err) {
      setError(err instanceof RegloApiError ? err.message : 'Impossibile reimpostare la password.');
    } finally {
      setLoading(false);
    }
  }, [applyAuthPayload, code, confirmPassword, email, loading, password, router]);

  const primaryAction = step === 'email' ? onRequest : step === 'code' ? onVerify : onConfirm;
  const primaryLabel = step === 'email' ? 'Invia codice' : step === 'code' ? 'Verifica' : 'Reimposta password';

  const copy = STEP_COPY[step];

  const body = (
    <>
      {step === 'email' && (
        <AuthField
          label="Email"
          dark={dark}
          placeholder="nome@email.it"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="done"
          onSubmitEditing={onRequest}
        />
      )}

      {step === 'code' && (
        <View style={styles.codeWrap}>
          <Text style={[styles.codeLabel, { color: dark ? NAVY_300 : '#14141F' }]}>Codice</Text>
          <TextInput
            style={[styles.codeInput, dark ? styles.codeInputDark : styles.codeInputLight]}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={dark ? '#7E84A0' : '#9AA1BB'}
            autoFocus
          />
          <Pressable onPress={onResend} disabled={cooldown > 0} hitSlop={8} style={styles.resendWrap}>
            <Text style={[styles.resend, { color: cooldown > 0 ? NAVY_400 : dark ? IVORY : NAVY }]}>
              {cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : 'Invia di nuovo il codice'}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 'password' && (
        <>
          <AuthField
            label="Nuova password"
            dark={dark}
            password
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
          />
          <AuthField
            label="Conferma password"
            dark={dark}
            password
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const header = (
    <View style={[styles.topBar, mode === 'sheet' ? styles.topBarSheet : null]}>
      <Pressable onPress={back} hitSlop={8} style={[styles.iconBtn, dark ? styles.iconBtnDark : styles.iconBtnLight]}>
        <Ionicons
          name={step === 'email' ? 'close' : 'chevron-back'}
          size={20}
          color={dark ? IVORY : NAVY_400}
        />
      </Pressable>
    </View>
  );

  // ── iOS native form sheet ──
  if (mode === 'sheet') {
    return (
      <View style={styles.sheetRoot}>
        <StatusBar style="dark" />
        {header}
        <Text style={styles.sheetTitle}>{copy.title}</Text>
        <Text style={styles.sheetSub}>{copy.sub(email)}</Text>
        <View style={{ marginTop: 4 }}>{body}</View>
        <CtaButton label={primaryLabel} tone="navy" loading={loading} onPress={primaryAction} />
        <ToastNotice
          message={toast?.text ?? null}
          tone={toast?.tone}
          onHide={() => setToast(null)}
        />
      </View>
    );
  }

  // ── Android B1 — full navy inline ──
  return (
    <View style={[styles.inlineRoot, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="light" />
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.inlineTitle}>{copy.title}</Text>
        <Text style={styles.inlineSub}>{copy.sub(email)}</Text>
        <View style={{ marginTop: 12 }}>{body}</View>
        <CtaButton label={primaryLabel} tone="ivory" loading={loading} onPress={primaryAction} />
      </KeyboardAvoidingView>
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
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
  sheetTitle: { fontSize: 21, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13.5, fontWeight: '400', color: NAVY_400, marginTop: 4, lineHeight: 19 },

  // inline (Android)
  inlineRoot: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 28 },
  inlineTitle: { fontSize: 27, fontWeight: '600', color: IVORY, letterSpacing: -0.4, marginTop: 8 },
  inlineSub: { fontSize: 14.5, fontWeight: '400', color: NAVY_300, marginTop: 6, lineHeight: 20 },

  // header
  topBar: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 },
  topBarSheet: { justifyContent: 'flex-start', marginLeft: -4, marginBottom: 2 },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconBtnLight: { backgroundColor: colors.navy[50] },
  iconBtnDark: { backgroundColor: 'rgba(255,255,255,0.08)' },

  // code field (mirrors SignupScreen schoolCode)
  codeWrap: { marginTop: 13 },
  codeLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginLeft: 3 },
  codeInput: {
    height: 60,
    borderRadius: 15,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 14,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  codeInputLight: { backgroundColor: colors.navy[50], borderColor: colors.navy[200], color: NAVY },
  codeInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(245,239,230,0.20)',
    color: IVORY,
  },
  resendWrap: { alignSelf: 'flex-start', marginTop: 12, marginLeft: 3 },
  resend: { fontSize: 13, fontWeight: '600' },

  // shared
  error: { fontSize: 14, fontWeight: '500', color: colors.destructive, marginTop: 12, textAlign: 'center' },
  cta: { height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ctaNavy: {
    shadowColor: NAVY,
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
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
});
