import { Stack } from 'expo-router';
import { TALL_SHEET } from '../../../src/utils/sheetPresentation';

/**
 * REG-638 Road libero — tab «Road»: mappa con la posizione e «Avvia guida».
 * Il foglio «Avvia guida» è un form sheet alto quanto il contenuto che scorre
 * da sé (design-system §13.2.1); informativa come in home.
 */
export default function DriveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avvia" options={TALL_SHEET} />
      <Stack.Screen name="road-privacy" options={TALL_SHEET} />
    </Stack>
  );
}
