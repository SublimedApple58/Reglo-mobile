import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';

export default function MoreLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="instructor-hours" />
      <Stack.Screen name="instructors-overview" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="vehicles" />
      <Stack.Screen
        name="profile-edit"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="agenda-view"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="availability-mode"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="agenda-settings"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="location-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="vehicle-form"
        options={{
          // Full page sheet (not formSheet/fitToContents): the form is long and
          // variable-length (license + assignment + availability), so it must
          // scroll. Page sheet gives a tall sheet with a scrollable body.
          presentation: 'modal',
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
      <Stack.Screen
        name="hours-period"
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
