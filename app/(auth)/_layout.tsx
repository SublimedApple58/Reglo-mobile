import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../src/utils/sheetPresentation';

export default function AuthLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      {/* iOS: native content-hugging form sheet for the login form. */}
      <Stack.Screen
        name="login-sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      {/* iOS: native content-hugging form sheet for the password-reset flow. */}
      <Stack.Screen
        name="password-reset-sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      {/* «Primo accesso»: stack a schermo intero, un passo per schermata. Fondo
          bianco dichiarato: dietro lo stack annidato non deve mai spuntare il
          grigio del tema durante il push. */}
      <Stack.Screen name="first-access" options={{ contentStyle: { backgroundColor: '#FFFFFF' } }} />
      {/* «Prefisso» del campo telefono (`PhoneField`): form sheet con ricerca. */}
      <Stack.Screen name="country-picker" options={FORM_SHEET} />
      {/* Android: full navy inline password-reset screen. */}
      <Stack.Screen name="password-reset" options={{ headerShown: false }} />
      {/* iOS: native page sheet for the (longer, scrollable) signup form. */}
      <Stack.Screen
        name="signup"
        options={Platform.OS === 'ios' ? { presentation: 'modal', headerShown: false } : { headerShown: false }}
      />
    </Stack>
  );
}
