import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/components/tabBarSpace';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

/** REG-786: tab «Scambi» dell'allievo. */
// REG-800: su iOS (barra nativa) le pagine a schermo pieno si tengono lo spazio della barra.
const STACK_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: colors.background } };

export default function SwapsLayout() {
  const stackOptions = useTabStackOptions('swaps', STACK_OPTIONS);
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="swap-detail" options={FORM_SHEET} />
      <Stack.Screen name="credits-needed" options={FORM_SHEET} />
      <Stack.Screen name="leave-lesson" options={FORM_SHEET} />
    </Stack>
  );
}
