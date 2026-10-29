import { Stack } from 'expo-router';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

/**
 * REG-638 Road libero — tab «Road»: mappa con la posizione e «Avvia guida».
 * Il foglio «Avvia guida» è un form sheet alto quanto il contenuto che scorre
 * da sé (design-system §13.2.1); informativa come in home.
 */
// Deep link a un foglio della tab Road: sotto c'è sempre la tab (il foglio si
// presenta sopra, non al posto della schermata).
export const unstable_settings = { initialRouteName: 'index' };

export default function DriveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Campanella: notifiche come push di questo stack (swipe indietro nativo). */}
      <Stack.Screen name="notifications" />
      <Stack.Screen name="avvia" options={FORM_SHEET} />
      <Stack.Screen name="road-privacy" options={FORM_SHEET} />
      {/* Guida appena finita col pagellino da compilare: si apre da sola (una volta per avvio). */}
      <Stack.Screen name="appena-finita" options={FORM_SHEET} />
      {/* «Compila il pagellino» dalla tab: lo stack /road esiste solo in guida. */}
      <Stack.Screen name="pagellino" options={FORM_SHEET} />
      <Stack.Screen name="note" options={FORM_SHEET} />
      {/* «Ultime guide»: percorso della guida e mappa a tutto schermo, come in home. */}
      <Stack.Screen name="road-percorso" options={FORM_SHEET} />
      {/* REG-646: punti critici dell'autoscuola (schermata intera) e dettaglio di un punto. */}
      <Stack.Screen name="punti-critici" />
      <Stack.Screen name="punto-critico" options={FORM_SHEET} />
      <Stack.Screen name="road-map" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}
