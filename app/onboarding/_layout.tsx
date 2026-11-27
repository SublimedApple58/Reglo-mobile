import React from 'react';
import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/screens/onboarding/OnboardingContext';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../src/utils/sheetPresentation';

/**
 * REG-802 — onboarding dell'allievo a sessione aperta (primo accesso normale,
 * cellulare, disponibilità). Uno step per schermata, push e swipe indietro
 * nativi, dati condivisi nel provider. L'AuthGate porta qui finché `/me` ha
 * degli step e riporta alla home quando non ce ne sono più. Fondo bianco
 * dichiarato: dietro lo stack non deve spuntare il grigio del tema.
 * Vedi docs/features/onboarding-allievo.md.
 */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenListeners={sheetScreenListeners}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="name" />
        <Stack.Screen name="email" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="confirm" />
        {/* Foglio di un giorno delle disponibilità. */}
        <Stack.Screen name="student-day" options={FORM_SHEET} />
        {/* «Prefisso» del campo telefono: a sessione aperta deve stare in questo stack. */}
        <Stack.Screen name="country-picker" options={FORM_SHEET} />
      </Stack>
    </OnboardingProvider>
  );
}
