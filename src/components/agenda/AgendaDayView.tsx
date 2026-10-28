import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { ClayEmpty, ClayPressable, ClaySearchField } from '../clay';
import { useAutoscuolaSettings } from '../../hooks/queries/useAutoscuolaSettings';
import { resolveAgendaColorConfig } from '../../utils/agendaColors';
import { agendaVehicleLabel, showVehicleOnBlocks } from '../../utils/agendaVehicle';
import { blockLabel, EXAM_LOOK, GROUP_LOOK, GROUP_MOTO_LOOK, guideLook, type AgendaLook } from '../../utils/agendaLook';
import { BLOCK_PRESENTATION, blockKindOf, isExamPlaceholder } from '../../utils/weeklyAgenda';
import { formatLessonType } from '../../utils/lessonTypes';
import { motoLessonTypeLabel } from '../../utils/motoLessonType';
import { MORALE_ART } from '../../theme/moraleArt';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../utils/motion';

/**
 * Vista Giorno dell'Agenda istruttore (REG-639 clay, notte 28/10/2026).
 *
 * Una lista verticale per orario, non una griglia:
 *  - guide = card bianche clay con la barretta del colore dell'autoscuola e la
 *    tinta leggerissima (`utils/agendaLook`), testo nero;
 *  - esami e guide di gruppo = stessa card, «Esame» / «Guida di gruppo»;
 *  - pause, blocchi, malattia, ferie = righe sottili grigie (non card);
 *  - buchi liberi dentro la disponibilità = riga tratteggiata «Libero» che apre
 *    la prenotazione con l'orario già messo;
 *  - «adesso» = filetto nero con l'ora.
 * Il titolare (o «Tutti gli istruttori») vede le guide raggruppate per
 * istruttore, con l'intestazione che resta in alto e la ricerca oltre 5.
 * Riceve gli stessi dati della vista Settimana (`WeeklyAgendaView`).
 */

type AvailWindow = { startMinutes: number; endMinutes: number };

