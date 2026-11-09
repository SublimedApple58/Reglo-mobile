import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated from 'react-native-reanimated';
import { ClayField, ClayList, ClayListRow, Icon3D } from '../../components/clay';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { regloApi } from '../../services/regloApi';
import { useSession } from '../../context/SessionContext';
import {
  formatBirthDate,
  formatPhone,
  isValidEmail,
  useFirstAccess,
} from './FirstAccessContext';
import { FirstAccessStepScreen, fadeIn } from './FirstAccessStepScreen';

const KEY_ART = require('../../../assets/web/3d/chiave-3d.png');
const CAR_ART = require('../../../assets/icons3d-ai/auto.png');

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/** 1 · Numero di telefono: se c'è un allievo da attivare, si parte. */
export function FirstAccessPhoneStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const { update } = useFirstAccess();
  const [phone, setPhone] = useState(params.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, '');

  const submit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const start = await regloApi.firstAccessStart(phone.trim());
      update({ start, firstName: start.firstName, lastName: start.lastName });
      router.push('/(auth)/first-access/name');
    } catch (err) {
      setError(errorText(err, 'Non riusciamo a verificare il numero. Riprova.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FirstAccessStepScreen
      step="index"
      hero={<Icon3D source={KEY_ART} size={72} />}
      title="Primo accesso"
      subtitle="La tua autoscuola ti ha già iscritto. Scrivi il numero di telefono che le hai lasciato."
      cta="Continua"
      ctaDisabled={digits.length < 8}
      loading={loading}
      onCta={submit}
      error={error}
    >
      <ClayField
        label="Numero di telefono"
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          if (error) setError(null);
        }}
        placeholder="333 123 4567"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        hint="Per un numero estero scrivi anche il prefisso, es. +41."
        testID="first-access-phone"
      />
    </FirstAccessStepScreen>
  );
}

/** 2 · Ciao! Nome e cognome, già scritti dall'autoscuola: si confermano. */
export function FirstAccessNameStep() {
  const router = useRouter();
  const { draft, update } = useFirstAccess();
  const lastNameRef = useRef<TextInput>(null);
  const ok = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;
  const greeting = draft.start?.firstName ? `Ciao ${draft.start.firstName}` : 'Ciao';
  const school = draft.start?.companyName;

  return (
    <FirstAccessStepScreen
      step="name"
      title={greeting}
      subtitle={
        school
          ? `${school} ti ha iscritto a Reglo. Controlla che nome e cognome siano giusti.`
          : 'Controlla che nome e cognome siano giusti.'
      }
      cta="Continua"
      ctaDisabled={!ok}
      onCta={() => router.push('/(auth)/first-access/email')}
    >
      <ClayField
        label="Nome"
        value={draft.firstName}
        onChangeText={(firstName) => update({ firstName })}
        autoCapitalize="words"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
        testID="first-access-first-name"
      />
      <ClayField
        ref={lastNameRef}
        label="Cognome"
        value={draft.lastName}
        onChangeText={(lastName) => update({ lastName })}
        autoCapitalize="words"
        textContentType="familyName"
        returnKeyType="done"
        testID="first-access-last-name"
      />
    </FirstAccessStepScreen>
  );
}

/** 3 · Email, obbligatoria: serve per recuperare la password. */
export function FirstAccessEmailStep() {
  const router = useRouter();
  const { draft, update } = useFirstAccess();
  const [touched, setTouched] = useState(false);
  const valid = isValidEmail(draft.email);

  return (
    <FirstAccessStepScreen
      step="email"
      title="La tua email"
      subtitle="Ti serve per recuperare la password e per ricevere le comunicazioni dell'autoscuola."
      cta="Continua"
      ctaDisabled={!valid}
      onCta={() => router.push('/(auth)/first-access/password')}
    >
      <ClayField
        label="Email"
        value={draft.email}
        onChangeText={(email) => update({ email })}
        onBlur={() => setTouched(true)}
        placeholder="nome@email.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        autoFocus
        returnKeyType="next"
        onSubmitEditing={() => valid && router.push('/(auth)/first-access/password')}
        error={touched && draft.email.trim() && !valid ? "Controlla l'email: non sembra valida." : null}
        testID="first-access-email"
      />
    </FirstAccessStepScreen>
  );
}

