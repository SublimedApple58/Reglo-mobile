import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClayField, ClayList, ClayListRow, Icon3D } from '../../components/clay';
import { CodeBoxes } from '../../components/CodeBoxes';
import { FadeImage } from '../../components/FadeImage';
import { PhoneField, phoneIsComplete, phoneSubmitValue } from '../../components/PhoneField';
import { regloApi } from '../../services/regloApi';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import { formatPhone, isValidEmail } from '../firstAccess/FirstAccessContext';
import { FirstAccessStepScreen, useFocusAfterPush } from '../firstAccess/FirstAccessStepScreen';
import { CODE_LENGTH, errorText, signupProgress, useSignup } from './SignupContext';

const KEY_ART = require('../../../assets/web/3d/chiave-3d.png');

/** Testo toccabile sotto la CTA (stesso peso di «Esci» dell'onboarding). */
function BelowLink({ text, action, onPress, testID }: { text?: string; action: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [s.below, pressed && s.pressed]}
      accessibilityRole="button"
      testID={testID}
    >
      <Text style={s.belowText}>
        {text ? `${text} ` : ''}
        <Text style={s.belowAction}>{action}</Text>
      </Text>
    </Pressable>
  );
}

/** 1 · Il codice di invito: si controlla subito, così si vede a chi ci si iscrive. */
export function SignupCodeStep() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusAfterPush(ref);
  const complete = draft.code.length === CODE_LENGTH;

  const submit = async () => {
    if (loading || !complete) return;
    setError(null);
    setLoading(true);
    try {
      const school = await regloApi.checkSignupCode(draft.code);
      update({ school });
      router.push('/(auth)/signup/school');
    } catch (err) {
      setError(errorText(err, 'Non riusciamo a controllare il codice. Riprova.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FirstAccessStepScreen
      progress={signupProgress('index')}
      hero={<Icon3D source={KEY_ART} size={64} />}
      title="Il tuo codice di invito"
      subtitle="Te lo dà la tua autoscuola o il tuo istruttore. Sono 6 lettere e numeri."
      cta="Continua"
      ctaDisabled={!complete}
      loading={loading}
      onCta={submit}
      error={error}
    >
      <CodeBoxes
        ref={ref}
        value={draft.code}
        onChange={(code) => {
          update({ code, school: null });
          if (error) setError(null);
        }}
        length={CODE_LENGTH}
        focused={focused}
        onFocusChange={setFocused}
        onSubmit={submit}
        editable={!loading}
        testID="signup-code"
      />
    </FirstAccessStepScreen>
  );
}

/** 2 · «È la tua autoscuola?»: logo e nome veri, prima di scrivere qualunque dato. */
export function SignupSchoolStep() {
  const router = useRouter();
  const { draft } = useSignup();
  const school = draft.school;
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = school?.company.logoUrl;

  const detail = school?.instructorName
    ? `Ti iscrivi con ${school.instructorName}, il tuo istruttore.`
    : school?.locationName
      ? `Ti iscrivi alla sede ${school.locationName}.`
      : 'Stai per iscriverti qui. È la tua autoscuola?';

  return (
    <FirstAccessStepScreen
      progress={signupProgress('school')}
      hero={
        logoUrl && !logoFailed ? (
          <View style={[s.logoWrap, CLAY_SHADOW.raise]}>
            <FadeImage source={{ uri: logoUrl }} style={s.logo} resizeMode="contain" onError={() => setLogoFailed(true)} />
          </View>
        ) : (
          <Icon3D source={VITA_ART.edificio} size={64} />
        )
      }
      title={school?.company.name ?? 'La tua autoscuola'}
      subtitle={detail}
      cta="Sì, continua"
      onCta={() => router.push('/(auth)/signup/name')}
      below={<BelowLink text="Non è lei?" action="Cambia codice" onPress={() => router.back()} testID="signup-change-code" />}
    />
  );
}

/** 3 · Come ti chiami: nome e cognome, due campi. */
export function SignupNameStep() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const firstRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);
  useFocusAfterPush(firstRef);
  const ok = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 1;
  const go = () => ok && router.push('/(auth)/signup/email');

  return (
    <FirstAccessStepScreen
      progress={signupProgress('name')}
      hero={<Icon3D source={VITA_ART.tessera} size={64} />}
      title="Come ti chiami?"
      subtitle="Scrivilo come sui documenti: serve all'autoscuola per la tua pratica."
      cta="Continua"
      ctaDisabled={!ok}
      onCta={go}
    >
      {/* Affiancati: con l'icona sopra e la tastiera aperta, in colonna il cognome finiva sotto la CTA. */}
      <View style={s.nameRow}>
      <ClayField
        ref={firstRef}
        style={s.nameField}
        label="Nome"
        value={draft.firstName}
        onChangeText={(firstName) => update({ firstName })}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastRef.current?.focus()}
        testID="signup-first-name"
      />
      <ClayField
        ref={lastRef}
        style={s.nameField}
        label="Cognome"
        value={draft.lastName}
        onChangeText={(lastName) => update({ lastName })}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="familyName"
        returnKeyType="next"
        onSubmitEditing={go}
        testID="signup-last-name"
      />
      </View>
    </FirstAccessStepScreen>
  );
}

