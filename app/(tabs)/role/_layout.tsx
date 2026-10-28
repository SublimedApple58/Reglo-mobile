import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

export default function RoleLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="index" />
      {/* REG-639 clay: i fogli della Disponibilità sono tutti form sheet (§13.2). */}
      <Stack.Screen name="availability-exception" options={FORM_SHEET} />
      <Stack.Screen name="publish-day" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      <Stack.Screen name="instructor-invite" options={FORM_SHEET} />
      <Stack.Screen name="instructor-availability" options={FORM_SHEET} />
    </Stack>
  );
}
