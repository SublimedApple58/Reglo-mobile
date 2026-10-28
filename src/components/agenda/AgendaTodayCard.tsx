import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { ClaySurface } from '../clay';
import { CLAY } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import { MORALE_ART } from '../../theme/moraleArt';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hhmm = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

/**
 * Card «Oggi» in testa all'Agenda (direzione D · Mix, REG-639): calendario 3D,
 * quante guide oggi e una riga umana che segue la giornata (giro «memorabile»):
 * la prima con chi, quella in corso e quando finisce, la prossima, la pausa; a
 * giornata finita l'espresso e, se è già in agenda, domani. Solo dati già
 * caricati dall'agenda: nessuna chiamata in più. Giornata vuota = volante 3D e
 * «giornata libera».
 */
export function AgendaTodayCard({
  appointments,
  instructorBlocks,
  instructorId,
  now,
}: {
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks: InstructorBlock[];
  instructorId: string;
  now: Date;
}) {
  const { count, line, done } = useMemo(() => {
    const live = (s: string | null | undefined) => {
      const v = (s ?? '').toLowerCase();
      return v !== 'cancelled' && v !== 'no_show';
    };
    // Una guida di gruppo ha un posto per allievo: conta una volta sola.
    const lessonsOn = (day: Date) => {
      const seen = new Set<string>();
      return appointments
        .filter((a) => a.instructorId === instructorId && a.type !== 'esame' && live(a.status) && sameDay(new Date(a.startsAt), day))
        .filter((a) => {
          const key = a.groupLessonId ?? a.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    };
    /** «con Marco», «di gruppo»: chi c'è, in due parole. */
    const who = (a: AutoscuolaAppointmentWithRelations) =>
      a.groupLessonId ? ' di gruppo' : a.student?.firstName ? ` con ${a.student.firstName}` : '';
    const lessons = lessonsOn(now);
    if (!lessons.length) return { count: 0, line: 'Giornata libera in agenda', done: false };
    // REG-639 «memorabile»: la riga segue la giornata, chi e quando.
    const current = lessons.find((a) => {
      const start = new Date(a.startsAt);
      const end = a.endsAt ? new Date(a.endsAt) : new Date(+start + 60 * 60 * 1000);
      return start <= now && now < end;
    });
    const next = lessons.find((a) => new Date(a.startsAt) > now);
    const pause = instructorBlocks
      .filter((b) => b.instructorId === instructorId && b.reason === 'lesson_buffer')
      .map((b) => new Date(b.startsAt))
      .filter((d) => sameDay(d, now) && d > now)
      .sort((a, b) => +a - +b)[0];
    let main: string;
    if (current) {
      const end = current.endsAt ? new Date(current.endsAt) : new Date(+new Date(current.startsAt) + 60 * 60 * 1000);
      main = `Ora${who(current) || ' in guida'}, finisce alle ${hhmm(end)}`;
    } else if (next && next === lessons[0]) main = `La prima alle ${hhmm(new Date(next.startsAt))}${who(next)}`;
    else if (next) main = `La prossima alle ${hhmm(new Date(next.startsAt))}${who(next)}`;
    else {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const t = lessonsOn(tomorrow);
      main = t.length
        ? `Tutte fatte. Domani ${t.length === 1 ? '1 guida' : `${t.length} guide`}, la prima alle ${hhmm(new Date(t[0].startsAt))}`
        : 'Tutte fatte, buon resto di giornata';
    }
    return {
      count: lessons.length,
      line: pause && next && !current ? `${main} · pausa alle ${hhmm(pause)}` : main,
      done: !current && !next,
    };
  }, [appointments, instructorBlocks, instructorId, now]);

  return (
    <ClaySurface padded={false} radius={22} style={s.card} testID="agenda-today-card">
      {/* A giornata finita il calendario lascia il posto all'espresso (pausa meritata). */}
      <Animated.Image
        key={done ? 'done' : count ? 'day' : 'free'}
        entering={FadeIn.duration(260).reduceMotion(ReduceMotion.Never)}
        source={done ? MORALE_ART.espresso : count ? VITA_ART.calendario : VITA_ART.volante}
        style={s.art}
      />
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>
          {count ? `Oggi ${count} guid${count === 1 ? 'a' : 'e'}` : 'Oggi nessuna guida'}
        </Text>
        <Text style={s.sub} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </ClaySurface>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14 },
  art: { width: 52, height: 52, borderRadius: 12 },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  sub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
});
