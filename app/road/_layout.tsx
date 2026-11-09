import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { sheetScreenListeners } from '../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../src/utils/sheetPresentation';
import { useRoadNight } from '../../src/road/night';
import { SHEET_NIGHT, SheetNightContext } from '../../src/theme/night';

/**
 * REG-638 Reglo Road — modalità a tutto schermo, fuori dalle tab: con una
 * sessione Road attiva l'app intera è questo stack (RoadController instrada).
 *
 * Ricca 7: lo stack dice a tutti i fogli se è notte (`SheetNightContext`),
 * così pagellino, segnala, note e riepilogo sono scuri come la mappa e non
 * abbagliano. Notte automatica o scelta dall'istruttore («Aspetto»).
 */
export default function RoadLayout() {
  const night = useRoadNight();
  const sheet = useMemo(
    () => (night ? { ...FORM_SHEET, contentStyle: { backgroundColor: SHEET_NIGHT.bg } } : FORM_SHEET),
    [night],
  );
  return (
    <SheetNightContext.Provider value={night}>
      <Stack
        screenListeners={sheetScreenListeners}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: night ? SHEET_NIGHT.bg : '#F4F1EA' } }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'fade' }} />
        {/* Tutti i fogli di Road: FORM_SHEET + <FormSheet> (design-system §13.2).
            Si chiudono solo con la X; il riepilogo esce da Road. */}
        <Stack.Screen name="segnala" options={sheet} />
        <Stack.Screen name="pagellino" options={sheet} />
        <Stack.Screen name="note" options={sheet} />
        <Stack.Screen name="riepilogo" options={sheet} />
        {/* REG-715: elenco completo con la mappa e ripasso con l'allievo. */}
        <Stack.Screen name="segnalazioni" options={sheet} />
        {/* Ricca 7: Auto / Giorno / Notte. */}
        <Stack.Screen name="aspetto" options={sheet} />
        <Stack.Screen name="ripasso" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </SheetNightContext.Provider>
  );
}
