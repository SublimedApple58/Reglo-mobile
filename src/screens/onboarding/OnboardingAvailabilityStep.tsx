import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ClayButton, Icon3D } from '../../components/clay';
import { useGuidedAvailability } from '../../components/studentAvailability/StudentAvailabilityGuided';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { VITA_ART } from '../../theme/vitaArt';
import { DEFAULT_BANDS, hasAnyBand } from '../../utils/studentAvailability';
import { FirstAccessStepScreen, fadeIn } from '../firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './OnboardingExit';
import { errorText, useOnboarding } from './OnboardingContext';

/**
 * REG-802 · Quando puoi fare guida? Fasce per giorno (mattina, pomeriggio,
 * sera). Non sono vincoli: servono a mandargli i posti liberi adatti.
 *
 * - In fase guide è bloccante: si esce solo salvando (o con «Esci» se è
 *   l'unico passo).
 * - Prima della fase guide è rimandabile: «Configura in seguito» (e la X, se è
 *   l'unico passo) lo rinvia di qualche giorno lato server.
 *
 * La scelta è GUIDATA, un giorno alla volta (giro 3, Tiziano 27/11): vedi
 * `useGuidedAvailability`. Il Profilo tiene l'editor completo.
 *
 * Le disponibilità già salvate (le righe vecchie arrivano già tradotte in
 * fasce) e le fasce possibili le legge il provider all'apertura dell'onboarding.
 */
export function OnboardingAvailabilityStep() {
  const { setOnboarding } = useSession();
  const {
    steps,
    hasConfirm,
    draft,
    update,
    next,
    positionOf,
    isFirst,
    stepOf,
    submitting,
    submitError,
    availabilityLoaded,
  } = useOnboarding();
  const required = stepOf('availability')?.required ?? true;
  const only = steps.length === 1;
  const first = isFirst('availability');
  const loaded = availabilityLoaded;
  const [snoozing, setSnoozing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = draft.days ?? {};
  const bands = draft.bands ?? DEFAULT_BANDS;
  const guided = useGuidedAvailability({
    days,
    bands,
    onChange: (nextDays) => update({ days: nextDays }),
    dayHref: '/onboarding/student-day',
    ready: loaded,
  });

  const snooze = async () => {
    if (snoozing) return;
    setError(null);
    setSnoozing(true);
    try {
      await regloApi.snoozeMyAvailability();
      if (only) {
        setOnboarding(null);
      } else {
        await next('availability', { days: null });
      }
    } catch (err) {
      setError(errorText(err, 'Non siamo riusciti a rimandare. Riprova.'));
    } finally {
      setSnoozing(false);
    }
  };

  const savesHere = !hasConfirm && steps[steps.length - 1]?.key === 'availability';
  const shownError = error ?? (savesHere ? submitError : null);

  return (
    <FirstAccessStepScreen
      progress={positionOf('availability')}
      leading={first ? 'none' : 'back'}
      onClose={!required && only ? snooze : undefined}
      hero={<Icon3D source={VITA_ART.orologio} size={64} />}
      title="Quando puoi fare guida?"
      subtitle="Non è un impegno: puoi sempre prenotare anche in altri orari. Ci serve per avvisarti quando si libera un posto adatto a te."
      cta={guided.ctaTitle ?? 'Continua'}
      revealKey={guided.revealKey}
      ctaDisabled={!loaded || snoozing || (guided.overview && !hasAnyBand(days))}
      loading={submitting}
      onCta={() => {
        if (!guided.overview) return guided.advance();
        setError(null);
        next('availability', { days }).catch(() => undefined);
      }}
      error={shownError}
      below={
        !required ? (
          <ClayButton
            title="Configura in seguito"
            variant="secondary"
            onPress={snooze}
            loading={snoozing}
            disabled={submitting}
            testID="onboarding-availability-later"
          />
        ) : first ? (
          <OnboardingExit />
        ) : undefined
      }
    >
      {loaded ? (
        <Animated.View entering={fadeIn}>{guided.body}</Animated.View>
      ) : (
        <View style={s.placeholder} />
      )}
    </FirstAccessStepScreen>
  );
}

const s = StyleSheet.create({
  // Stessa altezza della settimana, così il caricamento non fa saltare la CTA.
  placeholder: { height: 190 },
});
