import React from 'react';
import { Stack } from 'expo-router';
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
        <Stack.Screen name="confirm" />
      </Stack>
    </FirstAccessProvider>
  );
}
