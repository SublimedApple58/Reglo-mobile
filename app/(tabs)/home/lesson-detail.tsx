import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { lessonDetailStore } from '../../../src/stores/lessonDetailStore';
import { MOTO_LESSON_TYPE_HINTS, MOTO_LESSON_TYPE_LABELS } from '../../../src/utils/motoLessonType';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayPressable } from '../../../src/components/clay';
import { InstructorRow, LessonPlaceCard, VehicleRow } from '../../../src/components/studentLesson/LessonSheetParts';
import { DoneLessonSheetView } from '../../../src/screens/StudentDoneLessonSheet';
import { FlatRow } from '../../../src/screens/allievoHome/HomeSections';
import { CLAY } from '../../../src/theme/clay';
import { CLAY_DANGER } from '../../../src/components/ClayAccountParts';
import { durationWords, lessonMinutes, lessonTypeWord, longDay } from '../../../src/utils/studentLessons';

const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

const dayDiff = (d: Date) => {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

/** «Oggi», «Domani», «Tra 3 giorni». */
const whenWords = (iso: string) => {
  const diff = dayDiff(new Date(iso));
  if (diff <= 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  return `Tra ${diff} giorni`;
};

/** «oggi alle 14:30», «domani alle 9:00», «mercoledì alle 14:30». */
const atWords = (d: Date) => {
  const diff = dayDiff(d);
  const day = diff <= 0 ? 'oggi' : diff === 1 ? 'domani' : d.toLocaleDateString('it-IT', { weekday: 'long' });
  return `${day} alle ${hm(d)}`;
};

/**
 * REG-789 — foglio della guida in programma dell'allievo, direzione B
 * «protagonista» (Tiziano, 25/11/2026; anteprima B1): l'ORA grande, il luogo
 * con la mappa del ritrovo in una card, istruttore e auto a righe, «Cerca
 * sostituto» come CTA e «Annulla guida» come testo. Niente pillola di stato.
 * Una guida già passata (aperta dalle note) usa il foglio delle guide fatte.
 */
export default function LessonDetailScreen() {
  // REG-786: il foglio vive anche nello stack della tab Guide: la mappa si apre lì.
  const segments = useSegments() as string[];
  const stack = segments[1] === 'guide' ? 'guide' : 'home';
  const live = useSyncExternalStore(lessonDetailStore.subscribe, lessonDetailStore.get);
  // Il seed vale per tutta la vita del foglio.
  const [data] = useState(() => live);

  useEffect(() => {
    return () => { lessonDetailStore.clear(); };
  }, []);

  if (!data) return <FormSheet />;

  const { lesson } = data;
  const isFuture = new Date(lesson.startsAt).getTime() > Date.now();
  if (!isFuture) {
    return <DoneLessonSheetView data={{ lesson, manualMode: false, roadVisible: true }} stack={stack} />;
  }
  return <UpcomingLessonSheet data={data} />;
}

function UpcomingLessonSheet({ data }: { data: NonNullable<ReturnType<typeof lessonDetailStore.get>> }) {
  const router = useRouter();
  const { lesson, canSwap, canCancel, vehiclesEnabled, activeSwapOfferId, onSwap, onCancel, onRevokeSwap } = data;
  const hasActiveSwap = !!activeSwapOfferId;
  const start = new Date(lesson.startsAt);
  const end = lesson.endsAt ? new Date(lesson.endsAt) : null;
  const minutes = lessonMinutes(lesson);
  const instructorName = lesson.instructor?.name;
  const meta = [lessonTypeWord(lesson), durationWords(minutes)].filter(Boolean).join(' · ');

  // Le azioni chiudono prima il foglio: l'alert/il toast compaiono sulla schermata sotto.
  const after = (fn: () => void) => {
    router.back();
    setTimeout(fn, 350);
  };

  // Annullo: la soglia vera è quella salvata sulla guida (`penaltyCutoffAt`,
  // la stessa che usa il server). Senza (autoscuola senza pagamenti/crediti)
  // non si dice niente.
  const cutoff = lesson.penaltyCutoffAt ? new Date(lesson.penaltyCutoffAt) : null;
  const cancelNote =
    canCancel && cutoff && Number.isFinite(cutoff.getTime())
      ? cutoff.getTime() > Date.now()
        ? `Puoi annullarla senza penale fino a ${atWords(cutoff)}.`
        : 'Se la annulli adesso, potrebbe esserti addebitata lo stesso.'
      : null;
  // Scambio: l'offerta resta aperta fino a un'ora prima della guida, poi la guida resta tua.
  const swapNote = hasActiveSwap
    ? `Hai chiesto un sostituto. Se nessun compagno la prende entro ${atWords(new Date(start.getTime() - 3600000))}, resta tua.`
    : null;

  const showCta = hasActiveSwap || canSwap || canCancel;

  return (
    <FormSheet
      testID="lesson-detail-sheet"
      title={longDay(lesson.startsAt)}
      subtitle={whenWords(lesson.startsAt)}
      cta={
        showCta ? (
          <View>
            {hasActiveSwap ? (
              <ClayButton
                variant="secondary"
                title="Revoca richiesta"
                onPress={() => after(() => onRevokeSwap?.(activeSwapOfferId!))}
                testID="lesson-revoke-swap"
              />
            ) : canSwap ? (
              <ClayButton title="Cerca sostituto" onPress={() => after(() => onSwap(lesson.id))} testID="lesson-swap" />
            ) : null}
            {canCancel ? (
              <ClayPressable
                kind="small"
                onPress={() => after(() => onCancel(lesson.id))}
                accessibilityRole="button"
                style={[s.cancel, !(hasActiveSwap || canSwap) && s.cancelAlone]}
                testID="lesson-cancel"
              >
                <Text style={s.cancelTx}>Annulla guida</Text>
              </ClayPressable>
            ) : null}
          </View>
        ) : undefined
      }
    >
      <Text style={s.time} accessibilityRole="header">
        {hm(start)}
        {end ? ` – ${hm(end)}` : ''}
      </Text>
      <Text style={s.meta}>
        {meta}
        {instructorName ? ` con ${instructorName}` : ''}
      </Text>
      {swapNote ? <Text style={s.swapNote}>{swapNote}</Text> : null}

      <LessonPlaceCard location={lesson.location} />

      <View style={s.rows}>
        <InstructorRow first instructor={lesson.instructor} subtitle="Il tuo istruttore" />
        {vehiclesEnabled && lesson.vehicle ? <VehicleRow vehicle={lesson.vehicle} /> : null}
        {lesson.motoLessonType ? (
          <FlatRow
            title={MOTO_LESSON_TYPE_LABELS[lesson.motoLessonType]}
            subtitle={MOTO_LESSON_TYPE_HINTS[lesson.motoLessonType]}
          />
        ) : null}
      </View>

      {cancelNote ? <Text style={s.note}>{cancelNote}</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  time: { fontSize: 46, lineHeight: 52, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.5, marginTop: 4, fontVariant: ['tabular-nums'] },
  meta: { fontSize: 16, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },
  swapNote: { fontSize: 15, lineHeight: 20, color: CLAY.ink, fontWeight: '500', marginTop: 12 },
  rows: { marginTop: 12 },
  note: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12 },
  cancel: { alignItems: 'center', justifyContent: 'center', height: 48, marginTop: 4 },
  cancelAlone: { marginTop: 0 },
  cancelTx: { fontSize: 16, fontWeight: '600', color: CLAY_DANGER },
});
