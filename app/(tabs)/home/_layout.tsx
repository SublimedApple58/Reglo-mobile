import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, PAGE_SHEET } from '../../../src/utils/sheetPresentation';

export default function HomeLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-action" options={HUG_SHEET} />
      <Stack.Screen name="select-date" options={{ presentation: 'modal', headerShown: false }} />
      {/* Quick-book hosts the full BookingForm: in moto mode it grows taller
          than the screen, so it needs the scrollable full-height page sheet
          (a fitToContents form sheet clips the overflow on iOS). */}
      <Stack.Screen name="quick-book" options={PAGE_SHEET} />
      <Stack.Screen name="manage-lesson" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="day-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="exam-manage" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="manage-group-lesson" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="group-lesson-detail" options={TALL_SHEET} />
      <Stack.Screen name="manage-group-lesson-participants" options={TALL_SHEET} />
      <Stack.Screen name="student-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="new-booking" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="block-slot" options={TALL_SHEET} />
      <Stack.Screen name="sick-leave" options={TALL_SHEET} />
      <Stack.Screen name="select-date-range" options={TALL_SHEET} />
      <Stack.Screen name="create-exam" options={TALL_SHEET} />
      <Stack.Screen name="create-group-lesson" options={PAGE_SHEET} />
      <Stack.Screen name="select-student" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="select-exam-students" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="out-of-availability" options={TALL_SHEET} />
      <Stack.Screen name="select-options" options={HUG_SHEET} />
      <Stack.Screen name="select-options-long" options={PAGE_SHEET} />
      <Stack.Screen name="time-picker" options={HUG_SHEET} />
      <Stack.Screen name="manage-lesson-details" options={TALL_SHEET} />
      <Stack.Screen name="manage-lesson-correct" options={HUG_SHEET} />
      <Stack.Screen name="edit-notes" options={TALL_SHEET} />
      <Stack.Screen name="swap-lesson" options={TALL_SHEET} />
      <Stack.Screen name="reschedule-lesson" options={TALL_SHEET} />
      <Stack.Screen name="manage-lesson-instructor" options={TALL_SHEET} />
      <Stack.Screen name="manage-lesson-vehicles" options={TALL_SHEET} />
      <Stack.Screen name="manage-lesson-location" options={TALL_SHEET} />
      <Stack.Screen name="manage-lesson-location-form" options={TALL_SHEET} />
      <Stack.Screen name="lesson-detail" options={TALL_SHEET} />
      <Stack.Screen name="booking-flow" options={TALL_SHEET} />
      <Stack.Screen name="booking-slots" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="exam-detail" options={TALL_SHEET} />
      <Stack.Screen name="all-lessons" options={TALL_SHEET} />
      <Stack.Screen name="quiz-hint" options={{ presentation: 'modal', headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="swaps" options={{ headerShown: false }} />
      <Stack.Screen name="group-lesson-invites" options={{ headerShown: false }} />
      <Stack.Screen name="swap-detail" options={TALL_SHEET} />
    </Stack>
  );
}
