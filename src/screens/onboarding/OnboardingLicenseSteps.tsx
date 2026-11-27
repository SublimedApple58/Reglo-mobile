import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ClayList, ClayListRow, Icon3D } from '../../components/clay';
import { CLAY } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import type { LicenseCategory, Transmission } from '../../types/regloApi';
import { STUDENT_LICENSE_CATEGORIES, TRANSMISSIONS, isMotoLicenseCategory } from '../../utils/license';
import { FirstAccessStepScreen, fadeIn, fadeOut } from '../firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './OnboardingExit';
import { useOnboarding } from './OnboardingContext';

const CAR_ART = require('../../../assets/icons3d-ai/auto.png');
const MOTO_ART = require('../../../assets/icons3d-ai/moto.png');

/**
 * Come si presenta ogni patente all'allievo: la sigla che conosce («Patente
 * B») e il mezzo. `AMQ` è una sigla nostra: per lui è la AM della microcar.
 */
const LICENSE_COPY: Record<string, { title: string; subtitle: string }> = {
  B: { title: 'Patente B', subtitle: 'Auto' },
  AMQ: { title: 'Patente AM', subtitle: 'Microcar' },
  B1: { title: 'Patente B1', subtitle: 'Quadriciclo pesante' },
  AM: { title: 'Patente AM', subtitle: 'Ciclomotore' },
  A1: { title: 'Patente A1', subtitle: 'Moto 125' },
  A2: { title: 'Patente A2', subtitle: 'Moto di media potenza' },
  A: { title: 'Patente A', subtitle: 'Moto senza limiti' },
};

const TRANSMISSION_COPY: Record<Transmission, { title: string; subtitle: string }> = {
  manual: { title: 'Manuale', subtitle: 'Con la frizione' },
  automatic: { title: 'Automatico', subtitle: 'Senza frizione' },
};

const artFor = (category: LicenseCategory | null) => (isMotoLicenseCategory(category) ? MOTO_ART : CAR_ART);

/** Spunta della riga scelta: entra ed esce in dissolvenza, il posto resta (niente salti). */
function Check({ on }: { on: boolean }) {
  return (
    <View style={s.check}>
      {on ? (
        <Animated.View entering={fadeIn} exiting={fadeOut}>
          <Ionicons name="checkmark" size={22} color={CLAY.ink} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * REG-812 · Che patente fai? Era il blocco REG-410 dentro le tab (fondo grigio,
 * gradienti, etichetta «obbligatorio»): ora è uno step dell'onboarding, prima
 * delle disponibilità, sullo scheletro del Primo accesso. Una domanda per
 * schermata: qui la patente, al passo dopo il cambio.
 */
export function OnboardingLicenseStep() {
  const router = useRouter();
  const { draft, update, positionOf, isFirst } = useOnboarding();
  const first = isFirst('license');

  return (
    <FirstAccessStepScreen
      progress={positionOf('license')}
      leading={first ? 'none' : 'back'}
      hero={<Icon3D source={VITA_ART.volante} size={64} />}
      title="Che patente fai?"
      subtitle="Serve alla tua autoscuola per organizzare le guide."
      cta="Continua"
      ctaDisabled={!draft.licenseCategory}
      onCta={() => router.push('/onboarding/transmission')}
      below={first ? <OnboardingExit /> : undefined}
    >
      <ClayList>
        {STUDENT_LICENSE_CATEGORIES.map((category) => {
          const copy = LICENSE_COPY[category] ?? { title: `Patente ${category}`, subtitle: '' };
          const on = draft.licenseCategory === category;
          return (
            <ClayListRow
              key={category}
              leading={<Icon3D source={artFor(category)} size={40} width={48} />}
              title={copy.title}
              subtitle={copy.subtitle}
              trailing={<Check on={on} />}
              chevron={false}
              onPress={() => update({ licenseCategory: category })}
              testID={`license-${category}`}
            />
          );
        })}
      </ClayList>
    </FirstAccessStepScreen>
  );
}

/** REG-812 · Cambio manuale o automatico? Ultimo pezzo del percorso patente: da qui si va avanti (o si salva). */
export function OnboardingTransmissionStep() {
  const { steps, draft, update, next, positionOf, submitting, submitError, clearSubmitError } = useOnboarding();
  // L'errore del salvataggio finale si mostra qui solo se è questo passo a salvare.
  const savesHere = steps[steps.length - 1]?.key === 'license';

  return (
    <FirstAccessStepScreen
      progress={positionOf('license')}
      hero={<Icon3D source={artFor(draft.licenseCategory)} size={64} width={78} />}
      title="Cambio manuale o automatico?"
      subtitle="Se non lo sai ancora, scegli manuale: la tua autoscuola può cambiarlo."
      cta="Continua"
      ctaDisabled={!draft.transmission}
      loading={savesHere && submitting}
      onCta={() => next('license').catch(() => undefined)}
      error={savesHere ? submitError : null}
    >
      <ClayList>
        {TRANSMISSIONS.map((transmission) => (
          <ClayListRow
            key={transmission}
            title={TRANSMISSION_COPY[transmission].title}
            subtitle={TRANSMISSION_COPY[transmission].subtitle}
            trailing={<Check on={draft.transmission === transmission} />}
            chevron={false}
            onPress={() => {
              update({ transmission });
              if (submitError) clearSubmitError();
            }}
            testID={`transmission-${transmission}`}
          />
        ))}
      </ClayList>
    </FirstAccessStepScreen>
  );
}

const s = StyleSheet.create({
  check: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
