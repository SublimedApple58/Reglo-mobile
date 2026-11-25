/**
 * REG-790 — il momento di conferma di una guida (Tiziano, 25/11/2026: video
 * «STOP → OK», anteprima /tmp/hiro-anteprime/reg-790/video/conferma-stop.*).
 *
 * Gerarchia a tre livelli: il cartello che gira e si ferma sulla faccia verde
 * (protagonista) con «Prenotata!» / «La guida è tua!», poi il giorno e le
 * righe istruttore · auto · sede, poi una nota piccola. CTA nera «Fatto» e
 * «Vedi la guida» come testo. Vive come stato finale del foglio «Orari»
 * (`booking-slots`) e come foglio a sé dopo uno scambio (`booking-confirmed`).
 *
 * Il video: `expo-av` (già nella build nativa: si rilascia in OTA), una sola
 * riproduzione, muto, fermo sull'ultimo fotogramma. Il primo fotogramma è il
 * poster, così non c'è uno scatto fra «vuoto» e video. Sfondo bianco puro come
 * il foglio: il riquadro non si vede.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';
import { ResizeMode, Video } from 'expo-av';
import { Avatar, ClayButton, ClayPressable, Icon3D } from './clay';
import { FlatRow } from '../screens/allievoHome/HomeSections';
import { car34Art } from '../road/markerArt';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { durationWords, lessonMinutes, lessonTypeWord, longDay, timeRangeWords } from '../utils/studentLessons';
import { regloApi } from '../services/regloApi';
import type { BookingConfirmation } from '../stores/bookingConfirmedStore';
import type { AutoscuolaAppointment, AutoscuolaAppointmentWithRelations } from '../types/regloApi';

const STOP_OK_VIDEO = require('../../assets/conferma/stop-ok.mp4');
const STOP_OK_POSTER = require('../../assets/conferma/stop-ok-primo.png');
const HERO = 132;

/** Dissolvenza breve in cascata (design-system §15: niente entrate dal basso). */
const fade = (delay: number) =>
  FadeIn.duration(200).delay(delay).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.Never);

const dayDiff = (d: Date) => {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
};
const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
/** «oggi alle 14:30», «domani alle 9:00», «mercoledì alle 14:30». */
const atWords = (d: Date) => {
  const diff = dayDiff(d);
  const day = diff <= 0 ? 'oggi' : diff === 1 ? 'domani' : d.toLocaleDateString('it-IT', { weekday: 'long' });
  return `${day} alle ${hm(d)}`;
};

/**
 * La guida appena presa con istruttore, auto e sede: il server risponde con la
 * guida «nuda», le relazioni arrivano dall'elenco delle guide del giorno. Se
 * quella lettura fallisce si mostra la guida nuda (le righe dicono «da
 * assegnare») invece di bloccare la conferma.
 */
export async function loadConfirmedLesson(
  studentId: string,
  appointment: AutoscuolaAppointment,
): Promise<AutoscuolaAppointmentWithRelations> {
  const from = new Date(appointment.startsAt);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  try {
    const list = await regloApi.getAppointments({ studentId, from: from.toISOString(), to: to.toISOString(), limit: 50 });
    const full = list.find((a) => a.id === appointment.id);
    if (full) return full;
  } catch {
    // si mostra la guida nuda
  }
  return { ...appointment, student: null, case: null, instructor: null, vehicle: null, location: null } as unknown as AutoscuolaAppointmentWithRelations;
}

