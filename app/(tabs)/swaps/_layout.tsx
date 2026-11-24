import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET, TALL_SHEET } from '../../../src/utils/sheetPresentation';

/** REG-786: tab «Scambi» dell'allievo. */
export default function SwapsLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="swap-detail" options={TALL_SHEET} />
      <Stack.Screen name="credits-needed" options={FORM_SHEET} />
    </Stack>
  );
}