/** 4 · Password sua, obbligatoria. */
export function FirstAccessPasswordStep() {
  const router = useRouter();
  const { draft, update } = useFirstAccess();
  const [visible, setVisible] = useState(false);
  const ok = draft.password.length >= 6;

  return (
    <FirstAccessStepScreen
      step="password"
      title="Scegli una password"
      subtitle="Con il tuo numero e questa password entrerai nell'app le prossime volte."
      cta="Continua"
      ctaDisabled={!ok}
      onCta={() => router.push('/(auth)/first-access/birth')}
    >
      <View>
        <ClayField
          label="Password"
          value={draft.password}
          onChangeText={(password) => update({ password })}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
          autoFocus
          placeholder="Almeno 6 caratteri"
          returnKeyType="next"
          onSubmitEditing={() => ok && router.push('/(auth)/first-access/birth')}
          testID="first-access-password"
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          style={s.reveal}
          accessibilityRole="button"
        >
          <Text style={s.revealText}>{visible ? 'Nascondi' : 'Mostra'}</Text>
        </Pressable>
      </View>
      <Text style={s.note}>
        {ok ? 'Perfetto.' : `Ancora ${Math.max(0, 6 - draft.password.length)} caratteri.`}
      </Text>
    </FirstAccessStepScreen>
  );
}

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
};

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** 5 · Data di nascita: ruota nativa su iOS, calendario nativo su Android. */
export function FirstAccessBirthStep() {
  const router = useRouter();
  const { draft, update } = useFirstAccess();
  const [androidOpen, setAndroidOpen] = useState(false);
  const value = draft.birthDate ? new Date(`${draft.birthDate}T12:00:00`) : yearsAgo(18);

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setAndroidOpen(false);
    if (event.type === 'dismissed' || !date) return;
    update({ birthDate: toIso(date) });
  };

  return (
    <FirstAccessStepScreen
      step="birth"
      title="La tua data di nascita"
      subtitle="La data di nascita serve all'autoscuola per la tua pratica."
      cta="Continua"
      ctaDisabled={!draft.birthDate}
      onCta={() => router.push('/(auth)/first-access/confirm')}
    >
      {Platform.OS === 'ios' ? (
        <View style={s.wheel}>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            locale="it-IT"
            maximumDate={yearsAgo(14)}
            minimumDate={yearsAgo(100)}
            onChange={onChange}
            themeVariant="light"
            testID="first-access-birth"
          />
        </View>
      ) : (
        <>
          <Pressable onPress={() => setAndroidOpen(true)} style={[s.dateField, CLAY_SHADOW.sink]}>
            <Text style={draft.birthDate ? s.dateValue : s.datePlaceholder}>
              {draft.birthDate ? formatBirthDate(draft.birthDate) : 'Scegli la data'}
            </Text>
          </Pressable>
          {androidOpen ? (
            <DateTimePicker
              value={value}
              mode="date"
              maximumDate={yearsAgo(14)}
              minimumDate={yearsAgo(100)}
              onChange={onChange}
            />
          ) : null}
        </>
      )}
      {draft.birthDate && Platform.OS === 'ios' ? (
        <Animated.Text entering={fadeIn} style={s.note}>
          {formatBirthDate(draft.birthDate)}
        </Animated.Text>
      ) : null}
    </FirstAccessStepScreen>
  );
}

/** 6 · Riepilogo, poi si entra. */
export function FirstAccessConfirmStep() {
  const router = useRouter();
  const { applyAuthPayload } = useSession();
  const { draft } = useFirstAccess();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  const submit = async () => {
    if (loading || !draft.start || !draft.birthDate) return;
    setError(null);
    setLoading(true);
    try {
      const payload = await regloApi.firstAccessComplete({
        activationToken: draft.start.activationToken,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        password: draft.password,
        birthDate: draft.birthDate,
      });
      // Il momento caldo: un attimo di benvenuto, poi l'app.
      setWelcome(true);
      setTimeout(() => {
        applyAuthPayload(payload).catch(() => undefined);
      }, 1400);
    } catch (err) {
      setError(errorText(err, 'Non siamo riusciti a salvare i tuoi dati. Riprova.'));
      setLoading(false);
    }
  };

  if (welcome) {
    return (
      <View style={s.welcome} testID="first-access-welcome">
        <Animated.View entering={fadeIn} style={s.welcomeInner}>
          <Icon3D source={CAR_ART} size={96} />
          <Text style={s.welcomeTitle}>Eccoti, {draft.firstName.trim()}</Text>
          <Text style={s.welcomeSub}>
            {draft.start?.companyName ? `${draft.start.companyName} ti aspetta.` : 'Si parte.'}
          </Text>
        </Animated.View>
      </View>
    );
  }

  const go = (path: '/(auth)/first-access/name' | '/(auth)/first-access/email' | '/(auth)/first-access/birth') =>
    router.navigate(path);

  return (
    <FirstAccessStepScreen
      step="confirm"
      title="Tutto giusto?"
      subtitle="Controlla i tuoi dati. Potrai cambiarli anche dopo, dal profilo."
      cta="Conferma ed entra"
      loading={loading}
      onCta={submit}
      error={error}
    >
      <ClayList>
        <ClayListRow
          title={`${draft.firstName.trim()} ${draft.lastName.trim()}`}
          subtitle="Nome e cognome"
          onPress={() => go('/(auth)/first-access/name')}
        />
        <ClayListRow
          title={draft.email.trim()}
          subtitle="Email"
          onPress={() => go('/(auth)/first-access/email')}
        />
        <ClayListRow
          title={draft.start ? formatPhone(draft.start.phone) : ''}
          subtitle="Telefono per accedere"
          chevron={false}
        />
        <ClayListRow
          title={draft.birthDate ? formatBirthDate(draft.birthDate) : ''}
          subtitle="Data di nascita"
          onPress={() => go('/(auth)/first-access/birth')}
        />
      </ClayList>
    </FirstAccessStepScreen>
  );
}

const s = StyleSheet.create({
  reveal: { position: 'absolute', right: 16, top: 38, height: 34, justifyContent: 'center' },
  revealText: { fontSize: 14, fontWeight: '600', color: CLAY.ink },
  note: { fontSize: 14, color: CLAY.ink3, paddingHorizontal: 2 },
  wheel: { alignItems: 'center', marginHorizontal: -8 },
  dateField: { height: 50, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 16, justifyContent: 'center' },
  dateValue: { fontSize: 16, fontWeight: '500', color: CLAY.ink },
  datePlaceholder: { fontSize: 16, color: CLAY.ink4 },
  welcome: { flex: 1, backgroundColor: CLAY.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  welcomeInner: { alignItems: 'center' },
  welcomeTitle: { fontSize: 30, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, marginTop: 22, textAlign: 'center' },
  welcomeSub: { fontSize: 16, color: CLAY.ink3, marginTop: 8, textAlign: 'center' },
});
