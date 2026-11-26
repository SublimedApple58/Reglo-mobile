import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/components/tabBarSpace';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

// REG-800: su iOS (barra nativa) le pagine a schermo pieno si tengono lo spazio della barra.
const STACK_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } };

export default function RoleLayout() {
  const stackOptions = useTabStackOptions('role', STACK_OPTIONS);
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      {/* REG-639 clay: i fogli della Disponibilità sono tutti form sheet (§13.2). */}
      <Stack.Screen name="availability-exception" options={FORM_SHEET} />
      <Stack.Screen name="publish-day" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      {/* REG-705c: «Luogo della fascia» dagli editor di disponibilità di questo stack. */}
      <Stack.Screen name="select-options" options={FORM_SHEET} />
      <Stack.Screen name="select-options-long" options={FORM_SHEET} />
    </Stack>
  );
}
