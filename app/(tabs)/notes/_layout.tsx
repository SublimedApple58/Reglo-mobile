import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';

export default function NotesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[studentId]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="cluster-settings" />
      <Stack.Screen
        name="time-picker"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="group-students"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="booking-rules"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="limits"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="extras"
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
