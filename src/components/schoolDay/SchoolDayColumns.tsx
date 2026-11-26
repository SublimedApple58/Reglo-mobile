import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from '../../utils/haptics';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';
import { useAutoscuolaSettings } from '../../hooks/queries/useAutoscuolaSettings';
import { AUTOMATIC_MARKER_WIDTH, resolveAgendaColorConfig, type AgendaColorConfig } from '../../utils/agendaColors';
import { EXAM_LOOK, GROUP_LOOK, GROUP_MOTO_LOOK, NO_SHOW_INK, blockLabel, guideLook, type AgendaLook } from '../../utils/agendaLook';
import { agendaVehicleLabel, showVehicleOnBlocks } from '../../utils/agendaVehicle';
import { BLOCK_PRESENTATION, blockKindOf, isExamPlaceholder } from '../../utils/weeklyAgenda';
import { instructorShortName, layoutLanes, type LaneItem, type LaneOverflow } from '../../utils/agendaLanes';
import { agendaSlotSheetStore } from '../../stores/agendaSlotSheetStore';
import { useTabBarOverlap } from '../tabBarSpace';
import { Avatar } from '../clay/Avatar';
import { SkeletonBlock } from '../Skeleton';
import {
  GhostBlock,
  GridBookableWindow,
  fmtLongDay,
  fmtMin,
  freeSegments,
  useGhostDraft,
  useGhostDurations,
  useGhostPage,
  type GhostColumn,
  type GhostGeometry,
  type GhostInfo,
} from '../agenda/ghost';
import { buildSchoolDay, emptyInstructorDay, minutesOf, toDateKey, type InstructorDay } from './schoolDayModel';
import type { AvailWindow, SchoolDayViewProps, SchoolInstructor } from './types';

/**
 * Concetto A del giorno della scuola (REG-794, anteprime 26/11): una colonna
 * per istruttore a larghezza fissa che scorre in orizzontale, come la vista
 * Giorno della web app su telefono. La colonna delle ore resta ferma a sinistra,
 * la fila dei volti resta ferma in alto e segue lo scorrimento orizzontale sul
 * thread UI. Si disegnano solo le colonne vicine a quelle in vista.
 * Il fantasma crea per l'istruttore della colonna toccata.
 */

const FIRST_HOUR = 7;
const LAST_HOUR = 24;
const DAY_MIN = FIRST_HOUR * 60;
const DAY_MAX = LAST_HOUR * 60;
const ROW_H = 60;
const GUTTER_W = 44;
const COL_W = 132;
const HEAD_H = 58;
const TOP_PAD = 12;
const GRID_H = (LAST_HOUR - FIRST_HOUR) * ROW_H;
/** Corsie dentro una colonna (sovrapposizioni dello stesso istruttore, rare). */
const LANE_MIN_W = 40;
const LANE_GAP = 2;
const GROUP_CAPACITY = 3; // fallback — real capacity comes from the BE row annotation

