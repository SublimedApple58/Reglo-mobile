import React from 'react';
import { OnboardingStepFor } from '../../src/screens/onboarding/OnboardingStepFor';
import { useOnboarding } from '../../src/screens/onboarding/OnboardingContext';

/** Radice dello stack: il primo step dovuto (gli altri si aprono con un push). */
export default function OnboardingIndex() {
  const { steps } = useOnboarding();
  return <OnboardingStepFor step={steps[0]?.key} />;
}
