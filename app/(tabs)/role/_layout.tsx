import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';

export default function RoleLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="availability-exception"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="publish-day"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="time-picker"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
