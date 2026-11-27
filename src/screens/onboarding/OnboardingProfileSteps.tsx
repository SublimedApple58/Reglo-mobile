import React, { useRef } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ClayButton, ClayField, ClayList, ClayListRow, Icon3D } from '../../components/clay';
import { useSession } from '../../context/SessionContext';
import { CLAY } from '../../theme/clay';
import { phoneSubmitValue } from '../../components/PhoneField';
import { activeDays, daysListText } from '../../utils/studentAvailability';
import { formatPhone } from '../firstAccess/FirstAccessContext';
import { FirstAccessStepScreen, fadeIn } from '../firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './OnboardingExit';
import { useOnboarding } from './OnboardingContext';

const CAR_ART = require('../../../assets/icons3d-ai/auto.png');

/** Supporto Reglo per cambiare l'email (decisione di Tiziano, REG-802 §10). */
const SUPPORT_WHATSAPP = '393477756855';
const SUPPORT_EMAIL = 'support@reglo.it';

const useSchoolName = () => {
  const { companies, activeCompanyId } = useSession();
  return companies.find((c) => c.id === activeCompanyId)?.name ?? null;
};

/** 1 · «Ciao Sara»: nome e cognome scritti dall'autoscuola, da confermare. */
export function OnboardingNameStep() {
  const { draft, update, next, positionOf, isFirst } = useOnboarding();
  const school = useSchoolName();
  const lastNameRef = useRef<TextInput>(null);
  const ok = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;
  const first = isFirst('name');

  return (
    <FirstAccessStepScreen
      progress={positionOf('name')}
      leading={first ? 'none' : 'back'}
      title={draft.firstName.trim() ? `Ciao ${draft.firstName.trim()}` : 'Ciao'}
      subtitle={
        school
          ? `${school} ti ha iscritto a Reglo. Controlla che nome e cognome siano giusti.`
          : 'Controlla che nome e cognome siano giusti.'
      }
      cta="Continua"
      ctaDisabled={!ok}
      onCta={() => next('name').catch(() => undefined)}
      below={first ? <OnboardingExit /> : undefined}
    >
      <ClayField
        label="Nome"
        value={draft.firstName}
        onChangeText={(firstName) => update({ firstName })}
        autoCapitalize="words"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
        testID="onboarding-first-name"
      />
      <ClayField
        ref={lastNameRef}
        label="Cognome"
        value={draft.lastName}
        onChangeText={(lastName) => update({ lastName })}
        autoCapitalize="words"
        textContentType="familyName"
        returnKeyType="done"
        testID="onboarding-last-name"
      />
    </FirstAccessStepScreen>
  );
}

/**
 * 2 · La tua email: quella dell'account, scelta dall'autoscuola. Non si cambia
 * da qui: «Scrivici su WhatsApp» apre una chat col supporto Reglo con il
 * messaggio già scritto (mail come ripiego se WhatsApp non c'è).
 */
export function OnboardingEmailStep() {
  const { user } = useSession();
  const { draft, next, positionOf, isFirst } = useOnboarding();
  const school = useSchoolName();
  const email = user?.email ?? '';
  const first = isFirst('email');

  const contactSupport = async () => {
    const who = [`${draft.firstName} ${draft.lastName}`.trim(), school ? `(${school})` : null].filter(Boolean).join(' ');
    const text = `Ciao, sono ${who}. Vorrei cambiare l'email del mio account Reglo: ${email} → `;
    const wa = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
    const mail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Cambio email account Reglo')}&body=${encodeURIComponent(text)}`;
    const hasWhatsApp = await Linking.canOpenURL('whatsapp://send').catch(() => false);
    Linking.openURL(hasWhatsApp ? wa : mail).catch(() => Linking.openURL(mail).catch(() => undefined));
  };

  return (
    <FirstAccessStepScreen
      progress={positionOf('email')}
      leading={first ? 'none' : 'back'}
      title="La tua email"
      subtitle="È quella con cui accedi. Ti serve anche per recuperare la password."
      cta="Continua"
      onCta={() => next('email').catch(() => undefined)}
      below={first ? <OnboardingExit /> : undefined}
    >
      <ClayList>
        <ClayListRow
          leading={
            <View style={s.mailIcon}>
              <Ionicons name="mail-outline" size={20} color={CLAY.ink} />
            </View>
          }
          title={email}
          subtitle="Scelta dalla tua autoscuola"
          trailing={<Ionicons name="lock-closed-outline" size={17} color={CLAY.chevron} />}
          testID="onboarding-email"
        />
      </ClayList>
      <View style={s.change}>
        <Text style={s.changeText}>Non è la tua o vuoi cambiarla?</Text>
        <ClayButton
          title="Scrivici su WhatsApp"
          variant="secondary"
          compact
          leading={<Ionicons name="logo-whatsapp" size={18} color={CLAY.ink} />}
          onPress={contactSupport}
          style={s.changeButton}
          testID="onboarding-email-change"
        />
      </View>
    </FirstAccessStepScreen>
  );
}