/** Il cartello che gira: una volta, poi resta sulla spunta. */
export const StopOkHero = memo(function StopOkHero() {
  return (
    <View style={s.hero} accessible accessibilityRole="image" accessibilityLabel="Confermata">
      <Video
        source={STOP_OK_VIDEO}
        style={s.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isMuted
        isLooping={false}
        usePoster
        posterSource={STOP_OK_POSTER}
        posterStyle={s.video}
      />
    </View>
  );
});

export function BookingConfirmedBody({ data }: { data: BookingConfirmation }) {
  const { lesson, variant, vehiclesEnabled } = data;
  const minutes = lessonMinutes(lesson);
  const meta = [lessonTypeWord(lesson), durationWords(minutes)].filter(Boolean).join(' · ');
  const instructorName = lesson.instructor?.name ?? null;
  const location = lesson.location;

  // Nota piccola in fondo: il promemoria, e la soglia di annullo vera della
  // guida (`penaltyCutoffAt`, la stessa del server) solo se c'è.
  const days = dayDiff(new Date(lesson.startsAt));
  const reminder = days <= 0 ? null : days === 1 ? 'Ci vediamo domani.' : 'Ti ricordiamo noi il giorno prima.';
  const cutoff = lesson.penaltyCutoffAt ? new Date(lesson.penaltyCutoffAt) : null;
  const cutoffLine =
    cutoff && Number.isFinite(cutoff.getTime()) && cutoff.getTime() > Date.now()
      ? `Puoi annullarla senza penale fino a ${atWords(cutoff)}.`
      : null;
  const swapLine = variant === 'swap' ? "Te l'ha lasciata un compagno: ora è nelle tue guide." : null;
  const note = [swapLine, reminder, cutoffLine].filter(Boolean).join(' ');

  return (
    <View testID="booking-confirmed">
      <StopOkHero />
      <Animated.View entering={fade(120)}>
        <Text style={s.title} accessibilityRole="header">
          {variant === 'swap' ? 'La guida è tua!' : 'Prenotata!'}
        </Text>
        <Text style={s.sub}>
          {longDay(lesson.startsAt)} · {timeRangeWords(lesson)}
        </Text>
      </Animated.View>
      <Animated.View entering={fade(220)} style={s.rows}>
        <FlatRow
          first
          leading={<Avatar userId={lesson.instructor?.userId ?? lesson.instructor?.id} name={instructorName ?? '?'} size={40} />}
          title={instructorName ?? 'Istruttore da assegnare'}
          subtitle="Il tuo istruttore"
        />
        {vehiclesEnabled && lesson.vehicle ? (
          <FlatRow
            leading={<Icon3D source={car34Art(lesson.vehicle.color)} size={34} width={42} />}
            title={lesson.vehicle.name}
            subtitle={meta}
          />
        ) : null}
        <FlatRow
          leading={<Icon3D source={VITA_ART.edificio} size={36} />}
          title={location?.name ?? "Sede dell'autoscuola"}
          subtitle={location?.isPrecise ? location.address : vehiclesEnabled && lesson.vehicle ? null : meta}
        />
      </Animated.View>
      {note ? (
        <Animated.Text entering={fade(300)} style={s.note}>
          {note}
        </Animated.Text>
      ) : null}
    </View>
  );
}

export function BookingConfirmedCta({ onDone, onOpenLesson }: { onDone: () => void; onOpenLesson?: () => void }) {
  return (
    <View>
      <ClayButton title="Fatto" onPress={onDone} testID="booking-confirmed-done" />
      {onOpenLesson ? (
        <ClayPressable
          kind="small"
          onPress={onOpenLesson}
          accessibilityRole="button"
          style={s.link}
          testID="booking-confirmed-open"
        >
          <Text style={s.linkTx}>Vedi la guida</Text>
        </ClayPressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignSelf: 'center', width: HERO, height: HERO, backgroundColor: '#FFFFFF' },
  video: { width: HERO, height: HERO, backgroundColor: '#FFFFFF' },
  title: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.9,
    textAlign: 'center',
    marginTop: 10,
  },
  sub: { fontSize: 16.5, lineHeight: 22, color: CLAY.ink2, textAlign: 'center', marginTop: 4 },
  rows: { marginTop: 18 },
  note: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10 },
  link: { alignItems: 'center', justifyContent: 'center', height: 48, marginTop: 4 },
  linkTx: { fontSize: 16, fontWeight: '600', color: CLAY.ink },
});
