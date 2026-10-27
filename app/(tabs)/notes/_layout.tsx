import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, PAGE_SHEET, SCROLL_SHEET, FORM_SHEET } from '../../../src/utils/sheetPresentation';

export default function NotesLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[studentId]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="cluster-settings" />
      <Stack.Screen name="time-picker" options={HUG_SHEET} />
      <Stack.Screen name="select-options" options={HUG_SHEET} />
      {/* Impostazioni allievo: lista corta e statica → hug del contenuto. */}
      <Stack.Screen name="student-settings" options={HUG_SHEET} />
      {/* Pagamenti guide (REG-450): ancora page sheet, STORICO. Regola Reglo dal
          27/10/2026 (design-system §13.2.1): form sheet alto quanto il contenuto
          che scorre da sé, mai page sheet per le liste lunghe → da migrare. */}
      <Stack.Screen name="student-payments" options={PAGE_SHEET} />
      {/* REG-637: storico corto e già pronto dal seed → hug nativo, niente scroll. */}
      <Stack.Screen name="payment-history" options={HUG_SHEET} />
      <Stack.Screen name="select-options-long" options={PAGE_SHEET} />
      <Stack.Screen name="group-students" options={{ presentation: 'modal', headerShown: false }} />
      {/* Pagellino (REG-443): con più voci il foglio supera l'altezza dello
          schermo. Un formSheet a detent (TALL_SHEET/SCROLL_SHEET) NON basta: il
          pan nativo della sheet ruba il gesto allo scroll e il "Salva" resta
          irraggiungibile — stesso muro di REG-426 (booking-rules). Qui resta
          PAGE_SHEET (storico); la variante Road del pagellino segue già la
          regola §13.2.1: form sheet la cui radice è lo scroll. */}
      <Stack.Screen name="manage-lesson-details" options={PAGE_SHEET} />
      {/* REG-426: il pannello "per percorso" espande il form oltre l'altezza dello
          schermo. Un formSheet a detent (TALL_SHEET/SCROLL_SHEET) ha un pan nativo
          che confligge con lo scroll interno (il contenuto "risale su da solo").
          PAGE_SHEET (presentation:'modal') è il pattern già usato dalle form lunghe
          dell'app (quick-book → BookingForm/BlockForm): page sheet senza detent +
          SheetScaffold fill → scroll nativo pulito. */}
      <Stack.Screen name="booking-rules" options={PAGE_SHEET} />
      {/* REG-638: percorso Road di una guida dallo storico allievo. */}
      <Stack.Screen name="road-percorso" options={FORM_SHEET} />
      <Stack.Screen name="road-map" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="limits" options={TALL_SHEET} />
      <Stack.Screen name="extras" options={TALL_SHEET} />
    </Stack>
  );
}
