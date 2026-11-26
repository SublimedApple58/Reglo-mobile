import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/components/tabBarSpace';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { FORM_SHEET } from '../../../src/utils/sheetPresentation';

/**
 * Tab «Oggi» del titolare e del titolare-istruttore (REG-794, rilascio 2).
 * Notifiche dalla campanella e «Disponibilità di …» come push (swipe indietro
 * nativo); il foglio istruttore, i fogli della disponibilità (giorno, eccezione,
 * malattia e ferie, date, orari, luoghi) e le guide fuori disponibilità sono
 * form sheet di questo stack. La settimana passa all'Agenda.
 */
export const unstable_settings = { initialRouteName: 'index' };

// REG-800: su iOS (barra nativa) le pagine a schermo pieno si tengono lo spazio della barra.
const STACK_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } };

export default function TodayLayout() {
  const stackOptions = useTabStackOptions('today', STACK_OPTIONS);
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="instructor" options={FORM_SHEET} />
      <Stack.Screen name="availability" />
      <Stack.Screen name="availability-exception" options={FORM_SHEET} />
      <Stack.Screen name="publish-day" options={FORM_SHEET} />
      <Stack.Screen name="sick-leave" options={FORM_SHEET} />
      <Stack.Screen name="select-date" options={FORM_SHEET} />
      <Stack.Screen name="select-date-range" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      <Stack.Screen name="select-options" options={FORM_SHEET} />
      <Stack.Screen name="select-options-long" options={FORM_SHEET} />
      <Stack.Screen name="out-of-availability" options={FORM_SHEET} />
      <Stack.Screen name="road-invite" options={FORM_SHEET} />
      <Stack.Screen name="road-privacy" options={FORM_SHEET} />
      <Stack.Screen name="giro" options={FORM_SHEET} />
    </Stack>
  );
}
