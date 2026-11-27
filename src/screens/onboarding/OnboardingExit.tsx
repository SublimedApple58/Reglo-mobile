import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSession } from '../../context/SessionContext';
import { CLAY } from '../../theme/clay';

/**
 * «Esci» discreto sotto la CTA di un onboarding bloccante: l'unica altra uscita
 * oltre a completare (come il vecchio PhoneGate). Chiede conferma.
 */
export function OnboardingExit() {
  const { signOut } = useSession();
  const confirm = () =>
    Alert.alert("Esci dall'account", 'Vuoi davvero uscire?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => signOut().catch(() => undefined) },
    ]);
  return (
    <Pressable
      onPress={confirm}
      hitSlop={12}
      style={({ pressed }) => [s.wrap, pressed && s.pressed]}
      accessibilityRole="button"
      testID="onboarding-exit"
    >
      <Text style={s.text}>Esci</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  pressed: { opacity: 0.5 },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: CLAY.ink3 },
});
