import { Stack } from 'expo-router';
import { ROAD_SHEET } from '../../../src/utils/sheetPresentation';

/**
 * REG-638 Road libero — tab «Road»: mappa con la posizione e «Avvia guida».
 * Il foglio «Avvia guida» è un form sheet alto quanto il contenuto che scorre
 * da sé (design-system §13.2.1); informativa come in home.
 */
export default function DriveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avvia" options={ROAD_SHEET} />
      <Stack.Screen name="road-privacy" options={ROAD_SHEET} />
      {/* «Compila il pagellino» dalla tab: lo stack /road esiste solo in guida. */}
      <Stack.Screen name="pagellino" options={ROAD_SHEET} />
      {/* «Ultime guide»: percorso della guida e mappa a tutto schermo, come in home. */}
      <Stack.Screen name="road-percorso" options={ROAD_SHEET} />
      <Stack.Screen name="road-map" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}
