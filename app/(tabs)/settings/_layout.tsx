import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, SCROLL_SHEET } from '../../../src/utils/sheetPresentation';

export default function SettingsLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile-edit" options={TALL_SHEET} />
      {/* Firma: fullscreen vero (UI ruotata in landscape), niente sheet/card */}
      <Stack.Screen name="signature" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      {/* REG-451: associazione all'istruttore (QR / codice a mano), a tutto schermo come il prototipo */}
      <Stack.Screen name="associa-istruttore" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="availability" options={TALL_SHEET} />
      <Stack.Screen name="le-tue-guide" options={SCROLL_SHEET} />
      <Stack.Screen name="time-picker" options={HUG_SHEET} />
    </Stack>
  );
}
