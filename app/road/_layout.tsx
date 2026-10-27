import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { HUG_SHEET, PAGE_SHEET, SCROLL_SHEET, TALL_SHEET } from '../../src/utils/sheetPresentation';

/**
 * I fogli hanno fondo BIANCO: lo stack ha il crema della mappa e, sotto un form
 * sheet `fitToContents`, quel crema spuntava come fascia in fondo al foglio
 * (riepilogo, 27/10). Ogni foglio dichiara il suo bianco.
 */
const WHITE = { contentStyle: { backgroundColor: '#FFFFFF' } } as const;

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
      <Stack.Screen name="segnala" options={{ ...TALL_SHEET, ...WHITE }} />
      {/* Pagellino: stesso foglio della home (manage-lesson-details) in variante
          «road»: barra con titolo e X, corpo che scorre, «Salva» fisso in fondo
          → detent fisso, non fitToContents. */}
      <Stack.Screen name="pagellino" options={{ ...SCROLL_SHEET, ...WHITE }} />
      <Stack.Screen name="select-options" options={{ ...HUG_SHEET, ...WHITE }} />
      <Stack.Screen name="select-options-long" options={{ ...PAGE_SHEET, ...WHITE }} />
      {/* Riepilogo: form sheet che abbraccia il contenuto, CTA in fondo (§13.2.1).
          Si esce solo con «Chiudi»/X (lo swipe lascerebbe Road a metà). */}
      <Stack.Screen name="riepilogo" options={{ ...TALL_SHEET, ...WHITE, gestureEnabled: false }} />
    </Stack>
  );
}
