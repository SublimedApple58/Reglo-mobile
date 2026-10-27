import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { HUG_SHEET, PAGE_SHEET, TALL_SHEET } from '../../src/utils/sheetPresentation';

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
      {/* «Cosa è successo?»: griglia a contenuto fisso → form sheet che abbraccia
          il contenuto (Android: detent alto + SheetScaffold). */}
      <Stack.Screen name="segnala" options={TALL_SHEET} />
      {/* Pagellino: stesso foglio della home (manage-lesson-details), page sheet. */}
      <Stack.Screen name="pagellino" options={PAGE_SHEET} />
      <Stack.Screen name="select-options" options={HUG_SHEET} />
      <Stack.Screen name="select-options-long" options={PAGE_SHEET} />
      {/* Riepilogo: si esce solo con «Chiudi»/X (lo swipe lascerebbe Road a metà). */}
      <Stack.Screen name="riepilogo" options={{ ...PAGE_SHEET, gestureEnabled: false }} />
    </Stack>
  );
}
