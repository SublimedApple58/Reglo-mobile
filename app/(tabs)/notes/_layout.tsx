import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, PAGE_SHEET } from '../../../src/utils/sheetPresentation';

export default function NotesLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[studentId]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="cluster-settings" />
      <Stack.Screen name="time-picker" options={HUG_SHEET} />
      <Stack.Screen name="select-options" options={HUG_SHEET} />
      <Stack.Screen name="select-options-long" options={PAGE_SHEET} />
      <Stack.Screen name="group-students" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="manage-lesson-details" options={TALL_SHEET} />
      {/* REG-426: il pannello "per percorso" espande il form oltre l'altezza dello
          schermo. Un formSheet a detent (TALL_SHEET/SCROLL_SHEET) ha un pan nativo
          che confligge con lo scroll interno (il contenuto "risale su da solo").
          PAGE_SHEET (presentation:'modal') è il pattern già usato dalle form lunghe
          dell'app (quick-book → BookingForm/BlockForm): page sheet senza detent +
          SheetScaffold fill → scroll nativo pulito. */}
      <Stack.Screen name="booking-rules" options={PAGE_SHEET} />
      <Stack.Screen name="limits" options={TALL_SHEET} />
      <Stack.Screen name="extras" options={TALL_SHEET} />
    </Stack>
  );
}
