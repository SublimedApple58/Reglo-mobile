import React from 'react';
import { Stack } from 'expo-router';
import { SignupProvider } from '../../../src/screens/signup/SignupContext';

/**
 * REG-812 — «Registrati come allievo»: un passo per schermata, push e swipe
 * indietro nativi, dati condivisi nel provider. Uguale su iOS e Android.
 * Vedi docs/features/registrazione.md.
 */
export default function SignupLayout() {
  return (
    <SignupProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="school" />
        <Stack.Screen name="name" />
        <Stack.Screen name="email" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="password" />
        <Stack.Screen name="confirm" />
      </Stack>
    </SignupProvider>
  );
}
