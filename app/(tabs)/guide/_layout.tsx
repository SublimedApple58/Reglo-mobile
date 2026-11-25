import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET, TALL_SHEET } from '../../../src/utils/sheetPresentation';

/** REG-786: tab «Guide» dell'allievo. I dettagli sono fogli; le note una pagina. */
export default function GuideLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* Guida fatta (D1/D2): form sheet alto quanto il contenuto, senza grabber. */}
      <Stack.Screen name="lesson" options={FORM_SHEET} />
      {/* Guida in arrivo e posto di gruppo: gli stessi fogli della home. */}
      <Stack.Screen name="lesson-detail" options={FORM_SHEET} />
      <Stack.Screen name="group-lesson-detail" options={TALL_SHEET} />
      <Stack.Screen name="notes" />
      {/* REG-791: «In programma», pagina push. */}
      <Stack.Screen name="upcoming" />
      <Stack.Screen name="road-map" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}
