import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET } from '../../../src/utils/sheetPresentation';

export default function NotesLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[studentId]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="cluster-settings" />
      <Stack.Screen name="time-picker" options={HUG_SHEET} />
      <Stack.Screen name="group-students" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="edit-notes" options={TALL_SHEET} />
      <Stack.Screen name="booking-rules" options={TALL_SHEET} />
      <Stack.Screen name="limits" options={TALL_SHEET} />
      <Stack.Screen name="extras" options={TALL_SHEET} />
    </Stack>
  );
}
