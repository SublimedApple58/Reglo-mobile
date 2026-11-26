import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

/**
 * Tab «Oggi» del titolare e del titolare-istruttore (REG-794, rilascio 2).
 * Notifiche dalla campanella come push (swipe indietro nativo); il foglio
 * istruttore e i suoi fogli (disponibilità) e le guide fuori disponibilità
 * sono form sheet di questo stack. Malattia e settimana passano all'Agenda.
 */
export const unstable_settings = { initialRouteName: 'index' };

export default function TodayLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="instructor" options={FORM_SHEET} />
      <Stack.Screen name="instructor-availability" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      <Stack.Screen name="select-options" options={FORM_SHEET} />
      <Stack.Screen name="select-options-long" options={FORM_SHEET} />
      <Stack.Screen name="out-of-availability" options={FORM_SHEET} />
    </Stack>
  );
}
