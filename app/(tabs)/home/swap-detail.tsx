import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton } from '../../../src/components/clay';
import { closeAndCelebrate } from '../../../src/components/BookingSuccessOverlay';
import { ReviewError, ReviewNote, ReviewRows, ReviewTime, atWords, whenWords } from '../../../src/components/LessonReview';
import { swapDetailStore } from '../../../src/stores/swapDetailStore';
import { CLAY } from '../../../src/theme/clay';
import { durationWords, lessonMinutes, longDay } from '../../../src/utils/studentLessons';

const TYPE_LABELS: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
};

/**
 * Guida lasciata da un compagno: RIEPILOGO prima di prenderla (REG-790,
 * flusso Airbnb voluto da Tiziano il 25/11/2026). Orario grande, righe
 * istruttore · auto · luogo, regole in piccolo, CTA nera «Prendi la guida».
 * Al successo il foglio si chiude e resta il quadratino STOP → OK; se l'ha presa
 * prima un altro o il server dice di no, l'errore resta qui.
 * Sulla propria richiesta (`mine`) la CTA è «Ritira la richiesta».
 */
export default function SwapDetailScreen() {
  const router = useRouter();
  // Il seed vale per tutta la vita del foglio.
  const [data] = useState(() => swapDetailStore.get());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => swapDetailStore.clear(), []);

  if (!data) return <FormSheet />;

  const { offer, mine, onAccept, onRevoke } = data;
  const { appointment } = offer;
  const minutes = lessonMinutes(appointment);
  const meta = [TYPE_LABELS[appointment.type] ?? 'Guida', durationWords(minutes)].filter(Boolean).join(' · ');
  const expires = new Date(offer.expiresAt);

  const take = async () => {
    if (busy || !onAccept) return;
    setBusy(true);
    setError(null);
    const res = await onAccept(offer.id);
    if (res.status === 'taken') {
      void closeAndCelebrate(() => router.back(), 'È tua');
      return;
    }
    setBusy(false);
    if (res.status === 'error') {
      setError(res.message);
      return;
    }
    router.back();
    setTimeout(res.after, 350);
  };

  return (
    <FormSheet
      testID="swap-detail-sheet"
      title={longDay(appointment.startsAt)}
      subtitle={whenWords(appointment.startsAt)}
      busy={busy}
      cta={
        mine ? (
          <ClayButton
            variant="secondary"
            title="Ritira la richiesta"
            onPress={() => {
              router.back();
              setTimeout(() => onRevoke?.(offer.id), 350);
            }}
            testID="swap-detail-revoke"
          />
        ) : (
          <ClayButton title="Prendi la guida" onPress={take} loading={busy} testID="swap-detail-take" />
        )
      }
    >
      {mine ? null : <Text style={s.over}>Lasciata da un compagno</Text>}
      <ReviewTime startsAt={appointment.startsAt} endsAt={appointment.endsAt} meta={meta} />
      <ReviewRows
        instructorName={appointment.instructorName}
        instructorKnown={!!appointment.instructorName}
        vehicleName={appointment.vehicleName}
        locationName={appointment.locationName ?? null}
      />
      <ReviewNote
        lines={
          mine
            ? [`Stai cercando chi la prenda. Se nessuno la prende entro ${atWords(expires)}, resta tua.`]
            : [`Si può prendere fino a ${atWords(expires)}: la prende il primo che conferma.`]
        }
      />
      <ReviewError message={error} />
    </FormSheet>
  );
}

const s = StyleSheet.create({
  over: { fontSize: 14, lineHeight: 19, color: CLAY.ink3 },
});