type Props = {
  date: Date;
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks?: InstructorBlock[];
  availability?: AvailWindow[];
  holiday?: boolean;
  /** Raggruppa per istruttore (titolare / «Tutti gli istruttori»). */
  groupByInstructor?: boolean;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onPressAppointment: (a: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appts: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson?: (groupLessonId: string) => void;
  onPressBlock?: (b: InstructorBlock) => void;
  onBookAt?: (date: Date, startMinutes: number, windowStart: number, windowEnd: number, durationMinutes?: number) => void;
  /** Spazio in fondo (FAB). */
  bottomInset?: number;
};

type Item =
  | { kind: 'guide'; key: string; start: number; end: number; appt: AutoscuolaAppointmentWithRelations }
  | { kind: 'exam'; key: string; start: number; end: number; appts: AutoscuolaAppointmentWithRelations[] }
  | { kind: 'group'; key: string; start: number; end: number; groupLessonId: string | null; appts: AutoscuolaAppointmentWithRelations[] }
  | { kind: 'block'; key: string; start: number; end: number; block: InstructorBlock }
  | { kind: 'free'; key: string; start: number; end: number }
  | { kind: 'now'; key: string; start: number; end: number };

const MIN_FREE = 30;
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const minOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const dur = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const studentName = (a: AutoscuolaAppointmentWithRelations) =>
  [a.student?.lastName, a.student?.firstName].filter(Boolean).join(' ') || 'Allievo';
const isCancelled = (a: AutoscuolaAppointmentWithRelations) => (a.status ?? '').trim().toLowerCase() === 'cancelled';


function buildItems(
  date: Date,
  appts: AutoscuolaAppointmentWithRelations[],
  blocks: InstructorBlock[],
  availability: AvailWindow[] | undefined,
  withFree: boolean,
  withNow: boolean,
): { timed: Item[]; timeless: AutoscuolaAppointmentWithRelations[] } {
  const timed: Item[] = [];
  const timeless: AutoscuolaAppointmentWithRelations[] = [];
  const examMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
  const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
  for (const a of appts) {
    if (isCancelled(a)) continue;
    if (a.type === 'esame') {
      if (!a.endsAt) { timeless.push(a); continue; }
      const k = `${a.startsAt}|${a.endsAt}|${a.instructorId ?? ''}`;
      const arr = examMap.get(k); if (arr) arr.push(a); else examMap.set(k, [a]);
    } else if (a.type === 'group_lesson') {
      const k = a.groupLessonId ?? `${a.startsAt}|${a.endsAt ?? ''}|${a.instructorId ?? ''}`;
      const arr = groupMap.get(k); if (arr) arr.push(a); else groupMap.set(k, [a]);
    } else {
      const s = minOf(a.startsAt);
      timed.push({ kind: 'guide', key: a.id, start: s, end: a.endsAt ? minOf(a.endsAt) : s + 60, appt: a });
    }
  }
  for (const [k, list] of examMap) {
    timed.push({ kind: 'exam', key: `ex:${k}`, start: minOf(list[0].startsAt), end: minOf(list[0].endsAt!), appts: list });
  }
  for (const [k, list] of groupMap) {
    const s = minOf(list[0].startsAt);
    timed.push({
      kind: 'group', key: `gl:${k}`, start: s, end: list[0].endsAt ? minOf(list[0].endsAt) : s + 60,
      groupLessonId: list[0].groupLessonId ?? null, appts: list,
    });
  }
  for (const b of blocks) {
    timed.push({ kind: 'block', key: `bl:${b.id}`, start: minOf(b.startsAt), end: minOf(b.endsAt), block: b });
  }

  if (withFree && availability?.length) {
    const now = new Date();
    const d0 = new Date(date); d0.setHours(0, 0, 0, 0);
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    // Buchi solo nel futuro: oggi da adesso, i giorni passati mai.
    const floor = d0 < t0 ? 24 * 60 : d0 > t0 ? 0 : Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
    const busy = timed.map((i) => [i.start, i.end] as [number, number]).sort((x, y) => x[0] - y[0]);
    const wins = availability.map((w) => [w.startMinutes, w.endMinutes] as [number, number]).sort((x, y) => x[0] - y[0]);
    for (const [ws, we] of wins) {
      let cursor = Math.max(ws, floor);
      for (const [bs, be] of busy) {
        if (be <= cursor || bs >= we) continue;
        if (bs - cursor >= MIN_FREE) timed.push({ kind: 'free', key: `fr:${cursor}`, start: cursor, end: bs });
        cursor = Math.max(cursor, be);
      }
      if (we - cursor >= MIN_FREE) timed.push({ kind: 'free', key: `fr:${cursor}`, start: cursor, end: we });
    }
  }

  if (withNow && sameDay(date, new Date())) {
    const n = new Date();
    const m = n.getHours() * 60 + n.getMinutes();
    timed.push({ kind: 'now', key: 'now', start: m, end: m });
  }

  // A parità d'orario: «adesso» prima, poi eventi, poi buchi.
  const rank = (i: Item) => (i.kind === 'now' ? 0 : i.kind === 'free' ? 2 : 1);
  timed.sort((a, b) => a.start - b.start || rank(a) - rank(b));
  return { timed, timeless };
}

export function AgendaDayView({
  date,
  appointments,
  instructorBlocks = [],
  availability,
  holiday,
  groupByInstructor,
  loading,
  refreshing = false,
  onRefresh,
  onPressAppointment,
  onPressExam,
  onPressGroupLesson,
  onPressBlock,
  onBookAt,
  // Altezza del «+» (56) + il suo margine dal fondo (24) + respiro: l'ultima
  // riga si può sempre portare sopra il «+».
  bottomInset = 56 + 24 + 64,
}: Props) {
  const settings = useAutoscuolaSettings();
  const colorConfig = useMemo(() => resolveAgendaColorConfig(settings.data), [settings.data]);
  const showVehicle = showVehicleOnBlocks(settings.data);
  const [query, setQuery] = useState('');
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  // Ogni minuto: sposta «adesso» e i buchi liberi di oggi.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const dayAppts = useMemo(
    () => appointments.filter((a) => sameDay(new Date(a.startsAt), date)),
    [appointments, date],
  );
  const dayBlocks = useMemo(
    () => instructorBlocks.filter((b) => sameDay(new Date(b.startsAt), date)),
    [instructorBlocks, date],
  );

  const sections = useMemo(() => {
    if (!groupByInstructor) {
      return [{ id: 'me', name: null as string | null, ...buildItems(date, dayAppts, dayBlocks, availability, !!onBookAt, true) }];
    }
    const byInstr = new Map<string, { name: string; appts: AutoscuolaAppointmentWithRelations[] }>();
    for (const a of dayAppts) {
      const id = a.instructorId ?? 'none';
      const name = a.instructor?.name?.trim() || 'Senza istruttore';
      const g = byInstr.get(id);
      if (g) g.appts.push(a); else byInstr.set(id, { name, appts: [a] });
    }
    return Array.from(byInstr.entries())
      .map(([id, g]) => ({ id, name: g.name as string | null, ...buildItems(date, g.appts, [], undefined, false, false) }))
      .filter((s) => s.timed.length || s.timeless.length)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'it'));
  }, [groupByInstructor, date, dayAppts, dayBlocks, availability, onBookAt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => (s.name ?? '').toLowerCase().includes(q));
  }, [sections, query]);

  const nothing = sections.every((s) => !s.timed.some((i) => i.kind !== 'now' && i.kind !== 'free') && !s.timeless.length);
  const showSearch = !!groupByInstructor && sections.length > 5;

  const renderItem = (it: Item) => {
    switch (it.kind) {
      case 'now':
        return (
          <View key={it.key} style={s.nowRow} accessibilityLabel={`Adesso, ${hm(it.start)}`}>
            <Text style={s.nowTx}>{hm(it.start)}</Text>
            <View style={s.nowDot} />
            <View style={s.nowLine} />
          </View>
        );
      case 'free':
        return (
          <TimeRow key={it.key} start={it.start}>
            <Pressable
              onPress={() => onBookAt?.(date, it.start, it.start, it.end)}
              style={({ pressed }) => [s.free, pressed && s.freePressed]}
              accessibilityRole="button"
              accessibilityLabel={`Libero dalle ${hm(it.start)} alle ${hm(it.end)}, prenota`}
              testID="agenda-free-slot"
            >
              <Text style={s.freeTx}>
                Libero <Text style={s.freeSub}>· {hm(it.start)}–{hm(it.end)} · {dur(it.end - it.start)}</Text>
              </Text>
            </Pressable>
          </TimeRow>
        );
      case 'block': {
        const kind = blockKindOf(it.block.reason);
        const pres = BLOCK_PRESENTATION[kind];
        const label = blockLabel(it.block.reason, kind === 'theory' ? pres.label : pres.short);
        const body = (
          <View style={s.blockRow}>
            <View style={s.blockRule} />
            <Text style={s.blockTx} numberOfLines={1}>
              {label}
              <Text style={s.blockSub}> · {hm(it.start)}–{hm(it.end)}</Text>
              {it.block.description ? <Text style={s.blockSub}> · {it.block.description}</Text> : null}
            </Text>
          </View>
        );
        return (
          <TimeRow key={it.key} start={it.start} quiet>
            {onPressBlock ? (
              <Pressable onPress={() => onPressBlock(it.block)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
                {body}
              </Pressable>
            ) : body}
          </TimeRow>
        );
      }
      case 'guide': {
        const a = it.appt;
        const look = guideLook(a, colorConfig);
        const status = (a.status ?? '').trim().toLowerCase();
        const moto = motoLessonTypeLabel(a.motoLessonType);
        const parts = [
          status === 'no_show' ? 'Assente' : status === 'checked_in' ? 'In corso' : null,
          moto ?? (a.type ? formatLessonType(a.type) : null),
          dur(it.end - it.start),
          showVehicle ? agendaVehicleLabel(a) : null,
        ].filter(Boolean);
        return (
          <TimeRow key={it.key} start={it.start} end={it.end}>
            <EventCard look={look} onPress={() => onPressAppointment(a)} testID="agenda-day-lesson">
              <Text style={[s.evTitle, { color: look.text }]} numberOfLines={1}>{studentName(a)}</Text>
              <Text style={[s.evSub, { color: look.sub }]} numberOfLines={1}>{parts.join(' · ')}</Text>
            </EventCard>
          </TimeRow>
        );
      }
      case 'exam': {
        const people = it.appts.filter((a) => !isExamPlaceholder(a));
        return (
          <TimeRow key={it.key} start={it.start} end={it.end}>
            <EventCard look={EXAM_LOOK} onPress={onPressExam ? () => onPressExam(it.appts) : undefined} testID="agenda-day-exam">
              <Text style={s.evTitle} numberOfLines={1}>Esame</Text>
              <Text style={s.evSub} numberOfLines={2}>
                {people.length ? `${people.length} ${people.length === 1 ? 'allievo' : 'allievi'} · ${people.map(studentName).join(', ')}` : 'Nessun allievo ancora'}
              </Text>
            </EventCard>
          </TimeRow>
        );
      }
      case 'group': {
        const first = it.appts[0];
        const isMoto = first.groupLessonKind === 'moto';
        const people = it.appts.filter((a) => a.studentId);
        const cap = first.groupLessonCapacity ?? 3;
        return (
          <TimeRow key={it.key} start={it.start} end={it.end}>
            <EventCard
              look={isMoto ? GROUP_MOTO_LOOK : GROUP_LOOK}
              onPress={it.groupLessonId && onPressGroupLesson ? () => onPressGroupLesson(it.groupLessonId!) : undefined}
              testID="agenda-day-group"
            >
              <Text style={s.evTitle} numberOfLines={1}>{isMoto ? 'Guida di gruppo moto' : 'Guida di gruppo'}</Text>
              <Text style={s.evSub} numberOfLines={2}>
                {`${people.length} su ${cap}`}{people.length ? ` · ${people.map(studentName).join(', ')}` : ''}
              </Text>
            </EventCard>
          </TimeRow>
        );
      }
    }
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CLAY.ink3} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View key={dayKey} entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
        {holiday ? <Text style={s.holiday}>Giorno festivo</Text> : null}
        {showSearch ? (
          <ClaySearchField value={query} onChangeText={setQuery} placeholder="Cerca un istruttore" style={s.search} />
        ) : null}
        {loading && nothing ? (
          <View style={s.skeletons}>
            {[0, 1, 2].map((i) => <View key={i} style={[s.skeleton, CLAY_SHADOW.raise]} />)}
          </View>
        ) : nothing && !sections.some((x) => x.timed.some((i) => i.kind === 'free')) ? (
          <ClayEmpty
            icon={MORALE_ART.espresso}
            title="Giornata libera"
            text={holiday ? 'Oggi è festa.' : onBookAt ? 'Nessuna guida in programma. Tocca + per aggiungerne una.' : 'Nessuna guida in programma.'}
          />
        ) : (
          filtered.map((sec) => (
            <View key={sec.id} style={sec.name ? s.section : undefined}>
              {sec.name ? <Text style={s.sectionTitle} accessibilityRole="header">{sec.name}</Text> : null}
              {sec.timeless.length ? (
                <TimeRow start={null}>
                  <EventCard look={EXAM_LOOK} onPress={onPressExam ? () => onPressExam(sec.timeless) : undefined}>
                    <Text style={s.evTitle}>Esame, orario da definire</Text>
                    <Text style={s.evSub} numberOfLines={2}>{sec.timeless.filter((a) => !isExamPlaceholder(a)).map(studentName).join(', ') || 'Nessun allievo ancora'}</Text>
                  </EventCard>
                </TimeRow>
              ) : null}
              {sec.timed.map(renderItem)}
            </View>
          ))
        )}
      </Animated.View>
    </ScrollView>
  );
}

