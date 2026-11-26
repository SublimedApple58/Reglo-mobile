import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/components/tabBarSpace';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, SCROLL_SHEET } from '../../../src/utils/sheetPresentation';

// REG-800: su iOS (barra nativa) le pagine a schermo pieno si tengono lo spazio della barra.
const STACK_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: colors.background } };

export default function SettingsLayout() {
  const stackOptions = useTabStackOptions('settings', STACK_OPTIONS);
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={stackOptions}>
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
