import React, { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { bookingFlowStore } from '../../../src/stores/bookingFlowStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton } from '../../../src/components/clay';
import { ReviewError, ReviewNote, ReviewRows, ReviewTime, atWords, whenWords } from '../../../src/components/LessonReview';
import { durationWords, longDay } from '../../../src/utils/studentLessons';

const TYPE_LABELS: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
};

/**
 * REG-790 — riepilogo della guida scelta, PRIMA di prenotarla (flusso Airbnb,
 * Tiziano 25/11/2026). Si apre da «Orari» con l'orario scelto; «Conferma
 * prenotazione» chiama `onConfirmBooking` dello store (niente optimistic
 * update): al successo il quadratino STOP → OK e si chiude tutta la pila, se il
 * server dice di no l'errore resta qui sopra la CTA.
 *
 * Istruttore e auto li sceglie il server alla conferma: qui l'istruttore c'è
 * solo se l'allievo l'ha scelto o è assegnato a lui; l'auto non si mostra.
 */
export default function BookingReviewScreen() {
  const st = useSyncExternalStore(bookingFlowStore.subscribe, bookingFlowStore.get);
  const slot = st?.selectedSlot;
  if (!st || !slot) return <View style={{ height: 1, backgroundColor: '#FFFFFF' }} />;

  const types = st.canSelectLessonType ? st.selectedLessonTypes.map((t) => TYPE_LABELS[t]).filter(Boolean) : [];
  const meta = [types[0] ?? 'Guida', durationWords(st.durationMinutes)].filter(Boolean).join(' · ');

  const chosen = st.selectedInstructorId ? st.instructors.find((i) => i.id === st.selectedInstructorId)?.name ?? null : null;
  const instructorName = chosen ?? (st.isLockedToInstructor ? st.assignedInstructorName : null);

  const start = new Date(slot.startsAt);
  const hours = st.penaltyCutoffHours ?? null;
  const cutoff = hours ? new Date(start.getTime() - hours * 3_600_000) : null;
  const cancelLine = !st.studentCancellationEnabled
    ? "Per annullarla dovrai contattare l'autoscuola."
    : cutoff
      ? cutoff.getTime() > Date.now()
        ? `Puoi annullarla dall'app senza penale fino a ${atWords(cutoff)}.`
        : `Mancano meno di ${hours} ore: se poi la annulli, potrebbe esserti addebitata.`
      : null;

  const busy = st.loading;
  return (
    <FormSheet
      testID="booking-review-sheet"
      title={longDay(slot.startsAt)}
      subtitle={whenWords(slot.startsAt)}
      busy={busy}
      cta={
        <ClayButton
          title="Conferma prenotazione"
          onPress={() => {
            if (busy) return;
            st.onConfirmBooking();
          }}
          loading={busy}
          testID="booking-review-confirm"
        />
      }
    >
      <ReviewTime startsAt={slot.startsAt} endsAt={slot.endsAt} meta={meta} />
      <ReviewRows instructorName={instructorName} instructorKnown={!!instructorName} locationName={slot.locationName ?? null} />
      <ReviewNote lines={[cancelLine]} />
      <ReviewError message={st.confirmError} />
    </FormSheet>
  );
}
