import React, { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { PhoneField, phoneIsComplete } from '../../components/PhoneField';
import { FirstAccessStepScreen, useFocusAfterPush } from '../firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './OnboardingExit';
import { useOnboarding } from './OnboardingContext';

/**
 * REG-802 · Il tuo numero di cellulare. Rifà il vecchio PhoneGate (CTA che
 * volava via con la tastiera, prefisso fisso, grigi e gradienti) sullo
 * scheletro del Primo accesso: la CTA sale con la tastiera, il fuoco arriva a
 * schermata ferma, il prefisso si sceglie dal foglio «Prefisso».
 *
 * Da solo (allievo senza cellulare) salva subito; dentro il primo accesso
 * normale passa al passo dopo e si salva tutto alla fine. L'icona 3D del
 * telefono arriverà con la generazione su Gemini (piano REG-802 §5).
 */
export function OnboardingPhoneStep() {
  const { steps, hasConfirm, draft, update, next, positionOf, isFirst, submitting, submitError, clearSubmitError } =
    useOnboarding();
  const phoneRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusAfterPush(phoneRef);
  // L'errore del salvataggio finale si mostra qui solo se è questo passo a salvare.
  const savesHere = !hasConfirm && steps[steps.length - 1]?.key === 'phone';
  const shownError = error ?? (savesHere ? submitError : null);

  return (
    <FirstAccessStepScreen
      progress={positionOf('phone')}
      leading={isFirst('phone') ? 'none' : 'back'}
      title="Il tuo numero di cellulare"
      subtitle="Serve alla tua autoscuola per avvisarti delle guide e dei posti che si liberano."
      cta="Continua"
      ctaDisabled={!phoneIsComplete(draft.phone)}
      loading={submitting}
      onCta={() => {
        setError(null);
        next('phone').catch(() => undefined);
      }}
      revealKey={shownError}
      below={<OnboardingExit />}
    >
      <PhoneField
        ref={phoneRef}
        label="Numero di cellulare"
        value={draft.phone}
        onChange={(phone) => {
          update({ phone });
          if (shownError) {
            setError(null);
            clearSubmitError();
          }
        }}
        error={shownError}
        reserveErrorSpace
        pickerHref="/onboarding/country-picker"
        testID="onboarding-phone"
      />
    </FirstAccessStepScreen>
  );
}
