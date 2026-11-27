import React from 'react';
import { Stack } from 'expo-router';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';
import { FirstAccessProvider } from '../../../src/screens/firstAccess/FirstAccessContext';

/**
 * «Primo accesso» dell'allievo creato dall'autoscuola col solo telefono:
 * un passo per schermata, push e swipe indietro nativi, dati condivisi nel
 * provider. Vedi docs/features/first-access.md.
 */
export default function FirstAccessLayout() {
  return (
    <FirstAccessProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="name" />
        <Stack.Screen name="email" />
        <Stack.Screen name="password" />
        <Stack.Screen name="birth" />
        <Stack.Screen name="availability" />
        {/* REG-802: foglio di un giorno delle disponibilità. */}
        <Stack.Screen name="student-day" options={FORM_SHEET} />
        <Stack.Screen name="confirm" />
      </Stack>
    </FirstAccessProvider>
  );
}