/** 4 · Email: si controlla subito che sia libera, non alla fine. */
export function SignupEmailStep() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const ref = useRef<TextInput>(null);
  useFocusAfterPush(ref);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const valid = isValidEmail(draft.email);

  const submit = async () => {
    if (loading || !valid) return;
    setError(null);
    setTaken(false);
    setLoading(true);
    try {
      const { emailAvailable } = await regloApi.checkSignupEmail(draft.email.trim());
      if (!emailAvailable) {
        setTaken(true);
        setError('Esiste già un account con questa email.');
        return;
      }
      router.push('/(auth)/signup/phone');
    } catch (err) {
      setError(errorText(err, "Non riusciamo a controllare l'email. Riprova."));
    } finally {
      setLoading(false);
    }
  };

  const toLogin = () => {
    router.navigate('/(auth)/login');
    setTimeout(() => router.push('/(auth)/login-sheet'), 450);
  };

  return (
    <FirstAccessStepScreen
      progress={signupProgress('email')}
      hero={<Icon3D source={VITA_ART.busta} size={64} />}
      title="La tua email"
      subtitle="Ti serve per recuperare la password e per ricevere le comunicazioni dell'autoscuola."
      cta="Continua"
      ctaDisabled={!valid}
      loading={loading}
      onCta={submit}
      below={taken ? <BelowLink text="È il tuo account?" action="Accedi" onPress={toLogin} testID="signup-to-login" /> : undefined}
    >
      <ClayField
        ref={ref}
        label="Email"
        value={draft.email}
        onChangeText={(email) => {
          update({ email });
          if (error) setError(null);
          if (taken) setTaken(false);
        }}
        onBlur={() => setTouched(true)}
        placeholder="nome@email.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={submit}
        error={error ?? (touched && draft.email.trim() && !valid ? "Controlla l'email: non sembra valida." : null)}
        testID="signup-email"
      />
    </FirstAccessStepScreen>
  );
}

/** 5 · Cellulare, con il prefisso (stesso campo dell'onboarding) e il consenso WhatsApp di REG-500. */
export function SignupPhoneStep() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const ref = useRef<TextInput>(null);
  useFocusAfterPush(ref);

  return (
    <FirstAccessStepScreen
      progress={signupProgress('phone')}
      hero={<Icon3D source={VITA_ART.telefono} size={64} />}
      title="Il tuo numero di cellulare"
      subtitle="Lo userai per entrare nell'app e per ricevere gli avvisi sulle guide."
      cta="Continua"
      ctaDisabled={!phoneIsComplete(draft.phone)}
      onCta={() => router.push('/(auth)/signup/password')}
    >
      <PhoneField
        ref={ref}
        label="Numero di cellulare"
        value={draft.phone}
        onChange={(phone) => update({ phone })}
        testID="signup-phone"
      />
      <Text style={s.note}>
        Continuando accetti di riceverli su WhatsApp. Puoi smettere quando vuoi dal profilo o rispondendo STOP.
      </Text>
    </FirstAccessStepScreen>
  );
}

