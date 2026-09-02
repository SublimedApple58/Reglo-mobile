import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, PAGE_SHEET, SCROLL_SHEET } from '../../../src/utils/sheetPresentation';

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
      {/* REG-426: il pannello "per percorso" espande il form oltre l'altezza del
          contenuto → serve una sheet a detent fisso che scrolla (TALL_SHEET su
          iOS è fitToContents e taglia l'overflow). SCROLL_SHEET mantiene il look
          "card" e scrolla su entrambe le piattaforme (con SheetScaffold fill). */}
      <Stack.Screen name="booking-rules" options={SCROLL_SHEET} />
      <Stack.Screen name="limits" options={TALL_SHEET} />
      <Stack.Screen name="extras" options={TALL_SHEET} />
    </Stack>
  );
}
