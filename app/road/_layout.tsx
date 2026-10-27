import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../src/utils/sheetPresentation';

/**
 * REG-638 Reglo Road — modalità a tutto schermo, fuori dalle tab: con una
 * sessione Road attiva l'app intera è questo stack (RoadController instrada).
 */
export default function RoadLayout() {
  return (
    <Stack
      screenListeners={sheetScreenListeners}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F1EA' } }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'fade' }} />
      {/* Tutti i fogli di Road: FORM_SHEET + <FormSheet> (design-system §13.2).
          Si chiudono solo con la X; il riepilogo esce da Road. */}
      <Stack.Screen name="segnala" options={FORM_SHEET} />
      <Stack.Screen name="pagellino" options={FORM_SHEET} />
      <Stack.Screen name="riepilogo" options={FORM_SHEET} />
    </Stack>
  );
}
