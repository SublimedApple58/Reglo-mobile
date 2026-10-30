import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';
import { TALL_SHEET, HUG_SHEET, PAGE_SHEET, SCROLL_SHEET, FORM_SHEET } from '../../../src/utils/sheetPresentation';

export default function HomeLayout() {
  return (
    <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* REG-639 fluidità: Disponibilità e Notifiche dall'orologio e dalla
          campanella dell'Agenda = schermate push (swipe indietro nativo). */}
      <Stack.Screen name="availability" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="availability-exception" options={FORM_SHEET} />
      <Stack.Screen name="publish-day" options={FORM_SHEET} />
      <Stack.Screen name="add-action" options={FORM_SHEET} />
      <Stack.Screen name="select-date" options={FORM_SHEET} />
      <Stack.Screen name="quick-book" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson" options={FORM_SHEET} />
      <Stack.Screen name="exam-manage" options={FORM_SHEET} />
      <Stack.Screen name="manage-group-lesson" options={FORM_SHEET} />
      <Stack.Screen name="group-lesson-detail" options={TALL_SHEET} />
      <Stack.Screen name="manage-group-lesson-participants" options={FORM_SHEET} />
      {/* REG-639: dettaglio allievo = form sheet alto quanto il contenuto (Tiziano 28/10). */}
      <Stack.Screen name="student-detail" options={FORM_SHEET} />
      <Stack.Screen name="new-booking" options={FORM_SHEET} />
      <Stack.Screen name="block-slot" options={FORM_SHEET} />
      <Stack.Screen name="theory-lesson" options={FORM_SHEET} />
      <Stack.Screen name="sick-leave" options={FORM_SHEET} />
      <Stack.Screen name="select-date-range" options={FORM_SHEET} />
      <Stack.Screen name="create-exam" options={FORM_SHEET} />
      <Stack.Screen name="create-group-lesson" options={FORM_SHEET} />
      <Stack.Screen name="select-student" options={FORM_SHEET} />
      <Stack.Screen name="select-exam-students" options={FORM_SHEET} />
      <Stack.Screen name="out-of-availability" options={FORM_SHEET} />
      <Stack.Screen name="select-options" options={FORM_SHEET} />
      {/* Impostazioni allievo: lista corta e statica → hug del contenuto. */}
      <Stack.Screen name="student-settings" options={HUG_SHEET} />
      {/* Pagamenti guide (REG-450): registro a lunghezza libera (lo storico di un
          allievo arriva a decine di guide) → page sheet con scroll nativo. */}
      <Stack.Screen name="student-payments" options={FORM_SHEET} />
      <Stack.Screen name="lesson-history" options={FORM_SHEET} />
      {/* REG-637: storico corto e già pronto dal seed → hug nativo, niente scroll. */}
      <Stack.Screen name="payment-history" options={FORM_SHEET} />
      <Stack.Screen name="select-options-long" options={FORM_SHEET} />
      <Stack.Screen name="follow-car-conflict" options={FORM_SHEET} />
      <Stack.Screen name="follow-car-conflict-long" options={FORM_SHEET} />
      <Stack.Screen name="time-picker" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-details" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-correct" options={FORM_SHEET} />
      {/* REG-587: "Di chi e' l'imprevisto?" sull'annullamento tardivo. */}
      <Stack.Screen name="cancel-fault" options={FORM_SHEET} />
      <Stack.Screen name="edit-notes" options={FORM_SHEET} />
      <Stack.Screen name="swap-lesson" options={FORM_SHEET} />
      <Stack.Screen name="reschedule-lesson" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-instructor" options={FORM_SHEET} />
      {/* REG-585: i colleghi che portano la guida insieme al principale. */}
      <Stack.Screen name="manage-co-instructors" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-vehicles" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-location" options={FORM_SHEET} />
      <Stack.Screen name="manage-lesson-location-form" options={FORM_SHEET} />
      <Stack.Screen name="lesson-detail" options={TALL_SHEET} />
      <Stack.Screen name="booking-flow" options={TALL_SHEET} />
      <Stack.Screen name="booking-slots" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="exam-detail" options={TALL_SHEET} />
      <Stack.Screen name="all-lessons" options={SCROLL_SHEET} />
      <Stack.Screen name="quiz-hint" options={{ presentation: 'modal', headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="swaps" options={{ headerShown: false }} />
      <Stack.Screen name="group-lesson-invites" options={{ headerShown: false }} />
      <Stack.Screen name="swap-detail" options={TALL_SHEET} />
      {/* REG-638 Reglo Road: invito e informativa = form sheet con CTA in fondo;
          percorso dell'allievo a tutto schermo. */}
      <Stack.Screen name="road-invite" options={FORM_SHEET} />
      <Stack.Screen name="road-privacy" options={FORM_SHEET} />
      <Stack.Screen name="road-map" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      {/* REG-638: «Percorso Road» di una guida (dettaglio guida, storico allievo):
          form sheet che abbraccia il contenuto, niente vuoto sotto (§13.2.1). */}
      <Stack.Screen name="road-percorso" options={FORM_SHEET} />
      {/* REG-663: «Road di <allievo>» dal dettaglio allievo. */}
      <Stack.Screen name="road-allievo" options={FORM_SHEET} />
    </Stack>
  );
}