/** Ultimo passo del primo accesso normale: riepilogo, poi «Eccoti». */
export function OnboardingConfirmStep() {
  const router = useRouter();
  const { user } = useSession();
  const school = useSchoolName();
  const { steps, draft, submit, submitting, submitError, positionOf, welcomeName } = useOnboarding();
  const keys = steps.map((st) => st.key);

  if (welcomeName !== null) {
    return (
      <View style={s.welcome} testID="onboarding-welcome">
        <Animated.View entering={fadeIn} style={s.welcomeInner}>
          <Icon3D source={CAR_ART} size={96} />
          <Text style={s.welcomeTitle}>Eccoti, {welcomeName}</Text>
          <Text style={s.welcomeSub}>{school ? `${school} ti aspetta.` : 'Si parte.'}</Text>
        </Animated.View>
      </View>
    );
  }

  const go = (href: Href) => router.navigate(href);
  const n = activeDays(draft.days ?? {}).length;

  return (
    <FirstAccessStepScreen
      progress={positionOf('confirm')}
      title="Tutto giusto?"
      subtitle="Controlla i tuoi dati. Potrai cambiarli anche dopo, dal profilo."
      cta="Conferma ed entra"
      loading={submitting}
      onCta={() => submit().catch(() => undefined)}
      error={submitError}
    >
      <ClayList>
        {keys.includes('name') ? (
          <ClayListRow
            title={`${draft.firstName.trim()} ${draft.lastName.trim()}`}
            subtitle="Nome e cognome"
            onPress={() => go('/onboarding/name')}
          />
        ) : null}
        {keys.includes('email') ? (
          <ClayListRow title={user?.email ?? ''} subtitle="Email" onPress={() => go('/onboarding/email')} />
        ) : null}
        {keys.includes('phone') ? (
          <ClayListRow
            title={formatPhone(phoneSubmitValue(draft.phone))}
            subtitle="Cellulare"
            onPress={() => go('/onboarding/phone')}
          />
        ) : null}
        {keys.includes('availability') ? (
          <ClayListRow
            title={daysListText(draft.days ?? {}) ?? 'Da configurare'}
            subtitle={n ? `Disponibilità · ${n} ${n === 1 ? 'giorno' : 'giorni'}` : 'Disponibilità'}
            onPress={() => go('/onboarding/availability')}
          />
        ) : null}
      </ClayList>
    </FirstAccessStepScreen>
  );
}

const s = StyleSheet.create({
  mailIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  change: { marginTop: 8, gap: 12 },
  changeText: { fontSize: 15, lineHeight: 20, color: CLAY.ink3, paddingHorizontal: 2 },
  changeButton: { alignSelf: 'flex-start' },
  welcome: { flex: 1, backgroundColor: CLAY.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  welcomeInner: { alignItems: 'center' },
  welcomeTitle: { fontSize: 30, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, marginTop: 22, textAlign: 'center' },
  welcomeSub: { fontSize: 16, color: CLAY.ink3, marginTop: 8, textAlign: 'center' },
});