/** Colonna dell'ora a sinistra + contenuto. */
function TimeRow({ start, end, quiet, children }: { start: number | null; end?: number; quiet?: boolean; children: React.ReactNode }) {
  return (
    <View style={[s.row, quiet && s.rowQuiet]}>
      <View style={s.timeCol}>
        {start != null ? <Text style={[s.timeStart, quiet && s.timeQuiet]}>{hm(start)}</Text> : null}
        {end != null ? <Text style={s.timeEnd}>{hm(end)}</Text> : null}
      </View>
      <View style={s.rowBody}>{children}</View>
    </View>
  );
}

/** Card evento: bianco clay in rilievo, barretta del colore + tinta leggerissima. */
function EventCard({ look, onPress, children, testID }: { look: AgendaLook; onPress?: () => void; children: React.ReactNode; testID?: string }) {
  const inner = (
    <View style={[s.cardInner, { backgroundColor: look.wash }]}>
      {look.bar ? <View style={[s.bar, { backgroundColor: look.bar }]} /> : null}
      <View style={s.cardText}>{children}</View>
    </View>
  );
  const shell = [s.card, CLAY_SHADOW.raise, look.ring ? { borderWidth: 2, borderColor: look.ring } : null, look.muted && s.cardMuted];
  if (!onPress) return <View style={shell} testID={testID}>{inner}</View>;
  return (
    <ClayPressable onPress={onPress} kind="card" style={shell} testID={testID}>
      {inner}
    </ClayPressable>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 6 },
  holiday: { fontSize: 14, color: CLAY.ink3, marginBottom: 10, marginLeft: 60 },
  search: { marginBottom: 14 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3,
    paddingTop: 14, paddingBottom: 8, backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 },
  rowQuiet: { marginBottom: 8 },
  timeCol: { width: 52, paddingTop: 14 },
  timeStart: { fontSize: 15, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  timeQuiet: { fontWeight: '500', color: CLAY.ink3, fontSize: 13.5 },
  timeEnd: { fontSize: 13, color: CLAY.ink3, marginTop: 2, fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, minWidth: 0 },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF' },
  cardMuted: { opacity: 0.7 },
  cardInner: { borderRadius: 20, overflow: 'hidden', flexDirection: 'row', minHeight: 64 },
  bar: { width: 5 },
  cardText: { flex: 1, minWidth: 0, paddingVertical: 13, paddingLeft: 14, paddingRight: 16, justifyContent: 'center' },
  evTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.35 },
  evSub: { fontSize: 14, color: 'rgba(17,17,17,0.58)', marginTop: 3, lineHeight: 19 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 13 },
  blockRule: { width: 2, alignSelf: 'stretch', minHeight: 18, borderRadius: 1, backgroundColor: 'rgba(17,17,17,0.14)', marginLeft: 2 },
  blockTx: { flex: 1, fontSize: 14.5, fontWeight: '500', color: CLAY.ink3 },
  blockSub: { fontWeight: '400', color: CLAY.ink4 },
  free: {
    minHeight: 50, borderRadius: 18, borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(17,17,17,0.22)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
  },
  freePressed: { backgroundColor: 'rgba(17,17,17,0.03)' },
  freeTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink, flexShrink: 1 },
  freeSub: { fontWeight: '400', color: CLAY.ink3 },
  nowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: -2 },
  nowTx: { width: 46, fontSize: 12.5, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  nowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CLAY.ink, marginLeft: 1 },
  // Finisce prima del «+» (56 + margine destro 20 + respiro).
  nowLine: { flex: 1, height: 1.5, backgroundColor: CLAY.ink, marginRight: 72 },
  skeletons: { gap: 12, paddingLeft: 52 },
  skeleton: { height: 66, borderRadius: 20, backgroundColor: '#FFFFFF', opacity: 0.6 },
});
