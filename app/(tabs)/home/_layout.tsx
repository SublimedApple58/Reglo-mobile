import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';

export default function HomeLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="add-action"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen name="select-date" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="quick-book"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen name="manage-lesson" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="day-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="exam-manage" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="manage-group-lesson" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="group-lesson-detail"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="manage-group-lesson-participants"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen name="student-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="new-booking" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="block-slot"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sick-leave"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="select-date-range"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-exam"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-group-lesson"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen name="select-student" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="select-exam-students" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="out-of-availability"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="select-options"
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
      <Stack.Screen
        name="manage-lesson-details"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="swap-lesson"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reschedule-lesson"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="manage-lesson-instructor"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="manage-lesson-location"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="manage-lesson-location-form"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="lesson-detail"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking-flow"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking-slots"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="exam-detail"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="all-lessons"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="quiz-hint"
        options={{
          presentation: 'modal',
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="swaps" options={{ headerShown: false }} />
      <Stack.Screen name="group-lesson-invites" options={{ headerShown: false }} />
      <Stack.Screen
        name="swap-detail"
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

