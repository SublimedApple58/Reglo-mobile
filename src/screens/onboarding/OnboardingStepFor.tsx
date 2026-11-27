import React from 'react';
import type { OnboardingStepKey } from '../../types/regloApi';
import { OnboardingAvailabilityStep } from './OnboardingAvailabilityStep';
import { OnboardingPhoneStep } from './OnboardingPhoneStep';

/** Lo schermo di uno step (usato dalla radice dello stack per il primo passo). */
export function OnboardingStepFor({ step }: { step: OnboardingStepKey | undefined }) {
  switch (step) {
    case 'phone':
      return <OnboardingPhoneStep />;
    case 'availability':
      return <OnboardingAvailabilityStep />;
    default:
      return null;
  }
}
