import React from 'react';
import type { OnboardingStepKey } from '../../types/regloApi';
import { OnboardingAvailabilityStep } from './OnboardingAvailabilityStep';
import { OnboardingPhoneStep } from './OnboardingPhoneStep';
import { OnboardingEmailStep, OnboardingNameStep } from './OnboardingProfileSteps';

/** Lo schermo di uno step (usato dalla radice dello stack per il primo passo). */
export function OnboardingStepFor({ step }: { step: OnboardingStepKey | undefined }) {
  switch (step) {
    case 'name':
      return <OnboardingNameStep />;
    case 'email':
      return <OnboardingEmailStep />;
    case 'phone':
      return <OnboardingPhoneStep />;
    case 'availability':
      return <OnboardingAvailabilityStep />;
    default:
      return null;
  }
}
