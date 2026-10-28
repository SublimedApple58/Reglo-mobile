import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ClaySurface } from '../clay';
import { CLAY } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hhmm = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

/**
 * Card «Oggi» in testa all'Agenda (direzione D · Mix, REG-639): calendario 3D,
 * quante guide oggi e una riga umana (la prima / la prossima, la pausa). Solo
 * dati già caricati dall'agenda: nessuna chiamata in più. Giornata vuota =
 * volante 3D e «giornata libera».
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
  const { count, line } = useMemo(() => {
    const live = (s: string | null | undefined) => {
      const v = (s ?? '').toLowerCase();
      return v !== 'cancelled' && v !== 'no_show';
    };
    const today = appointments.filter(
      (a) => a.instructorId === instructorId && a.type !== 'esame' && live(a.status) && sameDay(new Date(a.startsAt), now),
    );
    // Una guida di gruppo ha un posto per allievo: conta una volta sola.
    const seen = new Set<string>();
    const lessons = today
      .filter((a) => {
        const key = a.groupLessonId ?? a.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    if (!lessons.length) return { count: 0, line: 'Giornata libera in agenda' };
    const first = new Date(lessons[0].startsAt);
    const next = lessons.find((a) => new Date(a.startsAt) > now);
    const pause = instructorBlocks
      .filter((b) => b.instructorId === instructorId && b.reason === 'lesson_buffer')
      .map((b) => new Date(b.startsAt))
      .filter((d) => sameDay(d, now) && d > now)
      .sort((a, b) => +a - +b)[0];
    let main: string;
    if (first > now) main = `La prima alle ${hhmm(first)}`;
    else if (next) main = `La prossima alle ${hhmm(new Date(next.startsAt))}`;
    else main = 'Tutte fatte, buon resto di giornata';
    return { count: lessons.length, line: pause && next ? `${main} · pausa alle ${hhmm(pause)}` : main };
  }, [appointments, instructorBlocks, instructorId, now]);

  return (
    <ClaySurface padded={false} radius={22} style={s.card} testID="agenda-today-card">
      <Image source={count ? VITA_ART.calendario : VITA_ART.volante} style={s.art} />
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>
          {count ? `Oggi ${count} guid${count === 1 ? 'a' : 'e'}` : 'Oggi nessuna guida'}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
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
