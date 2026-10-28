import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

export default function MoreLayout() {
  return (
    // REG-639 clay: fondo bianco puro sotto le schermate della tab «Tu».
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="instructor-hours" />
      <Stack.Screen name="instructors-overview" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="vehicles" />
      <Stack.Screen name="evaluation-sheet" />
      {/* Fogli: IL form sheet (FORM_SHEET + <FormSheet>, design-system §13.2). */}
      <Stack.Screen name="profile-edit" options={FORM_SHEET} />
      <Stack.Screen name="availability-mode" options={FORM_SHEET} />
      <Stack.Screen name="agenda-settings" options={FORM_SHEET} />
      <Stack.Screen name="location-form" options={FORM_SHEET} />
      {/* Era un modal a tutta pagina con footer pinnato: ora form sheet che scorre da sé. */}
      <Stack.Screen name="vehicle-form" options={FORM_SHEET} />
      <Stack.Screen name="evaluation-item" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      <Stack.Screen name="color-picker" options={FORM_SHEET} />
      <Stack.Screen name="hours-period" options={FORM_SHEET} />
    </Stack>
  );
}