const yOf = (min: number) => ((min - DAY_MIN) / 60) * ROW_H;
const tintShadow = (color: string) => [{ offsetX: 0, offsetY: 4, blurRadius: 10, spreadDistance: -3, color }];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const spanOf = (startsAt: string, endsAt: string | null | undefined): [number, number] => {
  const sm = minutesOf(startsAt);
  const dur = endsAt ? (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000 : 60;
  return [sm, sm + Math.max(dur, 1)];
};
const studentName = (a: AutoscuolaAppointmentWithRelations) =>
  [a.student?.firstName, a.student?.lastName].filter(Boolean).join(' ') || 'Guida';

/* ------------------------------------------------------------------ */
/*  Testata di una colonna: volto, nome, guide del giorno              */
/* ------------------------------------------------------------------ */

const InstructorHead = React.memo(function InstructorHead({
  ins,
  left,
  sub,
  onPress,
}: {
  ins: SchoolInstructor;
  left: number;
  sub: string;
  onPress: (id: string) => void;
}) {
  const label = ins.isMe ? 'Tu' : instructorShortName(ins.name);
  return (
    <Pressable
      onPress={() => onPress(ins.id)}
      style={({ pressed }) => [s.head, { left }, pressed && { opacity: 0.55 }]}
      accessibilityRole="button"
      accessibilityLabel={`${ins.isMe ? 'La tua settimana' : `Settimana di ${ins.name}`}, ${sub}`}
      testID={`school-head-${ins.id}`}
    >
      <Avatar userId={ins.userId} name={ins.name} size={28} />
      <View style={s.headTx}>
        <Text style={s.headName} numberOfLines={1}>{label}</Text>
        <Text style={s.headSub} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
});

const headSub = (day: InstructorDay) => {
  if (day.absence === 'sick') return 'Malattia';
  if (day.absence === 'holiday') return 'Ferie';
  return day.lessonCount ? plural(day.lessonCount, 'guida', 'guide') : 'Nessuna guida';
};

/* ------------------------------------------------------------------ */
/*  Una colonna: disponibilità e impegni di un istruttore              */
/* ------------------------------------------------------------------ */

type ColumnProps = {
  colIdx: number;
  ins: SchoolInstructor;
  day: InstructorDay;
  date: Date;
  avail: AvailWindow[];
  colorConfig: AgendaColorConfig;
  showVehicle: boolean;
  onPressAppointment: (a: AutoscuolaAppointmentWithRelations) => void;
  onPressExam: (appts: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson: (groupLessonId: string) => void;
  onPressBlock?: (b: InstructorBlock) => void;
};

const SchoolColumn = React.memo(function SchoolColumn({
  colIdx, ins, day, date, avail, colorConfig, showVehicle,
  onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock,
}: ColumnProps) {
  const router = useRouter();
  const x = colIdx * COL_W;

  // Corsie (come il calendario iOS) solo se lo stesso istruttore ha due impegni insieme.
  const lanes = useMemo(() => {
    const items: LaneItem[] = [];
    const detail = new Map<string, { start: number; end: number; text: string; open: () => void }>();
    const add = (key: string, [start, end]: [number, number], text: string, open: () => void) => {
      items.push({ key, start, end });
      detail.set(key, { start, end, text: `${text} · ${fmtMin(start)} – ${fmtMin(end)}`, open });
    };
    for (const a of day.guide) add(`g:${a.id}`, spanOf(a.startsAt, a.endsAt), studentName(a), () => onPressAppointment(a));
    for (const appts of day.exams) {
      const n = appts.filter((a) => !isExamPlaceholder(a)).length;
      add(`e:${appts[0].id}`, spanOf(appts[0].startsAt, appts[0].endsAt), `Esame · ${plural(n, 'allievo', 'allievi')}`, () => onPressExam(appts));
    }
    for (const g of day.groups) {
      const a0 = g.appts[0];
      add(`gr:${g.groupLessonId ?? a0.id}`, spanOf(a0.startsAt, a0.endsAt), 'Guida di gruppo', () => { if (g.groupLessonId) onPressGroupLesson(g.groupLessonId); });
    }
    for (const b of day.blocks) {
      const [sm, em] = blockSpan(b, date);
      if (em <= sm) continue;
      add(`b:${b.id}`, [sm, em], blockLabel(b.reason, BLOCK_PRESENTATION[blockKindOf(b.reason)].short), () => onPressBlock?.(b));
    }
    return { ...layoutLanes(items, Math.floor((COL_W - 8) / LANE_MIN_W)), detail };
  }, [day, date, onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock]);

  const box = (key: string) => {
    const p = lanes.places.get(key);
    if (!p) return null;
    const w = (COL_W - 8) / p.lanes;
    return { left: x + 4 + p.lane * w, width: p.lanes > 1 ? w - LANE_GAP : w };
  };

  const openSlot = useCallback((ov: LaneOverflow) => {
    const rows = ov.all
      .map((key) => ({ key, ...lanes.detail.get(key)! }))
      .sort((a, b) => a.start - b.start);
    if (!rows.length) return;
    Haptics.selectionAsync();
    agendaSlotSheetStore.set({
      title: fmtLongDay(date),
      subtitle: `${ins.name} · ${plural(rows.length, 'impegno', 'impegni')}`,
      rows: rows.map((r) => ({ key: r.key, instructorName: ins.name, instructorUserId: ins.userId, detail: r.text })),
      onPick: (key) => lanes.detail.get(key)?.open(),
    });
    router.push('/(tabs)/home/agenda-slot');
  }, [lanes, date, ins, router]);

  return (
    <>
      <View pointerEvents="none" style={[s.col, { left: x }, colIdx === 0 && s.colFirst]} />
      {avail.map((w, i) => {
        const sm = Math.max(w.startMinutes, DAY_MIN);
        const em = Math.min(w.endMinutes, DAY_MAX);
        if (em <= sm) return null;
        return <View key={`av-${i}`} pointerEvents="none" style={[s.avail, { left: x, top: yOf(sm), height: yOf(em) - yOf(sm) }]} />;
      })}

      {day.guide.map((a) => {
        const b = box(`g:${a.id}`);
        if (!b) return null;
        const [sm, em] = spanOf(a.startsAt, a.endsAt);
        return (
          <GuideBlock
            key={a.id}
            appt={a}
            look={guideLook(a, colorConfig)}
            top={yOf(sm) + 1.5}
            height={Math.max(yOf(em) - yOf(sm) - 3, 24)}
            left={b.left}
            width={b.width}
            startMin={sm}
            endMin={em}
            vehicle={showVehicle ? agendaVehicleLabel(a) : null}
            onPress={onPressAppointment}
          />
        );
      })}

      {day.exams.map((appts) => {
        const a0 = appts[0];
        const b = box(`e:${a0.id}`);
        if (!b) return null;
        const [sm, em] = spanOf(a0.startsAt, a0.endsAt);
        const n = appts.filter((a) => !isExamPlaceholder(a)).length;
        return (
          <EventBlock
            key={`e-${a0.id}`}
            look={EXAM_LOOK}
            title="Esame"
            sub={`${plural(n, 'allievo', 'allievi')} · ${fmtMin(sm)}`}
            top={yOf(sm) + 1.5}
            height={Math.max(yOf(em) - yOf(sm) - 3, 24)}
            left={b.left}
            width={b.width}
            onPress={() => onPressExam(appts)}
          />
        );
      })}

      {day.groups.map(({ groupLessonId, appts }) => {
        const a0 = appts[0];
        const b = box(`gr:${groupLessonId ?? a0.id}`);
        if (!b) return null;
        const [sm, em] = spanOf(a0.startsAt, a0.endsAt);
        const moto = a0.groupLessonKind === 'moto';
        const n = appts.filter((a) => !String(a.id).startsWith('gl-empty:')).length;
        return (
          <EventBlock
            key={`gr-${groupLessonId ?? a0.id}`}
            look={moto ? GROUP_MOTO_LOOK : GROUP_LOOK}
            title={moto ? 'Gruppo moto' : 'Guida di gruppo'}
            sub={`${n}/${a0.groupLessonCapacity ?? GROUP_CAPACITY} · ${fmtMin(sm)}`}
            top={yOf(sm) + 1.5}
            height={Math.max(yOf(em) - yOf(sm) - 3, 24)}
            left={b.left}
            width={b.width}
            onPress={() => { if (groupLessonId) onPressGroupLesson(groupLessonId); }}
          />
        );
      })}

      {day.blocks.map((block) => {
        const b = box(`b:${block.id}`);
        if (!b) return null;
        const [sm, em] = blockSpan(block, date);
        const theory = blockKindOf(block.reason) === 'theory';
        const height = Math.max(yOf(em) - yOf(sm) - 3, 22);
        return (
          <Pressable
            key={`b-${block.id}`}
            onPress={() => onPressBlock?.(block)}
            disabled={!onPressBlock}
            style={[s.block, theory && s.blockSolid, { top: yOf(sm) + 1.5, height, left: b.left, width: b.width }]}
          >
            <Text style={s.blockName} numberOfLines={1}>{blockLabel(block.reason, BLOCK_PRESENTATION[blockKindOf(block.reason)].short)}</Text>
            {height >= 40 ? (
              <Text style={s.blockTime} numberOfLines={1}>{fmtMin(sm)} – {fmtMin(em)}</Text>
            ) : null}
          </Pressable>
        );
      })}

      {lanes.overflows.map((ov, i) => {
        const w = (COL_W - 8) / ov.lanes;
        return (
          <Pressable
            key={`more-${i}`}
            onPress={() => openSlot(ov)}
            accessibilityRole="button"
            accessibilityLabel={`Altri ${ov.hidden.length} impegni di ${ins.name}`}
            style={({ pressed }) => [
              s.more,
              { top: yOf(ov.start) + 1.5, height: Math.max(yOf(ov.end) - yOf(ov.start) - 3, 24), left: x + 4 + ov.lane * w, width: w - LANE_GAP, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={s.moreTx}>+{ov.hidden.length}</Text>
          </Pressable>
        );
      })}
    </>
  );
});

/** Inizio e fine (minuti) di un blocco dentro la griglia del giorno; i blocchi di più giorni si tagliano. */
function blockSpan(b: InstructorBlock, date: Date): [number, number] {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const bs = new Date(b.startsAt);
  const be = new Date(b.endsAt);
  const sm = bs <= dayStart ? DAY_MIN : Math.max(minutesOf(b.startsAt), DAY_MIN);
  const em = be >= dayEnd ? DAY_MAX : Math.min(minutesOf(b.endsAt) || DAY_MAX, DAY_MAX);
  return [sm, em];
}

/* ------------------------------------------------------------------ */
/*  Blocchi                                                            */
/* ------------------------------------------------------------------ */

/** Guida: nome e cognome, orario (o «Assente»), mezzo se l'autoscuola lo mostra. */
const GuideBlock = React.memo(function GuideBlock({
  appt, look, top, height, left, width, startMin, endMin, vehicle, onPress,
}: {
  appt: AutoscuolaAppointmentWithRelations;
  look: AgendaLook;
  top: number; height: number; left: number; width: number;
  startMin: number; endMin: number;
  vehicle: string | null;
  onPress: (a: AutoscuolaAppointmentWithRelations) => void;
}) {
  const noShow = (appt.status ?? '').trim().toLowerCase() === 'no_show';
  const compact = height < 34;
  return (
    <Pressable
      onPress={() => onPress(appt)}
      style={({ pressed }) => [
        s.blk,
        { top, height, left, width, backgroundColor: look.wash, opacity: pressed ? 0.8 : look.muted ? 0.7 : 1, boxShadow: tintShadow(look.glow) },
        look.ring ? { borderWidth: AUTOMATIC_MARKER_WIDTH, borderColor: look.ring } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${studentName(appt)}, ${fmtMin(startMin)} – ${fmtMin(endMin)}${noShow ? ', assente' : ''}`}
    >
      {compact ? (
        <Text style={[s.blkName, s.blkCompact, { color: look.text }]} numberOfLines={1}>
          {appt.student?.lastName || studentName(appt)}{' '}
          <Text style={[s.blkSub, { color: noShow ? NO_SHOW_INK : look.sub }]}>{noShow ? 'Assente' : fmtMin(startMin)}</Text>
        </Text>
      ) : (
        <>
          <Text style={[s.blkName, { color: look.text }]} numberOfLines={1}>{studentName(appt)}</Text>
          <Text style={[s.blkSub, { color: look.sub }]} numberOfLines={1}>
            {noShow ? <>{fmtMin(startMin)} · <Text style={s.absent}>Assente</Text></> : `${fmtMin(startMin)} – ${fmtMin(endMin)}`}
          </Text>
          {vehicle && height >= 52 ? (
            <Text style={[s.blkSub, { color: look.sub }]} numberOfLines={1}>{vehicle}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
});

/** Esame e guida di gruppo: tipo a parole, conteggio e ora. */
const EventBlock = React.memo(function EventBlock({
  look, title, sub, top, height, left, width, onPress,
}: {
  look: AgendaLook;
  title: string;
  sub: string;
  top: number; height: number; left: number; width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.blk,
        { top, height, left, width, backgroundColor: look.wash, opacity: pressed ? 0.8 : 1, boxShadow: tintShadow(look.glow) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
    >
      <Text style={[s.blkName, { color: look.text }]} numberOfLines={1}>{title}</Text>
      {height >= 34 ? <Text style={[s.blkSub, { color: look.sub }]} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/*  Vista                                                              */
/* ------------------------------------------------------------------ */

export function SchoolDayColumns({
  date,
  instructors,
  appointments,
  instructorBlocks,
  availability,
  holidays,
  loading,
  refreshing,
  onRefresh,
  onPressAppointment,
  onPressExam,
  onPressGroupLesson,
  onPressBlock,
  onPressInstructor,
  onCreateAt,
  createKinds,
  carColor,
  ghostResetKey,
  allowedDurations,
  onGhostActiveChange,
}: SchoolDayViewProps) {
  const { width } = useWindowDimensions();
  const barOverlap = useTabBarOverlap();
  const n = instructors.length;
  const dateKey = toDateKey(date);
  const model = useMemo(
    () => buildSchoolDay(date, instructors, appointments, instructorBlocks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey, instructors, appointments, instructorBlocks],
  );
  const dayOf = useCallback((id: string) => model.get(id) ?? emptyInstructorDay(), [model]);

  // Colore dei blocchi = «Aspetto agenda» (un solo punto: agendaLook).
  const agendaSettings = useAutoscuolaSettings();
  const colorConfig = useMemo(() => resolveAgendaColorConfig(agendaSettings.data), [agendaSettings.data]);
  const showVehicle = showVehicleOnBlocks(agendaSettings.data);

  /* ── Ora corrente (linea nera), aggiornata ogni minuto ── */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const now = new Date(nowMs);
  const isToday = toDateKey(now) === dateKey;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMin >= DAY_MIN && nowMin <= DAY_MAX;

  /* ── Scorrimento orizzontale: testata che segue + colonne vicine ── */
  const scrollX = useSharedValue(0);
  const lastCol = useSharedValue(0);
  const [firstCol, setFirstCol] = useState(0);
  const onHScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      const c = Math.max(0, Math.floor(e.contentOffset.x / COL_W));
      if (c !== lastCol.value) {
        lastCol.value = c;
        runOnJS(setFirstCol)(c);
      }
    },
  });
  const headTrack = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.value }] }));
  const inView = Math.ceil((width - GUTTER_W) / COL_W) + 1;
  const fromCol = Math.max(0, firstCol - 1);
  const toCol = Math.min(n - 1, firstCol + inView);
  const visible = useMemo(() => {
    const list: number[] = [];
    for (let i = fromCol; i <= toCol; i++) list.push(i);
    return list;
  }, [fromCol, toCol]);

  /* ── Fantasma: colonna = istruttore ── */
  const { defaultDur } = useGhostDurations(allowedDurations);
  const isOutside = useCallback((info: GhostInfo) => {
    const wins = (info.instructorId ? availability[info.instructorId]?.[toDateKey(info.date)] : null) ?? [];
    return !wins.some((w) => w.startMinutes <= info.startMin && w.endMinutes >= info.startMin + info.durMin);
  }, [availability]);
  const { handleGhostChange, dismissGhost, ghostDismissTick, bar } = useGhostDraft({
    createKinds, carColor, onCreateAt, isOutside, ghostResetKey, onGhostActiveChange, barOverlap,
  });
  const columnAt = useCallback((col: number): GhostColumn | undefined => {
    const ins = instructors[Math.max(0, Math.min(n - 1, col))];
    return ins ? { date, instructorId: ins.id, instructorName: ins.isMe ? 'Tu' : ins.name } : undefined;
  }, [instructors, n, date]);
  const ghost = useGhostPage({ dayMin: DAY_MIN, defaultDur, columnAt, onGhostChange: handleGhostChange, ghostDismissTick });
  const geo = useMemo((): GhostGeometry => ({
    rowH: ROW_H, dayMin: DAY_MIN, dayMax: DAY_MAX,
    x0: 0, colW: COL_W, stride: COL_W, maxCol: Math.max(0, n - 1), edgeLabel: false,
  }), [n]);
  const canBook = !!onCreateAt;

  // Spazi liberi di ogni colonna = la giornata meno gli impegni di quell'istruttore.
  const freeByCol = useMemo(() => instructors.map((ins) => {
    const d = dayOf(ins.id);
    const occ: Array<[number, number]> = [];
    for (const a of d.guide) if ((a.status ?? '').trim().toLowerCase() !== 'cancelled') occ.push(spanOf(a.startsAt, a.endsAt));
    for (const appts of d.exams) occ.push(spanOf(appts[0].startsAt, appts[0].endsAt));
    for (const g of d.groups) occ.push(spanOf(g.appts[0].startsAt, g.appts[0].endsAt));
    for (const b of d.blocks) occ.push(blockSpan(b, date));
    return freeSegments(occ, DAY_MIN, DAY_MAX);
  }), [instructors, dayOf, date]);
  useEffect(() => {
    ghost.gFree.value = freeByCol.map((segs) => segs.flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeByCol]);

  // Cambio di giorno: la bozza sparisce.
  const firstDate = useRef(true);
  useEffect(() => {
    if (firstDate.current) { firstDate.current = false; return; }
    dismissGhost();
  }, [dateKey, dismissGhost]);

  /* ── Scorrimento verticale: all'apertura e a ogni giorno, dove serve ── */
  const vRef = useRef<ScrollView>(null);
  const firstScroll = useRef(true);
  useEffect(() => {
    let target = 8 * 60;
    if (isToday) target = nowMin - 60;
    else {
      let first = Infinity;
      for (const d of model.values()) {
        for (const a of d.guide) first = Math.min(first, minutesOf(a.startsAt));
        for (const appts of d.exams) first = Math.min(first, minutesOf(appts[0].startsAt));
        for (const g of d.groups) first = Math.min(first, minutesOf(g.appts[0].startsAt));
      }
      if (Number.isFinite(first)) target = first - 30;
    }
    const y = Math.max(0, yOf(Math.max(DAY_MIN, target)));
    const animated = !firstScroll.current;
    firstScroll.current = false;
    requestAnimationFrame(() => vRef.current?.scrollTo({ y, animated }));
    // Solo al cambio di giorno (e quando arrivano i primi dati).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, loading]);

  // Esami senza orario del giorno: una riga sopra le colonne.
  const timeless = useMemo(() => {
    const out: Array<{ ins: SchoolInstructor; appts: AutoscuolaAppointmentWithRelations[] }> = [];
    for (const ins of instructors) {
      const t = dayOf(ins.id).timeless;
      if (t.length) out.push({ ins, appts: t });
    }
    return out;
  }, [instructors, dayOf]);

  const hours = useMemo(() => Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i), []);
  const contentW = Math.max(n * COL_W, width - GUTTER_W);
  const holiday = holidays.has(dateKey);

  return (
    <View style={s.root}>
      {holiday || timeless.length ? (
        <View style={s.notes}>
          {holiday ? <Text style={s.note}>Giorno festivo</Text> : null}
          {timeless.map(({ ins, appts }) => {
            const k = appts.filter((a) => !isExamPlaceholder(a)).length;
            return (
              <Pressable
                key={`tl-${ins.id}`}
                onPress={() => onPressExam(appts)}
                style={({ pressed }) => [s.examRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <Text style={s.note} numberOfLines={1}>
                  <Text style={s.noteStrong}>Esame</Text> · orario da definire · {ins.isMe ? 'tu' : instructorShortName(ins.name)} con {plural(k, 'allievo', 'allievi')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Fila dei volti: ferma in alto, segue lo scorrimento orizzontale */}
      <View style={s.headRow}>
        <View style={s.headClip}>
          <Animated.View style={[{ width: n * COL_W, height: HEAD_H }, headTrack]}>
            {instructors.map((ins, i) => (
              <InstructorHead key={ins.id} ins={ins} left={i * COL_W} sub={headSub(dayOf(ins.id))} onPress={onPressInstructor} />
            ))}
          </Animated.View>
        </View>
      </View>

      <ScrollView
        ref={vRef}
        style={s.root}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: barOverlap + 24 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} /> : undefined}
      >
        <View style={{ flexDirection: 'row', height: GRID_H + TOP_PAD * 2 }}>
          {/* Colonna delle ore, ferma a sinistra */}
          <View style={s.gutter} pointerEvents="none">
            {hours.map((h) => (showNow && Math.abs(h * 60 - nowMin) < 14 ? null : (
              <Text key={h} style={[s.hour, { top: TOP_PAD + yOf(h * 60) - 7 }]}>{String(h).padStart(2, '0')}</Text>
            )))}
            {showNow ? <Text style={[s.hour, s.hourNow, { top: TOP_PAD + yOf(nowMin) - 7 }]}>{fmtMin(nowMin)}</Text> : null}
          </View>

          <Animated.ScrollView
            horizontal
            onScroll={onHScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            snapToInterval={COL_W}
            decelerationRate="fast"
            nestedScrollEnabled
            testID="school-day-columns"
          >
            <View style={{ width: contentW, height: GRID_H + TOP_PAD * 2 }}>
              <View style={[s.grid, { width: n * COL_W }]}>
                {hours.map((h) => (
                  <View key={h} pointerEvents="none" style={[s.hline, { top: yOf(h * 60) }]} />
                ))}

                {visible.map((i) => {
                  const ins = instructors[i];
                  return (
                    <SchoolColumn
                      key={ins.id}
                      colIdx={i}
                      ins={ins}
                      day={dayOf(ins.id)}
                      date={date}
                      avail={availability[ins.id]?.[dateKey] ?? EMPTY_AVAIL}
                      colorConfig={colorConfig}
                      showVehicle={showVehicle}
                      onPressAppointment={onPressAppointment}
                      onPressExam={onPressExam}
                      onPressGroupLesson={onPressGroupLesson}
                      onPressBlock={onPressBlock}
                    />
                  );
                })}

                {canBook && visible.map((i) => freeByCol[i]?.map(([sm, em]) => (
                  <GridBookableWindow
                    key={`bk-${instructors[i].id}-${sm}`}
                    geo={geo}
                    page={ghost}
                    top={yOf(sm)}
                    height={yOf(em) - yOf(sm)}
                    left={i * COL_W + 2}
                    width={COL_W - 4}
                    windowStart={sm}
                    windowEnd={em}
                    colIdx={i}
                    defaultDur={defaultDur}
                  />
                )))}

                {loading && appointments.length === 0 && SKELETON.map((sk, k) => (
                  <SkeletonBlock
                    key={`sk-${k}`}
                    height={sk.h * ROW_H}
                    width={COL_W - 8}
                    radius={10}
                    style={{ position: 'absolute', top: yOf(sk.start), left: sk.col * COL_W + 4 }}
                  />
                ))}

                {ghost.ghostOn && canBook ? <GhostBlock geo={geo} page={ghost} onDismiss={dismissGhost} /> : null}

                {showNow ? <View pointerEvents="none" style={[s.nowLine, { top: yOf(nowMin) - 0.75 }]} /> : null}
              </View>
            </View>
          </Animated.ScrollView>
        </View>
      </ScrollView>

      {bar}
    </View>
  );
}

const EMPTY_AVAIL: AvailWindow[] = [];
const SKELETON = [
  { col: 0, start: 8 * 60, h: 1 }, { col: 0, start: 9 * 60, h: 1 }, { col: 0, start: 11 * 60, h: 1.5 },
  { col: 1, start: 8 * 60 + 30, h: 1 }, { col: 1, start: 10 * 60, h: 1 }, { col: 1, start: 12 * 60, h: 1 },
  { col: 2, start: 9 * 60, h: 1.5 }, { col: 2, start: 11 * 60, h: 1 },
];

const s = StyleSheet.create({
  root: { flex: 1 },
  notes: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  note: { fontSize: 14, fontWeight: '500', color: CLAY.ink3 },
  noteStrong: { color: CLAY.ink, fontWeight: '600' },
  examRow: { paddingVertical: 2 },
  headRow: {
    height: HEAD_H,
    paddingLeft: GUTTER_W,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(17,17,17,0.12)',
  },
  headClip: { flex: 1, overflow: 'hidden' },
  head: {
    position: 'absolute',
    top: 0,
    width: COL_W,
    height: HEAD_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  headTx: { flex: 1, minWidth: 0 },
  headName: { fontSize: 13.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  headSub: { fontSize: 11.5, fontWeight: '500', color: CLAY.ink3, marginTop: 1 },
  gutter: { width: GUTTER_W, backgroundColor: '#FFFFFF' },
  hour: {
    position: 'absolute',
    left: 0,
    width: GUTTER_W - 6,
    textAlign: 'right',
    fontSize: 10.5,
    fontWeight: '500',
    color: '#A8A8A8',
    fontVariant: ['tabular-nums'],
  },
  hourNow: { color: CLAY.ink, fontWeight: '600', backgroundColor: '#FFFFFF' },
  grid: { position: 'absolute', top: TOP_PAD, left: 0, height: GRID_H },
  hline: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.09)' },
  col: {
    position: 'absolute',
    top: 0,
    width: COL_W,
    height: GRID_H,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(17,17,17,0.10)',
  },
  colFirst: { borderLeftWidth: 0 },
  avail: { position: 'absolute', width: COL_W, backgroundColor: 'rgba(17,17,17,0.028)' },
  blk: {
    position: 'absolute',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
    overflow: 'hidden',
    zIndex: 3,
  },
  blkName: { fontSize: 12.5, fontWeight: '600', lineHeight: 15, letterSpacing: -0.2 },
  blkCompact: { fontSize: 11.5, lineHeight: 14 },
  blkSub: { fontSize: 11, fontWeight: '500', lineHeight: 14, marginTop: 1, fontVariant: ['tabular-nums'] },
  absent: { color: NO_SHOW_INK, fontWeight: '600' },
  block: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,17,17,0.18)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 4,
    zIndex: 3,
  },
  blockSolid: { borderStyle: 'solid', borderWidth: 0, ...CLAY_SHADOW.raiseSm },
  blockName: { fontSize: 11.5, fontWeight: '600', color: CLAY.ink3, lineHeight: 14 },
  blockTime: { fontSize: 10.5, fontWeight: '500', color: CLAY.ink3, marginTop: 1, fontVariant: ['tabular-nums'] },
  more: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    ...CLAY_SHADOW.raiseSm,
  },
  moreTx: { fontSize: 12, fontWeight: '600', color: CLAY.ink },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: CLAY.ink, zIndex: 10 },
});