/** 6 · Password. */
export function SignupPasswordStep() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const ref = useRef<TextInput>(null);
  useFocusAfterPush(ref);
  const [visible, setVisible] = useState(false);
  const ok = draft.password.length >= 6;
  const go = () => ok && router.push('/(auth)/signup/confirm');

  return (
    <FirstAccessStepScreen
      progress={signupProgress('password')}
      hero={<Icon3D source={VITA_ART.lucchetto} size={64} />}
      title="Scegli una password"
      subtitle="Con la tua email o il tuo numero e questa password entrerai nell'app le prossime volte."
      cta="Continua"
      ctaDisabled={!ok}
      onCta={go}
    >
      <View>
        <ClayField
          ref={ref}
          label="Password"
          value={draft.password}
          onChangeText={(password) => update({ password })}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
          placeholder="Almeno 6 caratteri"
          returnKeyType="next"
          onSubmitEditing={go}
          testID="signup-password"
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} style={s.reveal} accessibilityRole="button">
          <Text style={s.revealText}>{visible ? 'Nascondi' : 'Mostra'}</Text>
        </Pressable>
      </View>
      <Text style={s.note}>{ok ? 'Perfetto.' : `Ancora ${Math.max(0, 6 - draft.password.length)} caratteri.`}</Text>
    </FirstAccessStepScreen>
  );
}

/** 7 · «Tutto giusto?»: il riepilogo; qui nasce l'account. Ogni riga riporta al suo passo. */
export function SignupConfirmStep() {
  const router = useRouter();
  const { draft, submit, submitting, submitError } = useSignup();
  const go = (path: '/(auth)/signup' | '/(auth)/signup/name' | '/(auth)/signup/email' | '/(auth)/signup/phone') =>
    router.navigate(path);
  const school = draft.school;

  return (
    <FirstAccessStepScreen
      progress={signupProgress('confirm')}
      hero={<Icon3D source={VITA_ART.cartellina} size={64} />}
      title="Tutto giusto?"
      subtitle="Controlla i tuoi dati. Potrai cambiarli anche dopo, dal profilo."
      cta="Crea account"
      loading={submitting}
      onCta={() => submit().catch(() => undefined)}
      error={submitError}
    >
      <ClayList>
        <ClayListRow
          title={school?.company.name ?? draft.code}
          subtitle={school?.instructorName ? `Autoscuola · con ${school.instructorName}` : 'Autoscuola'}
          onPress={submitting ? undefined : () => go('/(auth)/signup')}
          testID="signup-confirm-school"
        />
        <ClayListRow
          title={`${draft.firstName.trim()} ${draft.lastName.trim()}`}
          subtitle="Nome e cognome"
          onPress={submitting ? undefined : () => go('/(auth)/signup/name')}
        />
        <ClayListRow
          title={draft.email.trim()}
          subtitle="Email"
          onPress={submitting ? undefined : () => go('/(auth)/signup/email')}
        />
        <ClayListRow
          title={formatPhone(phoneSubmitValue(draft.phone))}
          subtitle="Cellulare"
          onPress={submitting ? undefined : () => go('/(auth)/signup/phone')}
        />
      </ClayList>
    </FirstAccessStepScreen>
  );
}

const s = StyleSheet.create({
  below: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  pressed: { opacity: 0.5 },
  belowText: { fontSize: 15, lineHeight: 20, color: CLAY.ink3 },
  belowAction: { fontWeight: '600', color: CLAY.ink },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 56, height: 56, borderRadius: 12 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },
  note: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, paddingHorizontal: 2 },
  reveal: { position: 'absolute', right: 16, top: 38, height: 34, justifyContent: 'center' },
  revealText: { fontSize: 14, fontWeight: '600', color: CLAY.ink },
});
