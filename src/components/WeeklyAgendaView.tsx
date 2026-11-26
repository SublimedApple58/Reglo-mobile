import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { asMotoLessonType, MOTO_LESSON_TYPE_ICON } from '../utils/motoLessonType';
import * as Haptics from '../utils/haptics';
import { isExamPlaceholder, BLOCK_PRESENTATION, blockKindOf } from '../utils/weeklyAgenda';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { agendaVehicleLabel, showVehicleOnBlocks } from '../utils/agendaVehicle';
import {
  AUTOMATIC_MARKER_WIDTH,
  resolveAgendaColorConfig,
  type AgendaColorConfig,
} from '../utils/agendaColors';
import { sharedWithNames, unionCoInstructors } from '../utils/coInstructors';
import { EXAM_LOOK as CLAY_EXAM, GROUP_LOOK as CLAY_GROUP, GROUP_MOTO_LOOK as CLAY_GROUP_MOTO, NO_SHOW_INK, blockLabel, guideLook } from '../utils/agendaLook';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { useTabBarOverlap } from './tabBarSpace';
import { useRouter } from 'expo-router';
import {
  ALL_CREATE_KINDS,
  GhostBlock,
  GridBookableWindow,
  fmtLongDay,
  fmtMin,
  freeSegments,
  useGhostDraft,
  useGhostDurations,
  useGhostPage,
  type AgendaCreateKind,
  type AgendaCreateSlot,
  type GhostColumn,
  type GhostGeometry,
  type GhostInfo,
} from './agenda/ghost';
import { layoutLanes, instructorInitials, instructorShortName, type LaneItem, type LaneOverflow } from '../utils/agendaLanes';
import { agendaSlotSheetStore } from '../stores/agendaSlotSheetStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AvailWindow = { startMinutes: number; endMinutes: number };

// Il fantasma vive in `agenda/ghost` (condiviso col giorno della scuola, REG-794).
export type { AgendaCreateKind, AgendaCreateSlot };

type WeeklyAgendaViewProps = {
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks?: InstructorBlock[];
  holidays?: Set<string>;
  /** A date inside the week to open on first render. */
  anchorDate?: Date;
  /** Owner / read-only: no booking, no block removal. */
  readOnly?: boolean;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson?: (groupLessonId: string) => void;
  onPressBlock?: (block: InstructorBlock) => void;
  /**
   * REG-585 — chi sta guardando la griglia. Sui blocchi condivisi mostra
   * l'icona catena + "con <collega>", togliendo i propri panni dai nomi.
   */
  myInstructorId?: string | null;
  /**
   * REG-671 — creazione dal blocco fantasma: il tocco su un tipo della card in
   * basso (Guida, Di gruppo, Esame, Teoria, Blocca) con giorno, inizio e durata
   * del fantasma. Senza, la griglia non crea nulla.
   */
  onCreateAt?: (kind: AgendaCreateKind, slot: AgendaCreateSlot) => void;
  /** Tipi offerti dalla card, nell'ordine (default: tutti). */
  createKinds?: AgendaCreateKind[];
  /** Colore del veicolo dell'istruttore: l'auto 3D della card «Guida». */
  carColor?: string | null;
  /**
   * La griglia mostra più istruttori (titolare, «Tutti gli istruttori»): il
   * fantasma non si ferma sugli eventi degli altri, li controlla il server.
   */
  ghostIgnoresEvents?: boolean;
  /** Cambia → il fantasma sparisce (es. dopo una creazione riuscita). */
  ghostResetKey?: number;
  /**
   * Più istruttori sulla griglia («Tutti gli istruttori», 09/11/2026): sui
   * blocchi compare chi guida (iniziali nelle corsie strette, nome dove ci sta).
   */
  showInstructor?: boolean;
  /** id istruttore → nome e utente: nomi sui blocchi e volti del foglio «+N». */
  instructorDirectory?: Record<string, { name: string; userId?: string | null }>;
  /**
   * Settimana di un collega (REG-794): il suo nome, che la barra del fantasma
   * mostra dopo la fascia («… · Marco»), come nel giorno a colonne.
   */
  ghostInstructorName?: string | null;
  /** Allowed lesson durations (minutes) — the ghost block snaps only to these (same set as the booking modal). */
  allowedDurations?: number[];
  /** Ghost CTA visible/hidden — lets the parent hide the FAB underneath. */
  onGhostActiveChange?: (active: boolean) => void;
  /** Fired when the visible week settles (swipe / "Oggi"). */
  onDateChange?: (weekStart: Date) => void;
  loading?: boolean;
  studentCompletedMinutes?: Record<string, number>;
  /** Availability windows keyed by YYYY-MM-DD (minutes since midnight). */
  weekAvailabilityByDate?: Record<string, AvailWindow[]>;
  /** Pull-to-refresh on the grid. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FIRST_HOUR = 7;
// Upper boundary of the grid. With LAST_HOUR = 24 the last visible row is
// labeled "23:00" and covers 23:00–24:00, so events ending up to midnight render.
const LAST_HOUR = 24;
const ROW_H = 56;
const GUTTER_W = 32;
const COL_GAP = 3;        // gap between day columns (Airbnb-ish breathing room)
const GRID_TOP_PAD = 12;  // breathing room so the first hour label isn't clipped
// Corsie affiancate (09/11/2026): una corsia sotto LANE_MIN_W non è leggibile
// (oltre si passa alla cella «+N»); sotto WIDE_LANE si mostrano solo le iniziali.
const LANE_MIN_W = 16;
const LANE_GAP = 2;
const WIDE_LANE = 44;
const EMPTY_DIRECTORY: Record<string, { name: string; userId?: string | null }> = {};

// Griglia della settimana per il fantasma (agenda/ghost).
const DAY_MIN = FIRST_HOUR * 60;
const DAY_MAX = LAST_HOUR * 60;

// Horizontal week carousel: half a year of swipe each way, centered on "today".
const WEEK_SPAN = 26;

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];
const DAY_LABELS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isSameWeek = (a: Date, b: Date) => isSameDay(getMonday(a), getMonday(b));

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pad = (n: number) => String(n).padStart(2, '0');
const formatWeekLabel = (monday: Date): string => {
  const saturday = addDays(monday, 5);
  const monMonth = MONTH_NAMES[monday.getMonth()];
  const satMonth = MONTH_NAMES[saturday.getMonth()];
  if (monday.getMonth() === saturday.getMonth()) {
    return `${monday.getDate()} – ${saturday.getDate()} ${satMonth}`;
  }
  return `${monday.getDate()} ${monMonth} – ${saturday.getDate()} ${satMonth}`;
};

/* ------------------------------------------------------------------ */
/*  Lesson appearance — mono-navy (Variant A)                          */
/* ------------------------------------------------------------------ */

type LessonLook = { bg: string; text: string; sub: string; pressed: string; ring?: string | null };

// Active guides are navy-filled pills; "spent" states (cancelled / no_show) recede
// to a muted grey so the eye reads the live week at a glance.

const getLessonLook = (
  appt: AutoscuolaAppointmentWithRelations,
  colorConfig: AgendaColorConfig,
): LessonLook & { bar: string | null; muted: boolean; glow: string } => {
  // REG-639: un solo punto per l'aspetto (barretta + tinta leggerissima).
  const l = guideLook(appt, colorConfig);
  return { bg: l.wash, text: l.text, sub: l.sub, pressed: l.wash, ring: l.ring, bar: l.bar, muted: l.muted, glow: l.glow };
};

// Dedicated tinted looks for exams (indigo) and group lessons (teal) — same
// palettes as the day/week views, so the event type reads at a glance.
// Palette allineata alla web app (e alla vista giornaliera): esame lavanda,
// gruppo teal, gruppo moto arancio. Il bordo è la versione satura del fondo.
// `shadow` = l'accento dell'ombra in tinta, gli stessi hex della web app
// (`--agenda-card-shadow` in globals.css) e delle card della giornaliera.
// REG-639 clay: niente viola/teal saturi — stesse tinte della vista Giorno
// (`utils/agendaLook`): fondo leggerissimo, barretta piena, testo nero.
const EXAM_LOOK = { bg: CLAY_EXAM.wash, bar: CLAY_EXAM.bar, text: '#111111', glow: CLAY_EXAM.glow };
const GROUP_LOOK = { bg: CLAY_GROUP.wash, bar: CLAY_GROUP.bar, text: '#111111', glow: CLAY_GROUP.glow };
// Moto group lessons: identical style, ambra.
const GROUP_MOTO_LOOK = { bg: CLAY_GROUP_MOTO.wash, bar: CLAY_GROUP_MOTO.bar, text: '#111111', glow: CLAY_GROUP_MOTO.glow };
/** Ombra morbida in tinta del blocco (REG-639, 29/10): niente bordo, solo tinta + ombra. */
const tintShadow = (color: string) => [{ offsetX: 0, offsetY: 4, blurRadius: 10, spreadDistance: -3, color }];
const GROUP_CAPACITY = 3; // fallback — real capacity comes from the BE row annotation

/**
 * Nomi dei partecipanti nello spazio che avanza sotto il blocco: una guida di
 * gruppo di 3 ore e' alta 168pt e ne usava 30. Si riempie solo quello che
 * avanza davvero — testa (13) + orario (15) + padding (10) = 38pt occupati,
 * poi una riga da 11pt per nome. Se non ci stanno tutti, l'ultima riga dice
 * quanti mancano. In ~39pt di larghezza ci sta un nome di battesimo, quindi e'
 * quello che si mostra.
 */
const EventStudentNames = ({ names, height, color }: { names: string[]; height: number; color: string }) => {
  if (!names.length) return null;
  const slots = Math.floor((height - 40) / 11);
  if (slots < 1) return null;
  const shown = names.length <= slots ? names : names.slice(0, Math.max(1, slots - 1));
  const rest = names.length - shown.length;
  return (
    <View style={styles.eventNames}>
      {shown.map((n, i) => (
        <Text key={i} style={[styles.eventNameLine, { color }]} numberOfLines={1}>{n}</Text>
      ))}
      {rest > 0 ? (
        <Text style={[styles.eventNameLine, { color, opacity: 0.65 }]} numberOfLines={1}>+{rest}</Text>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Skeleton pulse block                                               */
/* ------------------------------------------------------------------ */

const SkeletonBlock = ({ style }: { style: object }) => {
  const opacity = useSharedValue(0.10);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.22, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ backgroundColor: '#111111', opacity: opacity.value }));
  return <Animated.View style={[style, animStyle]} />;
};

const SKELETON_BLOCKS = [
  { col: 0, top: 2.5, h: 1.2 },
  { col: 1, top: 1.0, h: 1.0 },
  { col: 1, top: 4.0, h: 0.8 },
  { col: 2, top: 0.5, h: 1.5 },
  { col: 3, top: 3.0, h: 1.0 },
  { col: 3, top: 5.5, h: 0.8 },
  { col: 4, top: 1.5, h: 1.0 },
  { col: 5, top: 3.5, h: 1.2 },
];

/* ------------------------------------------------------------------ */
/*  One week page (day header + vertical hour grid)                    */
/* ------------------------------------------------------------------ */

type WeekPageProps = {
  monday: Date;
  pageWidth: number;
  pageHeight: number;
  colW: number;
  today: Date;
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks: InstructorBlock[];
  holidays: Set<string>;
  weekAvailabilityByDate: Record<string, AvailWindow[]>;
  studentCompletedMinutes: Record<string, number>;
  readOnly: boolean;
  loading: boolean;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson?: (groupLessonId: string) => void;
  onPressBlock?: (block: InstructorBlock) => void;
  /** REG-585 — chi guarda: serve al segnale "condivisa con" sui blocchi. */
  myInstructorId?: string | null;
  /** Ghost-block booking enabled (instructor, not read-only). */
  canBook: boolean;
  /** Durata con cui nasce il fantasma (una di quelle consentite). */
  defaultDur: number;
  /** Ghost placed (info) or lifted/dismissed (null) → parent drives the CTA. */
  onGhostChange: (info: GhostInfo | null) => void;
  /** Parent bumps this to clear the ghost (tap on the draft / confirm / week swipe). */
  ghostDismissTick: number;
  /** Tocco sulla bozza: la toglie (il genitore spegne anche la barra). */
  onGhostDismiss: () => void;
  /** Più istruttori sulla griglia: il fantasma non si ferma sugli eventi. */
  ghostIgnoresEvents: boolean;
  /** Pull-to-refresh on the vertical grid scroll. */
  refreshing: boolean;
  onRefresh?: () => void;
  showInstructor: boolean;
  instructorDirectory: Record<string, { name: string; userId?: string | null }>;
  ghostInstructorName: string | null;
};

const WeekPage = React.memo(function WeekPage({
  monday, pageWidth, pageHeight, colW, today, appointments, instructorBlocks, holidays,
  weekAvailabilityByDate, readOnly, loading,
  onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock, myInstructorId,
  canBook, defaultDur, onGhostChange, ghostDismissTick, onGhostDismiss, ghostIgnoresEvents,
  refreshing, onRefresh, showInstructor, instructorDirectory, ghostInstructorName,
}: WeekPageProps) {
  // Tab bar in vetro sopra la griglia: l'ultima ora resta raggiungibile.
  const barOverlap = useTabBarOverlap();
  const colX = (i: number) => GUTTER_W + i * (colW + COL_GAP);
  const gridHeight = (LAST_HOUR - FIRST_HOUR) * ROW_H;

  // Config colore blocchi (pannello web "Aspetto"): criterio + override +
  // eccezioni dai settings company. Cache-first, default sicuri se assenti.
  const agendaSettings = useAutoscuolaSettings();
  const colorConfig = useMemo(() => resolveAgendaColorConfig(agendaSettings.data), [agendaSettings.data]);
  // REG-633: nome del mezzo nei blocchi, se l'autoscuola l'ha acceso.
  const showVehicle = showVehicleOnBlocks(agendaSettings.data);

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), [monday]);

  /* ── Fantasma (agenda/ghost): colonna = giorno della settimana ── */
  const columnAt = useCallback((col: number): GhostColumn | undefined => {
    const date = weekDays[Math.max(0, Math.min(5, col))];
    return date ? { date, instructorName: ghostInstructorName } : undefined;
  }, [weekDays, ghostInstructorName]);
  const ghost = useGhostPage({ dayMin: DAY_MIN, defaultDur, columnAt, onGhostChange, ghostDismissTick });
  const { gFree } = ghost;
  const geo = useMemo((): GhostGeometry => ({
    rowH: ROW_H, dayMin: DAY_MIN, dayMax: DAY_MAX,
    x0: GUTTER_W, colW, stride: colW + COL_GAP, maxCol: 5, edgeLabel: true,
  }), [colW]);
  const hours = useMemo(() => Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i), []);
  const isCurrentWeek = isSameWeek(monday, today);

  const appointmentsByCol = useMemo(() => {
    const buckets: AutoscuolaAppointmentWithRelations[][] = Array.from({ length: 6 }, () => []);
    for (const appt of appointments) {
      const start = new Date(appt.startsAt);
      const dow = start.getDay();
      if (dow === 0) continue;
      const colIdx = dow - 1;
      if (colIdx > 5) continue;
      const ad = new Date(start); ad.setHours(0, 0, 0, 0);
      const cd = new Date(weekDays[colIdx]); cd.setHours(0, 0, 0, 0);
      if (ad.getTime() !== cd.getTime()) continue;
      buckets[colIdx].push(appt);
    }
    return buckets;
  }, [appointments, weekDays]);

  const blocksByCol = useMemo(() => {
    const buckets: InstructorBlock[][] = Array.from({ length: 6 }, () => []);
    for (const block of instructorBlocks) {
      const start = new Date(block.startsAt);
      const dow = start.getDay();
      if (dow === 0) continue;
      const colIdx = dow - 1;
      if (colIdx > 5) continue;
      const bd = new Date(start); bd.setHours(0, 0, 0, 0);
      const cd = new Date(weekDays[colIdx]); cd.setHours(0, 0, 0, 0);
      if (bd.getTime() !== cd.getTime()) continue;
      buckets[colIdx].push(block);
    }
    return buckets;
  }, [instructorBlocks, weekDays]);

  // Split each column's appointments into the four dedicated event kinds:
  // individual guide pills, collapsed timed-exam slots, collapsed group lessons,
  // and timeless exams (no time → shown in the all-day lane).
  const eventsByCol = useMemo(() => {
    const slotKey = (a: AutoscuolaAppointmentWithRelations) => `${a.startsAt}|${a.endsAt ?? ''}|${a.instructorId ?? ''}`;
    return weekDays.map((_day, colIdx) => {
      const guide: AutoscuolaAppointmentWithRelations[] = [];
      const timeless: AutoscuolaAppointmentWithRelations[] = [];
      const examMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
      const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
      for (const a of appointmentsByCol[colIdx]) {
        const status = (a.status ?? '').trim().toLowerCase();
        if (a.type === 'esame') {
          if (!a.endsAt) { if (status !== 'cancelled') timeless.push(a); continue; }
          const k = slotKey(a);
          const arr = examMap.get(k); if (arr) arr.push(a); else examMap.set(k, [a]);
        } else if (a.type === 'group_lesson') {
          const k = a.groupLessonId ?? slotKey(a);
          const arr = groupMap.get(k); if (arr) arr.push(a); else groupMap.set(k, [a]);
        } else {
          guide.push(a);
        }
      }
      const exams = Array.from(examMap.values());
      const groups = Array.from(groupMap.entries()).map(([key, appts]) => ({
        groupLessonId: appts[0].groupLessonId ?? (key.includes('|') ? null : key),
        appts,
      }));
      return { guide, exams, groups, timeless };
    });
  }, [appointmentsByCol, weekDays]);

  const weekHasTimeless = useMemo(
    () => eventsByCol.some((c) => c.timeless.length > 0),
    [eventsByCol],
  );

  // Availability veil (informational, light) — merged windows, does NOT gate booking.
  const availTintByCol = useMemo(() => weekDays.map((day) => {
    const rawSlots = weekAvailabilityByDate[toDateKey(day)] ?? [];
    if (!rawSlots.length) return [] as Array<[number, number]>;
    const raw: Array<[number, number]> = rawSlots
      .map((s) => [Math.max(s.startMinutes, FIRST_HOUR * 60), Math.min(s.endMinutes, LAST_HOUR * 60)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const w of raw) {
      const last = merged[merged.length - 1];
      if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
      else merged.push([w[0], w[1]]);
    }
    return merged;
  }), [weekDays, weekAvailabilityByDate]);

  // Bookable free segments = whole day (07–24) minus occupied (non-cancelled guide + blocks).
  const bookableByCol = useMemo(() => {
    const DAY_START = FIRST_HOUR * 60;
    const DAY_END = LAST_HOUR * 60;
    return weekDays.map((_day, colIdx) => {
      if (ghostIgnoresEvents) {
        const all: Array<[number, number]> = [[DAY_START, DAY_END]];
        return { segments: all, starts: [] as number[] };
      }
      const occupied: Array<[number, number]> = [];
      for (const a of appointmentsByCol[colIdx]) {
        if ((a.status ?? '').trim().toLowerCase() === 'cancelled') continue;
        if (a.type === 'esame' && !a.endsAt) continue; // timeless exam: no real time block
        const s = new Date(a.startsAt);
        const sm = s.getHours() * 60 + s.getMinutes();
        let em = sm + 60;
        if (a.endsAt) { const e = new Date(a.endsAt); em = e.getHours() * 60 + e.getMinutes(); }
        if (em > sm) occupied.push([sm, em]);
      }
      for (const b of blocksByCol[colIdx]) {
        const s = new Date(b.startsAt); const e = new Date(b.endsAt);
        const sm = s.getHours() * 60 + s.getMinutes();
        const em = e.getHours() * 60 + e.getMinutes();
        if (em > sm) occupied.push([sm, em]);
      }
      const segs = freeSegments(occupied, DAY_START, DAY_END);
      const starts: number[] = [];
      for (const [s, e] of segs) for (let m = s; m <= e - 15; m += 15) starts.push(m);
      return { segments: segs, starts };
    });
  }, [weekDays, appointmentsByCol, blocksByCol, ghostIgnoresEvents]);

  // Keep the UI-thread copy of the free segments per column in sync, so the
  // ghost-drag worklets can clamp the block to never overlap a guide/block.
  useEffect(() => {
    gFree.value = bookableByCol.map((c) => c.segments.flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookableByCol]);

  /* ── Corsie affiancate (09/11/2026) ──
   * Gli impegni che si sovrappongono davvero si dividono la colonna; se le
   * corsie non ci stanno, l'ultima diventa «+N» (foglio con la fascia). Per
   * ogni impegno teniamo anche nome dell'istruttore, riga di dettaglio e
   * tocco: servono alla cella «+N», che apre la lista senza chiamate. */
  const router = useRouter();
  const laneCap = Math.max(1, Math.floor((colW - 4) / LANE_MIN_W));
  const lanesByCol = useMemo(() => weekDays.map((_day, colIdx) => {
    const items: LaneItem[] = [];
    const info = new Map<string, { start: number; end: number; instructorName: string; instructorUserId: string | null; detail: string; open: () => void }>();
    const nameOf = (id: string | null | undefined, fallback?: string | null) =>
      fallback || (id ? instructorDirectory[id]?.name : '') || 'Istruttore';
    const span = (startsAt: string, endsAt: string | null | undefined): [number, number] => {
      const st = new Date(startsAt);
      const sm = st.getHours() * 60 + st.getMinutes();
      const dur = endsAt ? (new Date(endsAt).getTime() - st.getTime()) / 60000 : 60;
      return [sm, sm + Math.max(dur, 1)];
    };
    const add = (key: string, [start, end]: [number, number], instructorId: string | null | undefined, instructorName: string | null | undefined, what: string, open: () => void) => {
      items.push({ key, start, end });
      info.set(key, {
        start, end,
        instructorName: nameOf(instructorId, instructorName),
        instructorUserId: (instructorId && instructorDirectory[instructorId]?.userId) || null,
        detail: `${what} · ${fmtMin(start)} – ${fmtMin(end)}`,
        open,
      });
    };
    const { guide, exams, groups } = eventsByCol[colIdx];
    for (const a of guide) {
      const who = [a.student?.lastName, a.student?.firstName].filter(Boolean).join(' ') || 'Guida';
      add(`g:${a.id}`, span(a.startsAt, a.endsAt), a.instructorId, a.instructor?.name, who, () => onPressAppointment(a));
    }
    for (const appts of exams) {
      const a0 = appts[0];
      const n = appts.filter((a) => !isExamPlaceholder(a)).length;
      add(`e:${a0.id}`, span(a0.startsAt, a0.endsAt), a0.instructorId, a0.instructor?.name,
        `Esame · ${n} ${n === 1 ? 'allievo' : 'allievi'}`, () => onPressExam?.(appts));
    }
    for (const { groupLessonId, appts } of groups) {
      const a0 = appts[0];
      const n = appts.filter((a) => !String(a.id).startsWith('gl-empty:')).length;
      add(`gr:${groupLessonId ?? a0.id}`, span(a0.startsAt, a0.endsAt), a0.instructorId, a0.instructor?.name,
        `Guida di gruppo · ${n}/${a0.groupLessonCapacity ?? GROUP_CAPACITY}`, () => { if (groupLessonId) onPressGroupLesson?.(groupLessonId); });
    }
    for (const b of blocksByCol[colIdx]) {
      const bs = new Date(b.startsAt); const be = new Date(b.endsAt);
      const sm = Math.max(bs.getHours() * 60 + bs.getMinutes(), FIRST_HOUR * 60);
      const em = Math.min((be.getHours() * 60 + be.getMinutes()) || LAST_HOUR * 60, LAST_HOUR * 60);
      if (em <= sm) continue;
      const label = blockLabel(b.reason, BLOCK_PRESENTATION[blockKindOf(b.reason)].short);
      add(`b:${b.id}`, [sm, em], b.instructorId, null, label, () => onPressBlock?.(b));
    }
    return { ...layoutLanes(items, laneCap), info };
  }), [weekDays, eventsByCol, blocksByCol, laneCap, instructorDirectory, onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock]);

  // Posto di un impegno nella colonna; null = nascosto dietro «+N».
  const laneBox = (colIdx: number, key: string) => {
    const p = lanesByCol[colIdx].places.get(key);
    if (!p) return null;
    const w = (colW - 4) / p.lanes;
    return {
      left: colX(colIdx) + 2 + p.lane * w,
      width: p.lanes > 1 ? w - LANE_GAP : w,
      narrow: w < WIDE_LANE,
      tiny: w < 22,
    };
  };

  const openSlot = useCallback((colIdx: number, ov: LaneOverflow) => {
    const info = lanesByCol[colIdx].info;
    const rows = ov.all
      .map((key) => ({ key, ...info.get(key)! }))
      .filter((r) => r.instructorName)
      .sort((a, b) => a.start - b.start || a.instructorName.localeCompare(b.instructorName, 'it'));
    if (!rows.length) return;
    const from = Math.min(...rows.map((r) => r.start));
    const to = Math.max(...rows.map((r) => r.end));
    Haptics.selectionAsync();
    agendaSlotSheetStore.set({
      title: fmtLongDay(weekDays[colIdx]),
      subtitle: `${fmtMin(from)} – ${fmtMin(to)} · ${rows.length} impegni`,
      rows: rows.map((r) => ({ key: r.key, instructorName: r.instructorName, instructorUserId: r.instructorUserId, detail: r.detail })),
      onPick: (key) => info.get(key)?.open(),
    });
    router.push('/(tabs)/home/agenda-slot');
  }, [lanesByCol, weekDays, router]);

  const holidayCols = useMemo(
    () => new Set(weekDays.map((d, i) => (holidays.has(toDateKey(d)) ? i : -1)).filter((i) => i >= 0)),
    [weekDays, holidays],
  );

  const nowLineTop = useMemo(() => {
    if (!isCurrentWeek) return null;
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    const off = (m - FIRST_HOUR * 60) / 60;
    if (off < 0 || off > LAST_HOUR - FIRST_HOUR) return null;
    return off * ROW_H;
  }, [isCurrentWeek]);

  const todayColIdx = useMemo(() => {
    if (!isCurrentWeek) return -1;
    return weekDays.findIndex((d) => isSameDay(d, today));
  }, [isCurrentWeek, weekDays, today]);

  return (
    <View style={{ width: pageWidth, height: pageHeight }}>
      {/* Day header (slides with the week) */}
      <View style={styles.dayHeaderRow}>
        <View style={{ width: GUTTER_W }} />
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const isHoliday = holidayCols.has(idx);
          return (
            <View key={idx} style={[styles.dayHeaderCell, { width: colW, marginLeft: idx === 0 ? 0 : COL_GAP }]}>
              <Text
                style={[
                  styles.dayLetter,
                  isPast && !isHoliday && { color: '#CCCCCC' },
                  isToday && { color: '#111111' },
                  isHoliday && { color: '#B4B4B4', textDecorationLine: 'line-through' },
                ]}
              >
                {DAY_LABELS[idx]}
              </Text>
              {isToday ? (
                <View style={styles.todayCircle}>
                  <Text style={styles.todayCircleText}>{day.getDate()}</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.dayNumber,
                    isPast && !isHoliday && { color: '#CCCCCC' },
                    isHoliday && { color: '#B4B4B4', textDecorationLine: 'line-through' },
                  ]}
                >
                  {day.getDate()}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Timeless exams (no time yet) — prominent canonical exam card per day */}
      {weekHasTimeless && (
        <View style={styles.timelessWrap}>
          {eventsByCol.map(({ timeless }, colIdx) => {
            if (!timeless.length) return null;
            const day = weekDays[colIdx];
            const dayLabel = day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
            const n = timeless.filter((a) => !isExamPlaceholder(a)).length;
            return (
              <Pressable
                key={`tl-${colIdx}`}
                onPress={() => onPressExam?.(timeless)}
                style={({ pressed }) => [styles.examBanner, pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] }]}
              >
                <View style={styles.examBannerClip} pointerEvents="none">
                  <View style={styles.examBannerBar} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examBannerLabel}>Esame · {dayLabel}</Text>
                  <Text style={styles.examBannerTitle} numberOfLines={1}>
                    {n === 0 ? 'Nessun allievo' : `${n} ${n === 1 ? 'allievo' : 'allievi'}`} · Orario da definire
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Scrollable time grid */}
      <ScrollView
        style={styles.scrollView}
        nestedScrollEnabled
        contentContainerStyle={{ height: gridHeight + GRID_TOP_PAD + 110 + barOverlap, paddingHorizontal: 12, paddingTop: GRID_TOP_PAD }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111111"
              colors={['#111111']}
            />
          ) : undefined
        }
      >
        {/* Column canvases — recessed grey = closed/unavailable */}
        {weekDays.map((_day, colIdx) => {
          const isHoliday = holidayCols.has(colIdx);
          const isTodayCol = colIdx === todayColIdx;
          return (
            <View
              key={`canvas-${colIdx}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: colX(colIdx),
                width: colW,
                height: gridHeight,
                // REG-639 clay: colonne bianche separate da un filetto (niente grigio).
                backgroundColor: '#FFFFFF',
                borderLeftWidth: colIdx === 0 ? 0 : StyleSheet.hairlineWidth,
                borderLeftColor: isHoliday || isTodayCol ? 'rgba(17,17,17,0.14)' : 'rgba(17,17,17,0.08)',
              }}
            />
          );
        })}

        {/* Availability veil — faint light hint only (does not gate booking).
            Rendered BEFORE the hour gridlines so the lines stay visible on top
            of the white availability blocks. */}
        {availTintByCol.map((wins, colIdx) =>
          wins.map(([sMin, eMin], i) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <View
                key={`avt-${colIdx}-${i}`}
                pointerEvents="none"
                style={[styles.availTint, { top, height, left: colX(colIdx), width: colW }]}
              />
            );
          }),
        )}

        {/* Hour gridlines + labels — drawn over the availability veils */}
        {hours.map((hour, idx) => (
          <View
            key={hour}
            pointerEvents="none"
            style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
          >
            <Text style={styles.hourLabel}>{pad(hour)}</Text>
            {idx > 0 && (
              <View style={{ position: 'absolute', top: 0, left: GUTTER_W, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#E2E2E2' }} />
            )}
          </View>
        ))}

        {/* Bookable free segments — invisible press-and-hold ghost surfaces */}
        {canBook && bookableByCol.map(({ segments }, colIdx) =>
          segments.map(([sMin, eMin], si) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <GridBookableWindow
                key={`bk-${colIdx}-${si}`}
                geo={geo} page={ghost}
                top={top} height={height} left={colX(colIdx) + 2} width={colW - 4}
                windowStart={sMin} windowEnd={eMin}
                colIdx={colIdx} defaultDur={defaultDur}
              />
            );
          }),
        )}

        {/* Skeleton blocks */}
        {loading && appointments.length === 0 && SKELETON_BLOCKS.map((sk, i) => (
          <SkeletonBlock
            key={`sk-${i}`}
            style={{
              position: 'absolute',
              top: sk.top * ROW_H,
              height: sk.h * ROW_H,
              left: colX(sk.col) + 3,
              width: colW - 4,
              borderRadius: 12,
            }}
          />
        ))}

        {/* Individual guide pills (navy-filled, rounded, 3D) */}
        {eventsByCol.map(({ guide }, colIdx) =>
          guide.map((appt) => {
            const start = new Date(appt.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (appt.endsAt) dur = (new Date(appt.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const box = laneBox(colIdx, `g:${appt.id}`);
            if (!box) return null;
            const look = getLessonLook(appt, colorConfig);
            const label = [appt.student?.lastName, appt.student?.firstName].filter(Boolean).join(' ') || 'Guida';
            const showTime = height >= 40;
            const instrName = appt.instructor?.name ?? (appt.instructorId ? instructorDirectory[appt.instructorId]?.name : null);
            // Corsia stretta con più istruttori: in cima le iniziali di chi guida,
            // sotto il cognome dell'allievo se la corsia lo regge.
            const initialsFirst = showInstructor && box.narrow;
            const baseLine1 = initialsFirst ? instructorInitials(instrName) : box.narrow ? (appt.student?.lastName || label) : label;
            const baseLine2 = initialsFirst
              ? (!box.tiny && showTime ? (appt.student?.lastName || label) : null)
              : showTime
                ? (showInstructor ? instructorShortName(instrName) : `${pad(start.getHours())}:${pad(start.getMinutes())}`)
                : null;
            // REG-785: allievo assente scritto, non solo il blocco ingrigito.
            // «Assente» in rosso semantico al posto dell'orario (l'ora la dice
            // già la posizione del blocco, e in colonna stretta «10:00 ·
            // Assente» finiva tagliato); nei blocchi senza seconda riga (30
            // min) un glifo rosso davanti al nome. Le corsie con le iniziali
            // dell'istruttore restano come sono (non c'è posto).
            const noShow = (appt.status ?? '').trim().toLowerCase() === 'no_show' && !initialsFirst;
            const line1 = noShow && !baseLine2
              ? <><Ionicons name="person-remove-outline" size={10} color={NO_SHOW_INK} />{` ${baseLine1}`}</>
              : baseLine1;
            const line2 = noShow && baseLine2 ? <Text style={styles.lessonAbsent}>Assente</Text> : baseLine2;
            // Terza riga solo se c'è spazio (da ~50pt, cioè un'ora o più).
            const vehicleLabel = showVehicle && height >= 50 && !box.narrow ? agendaVehicleLabel(appt) : null;
            return (
              <Pressable
                key={appt.id}
                onPress={() => onPressAppointment(appt)}
                style={({ pressed }) => [
                  styles.lesson,
                  { top, height, left: box.left, width: box.width, backgroundColor: look.bg, opacity: pressed ? 0.8 : look.muted ? 0.7 : 1, boxShadow: tintShadow(look.glow) },
                  look.ring ? { borderWidth: AUTOMATIC_MARKER_WIDTH, borderColor: look.ring } : null,
                ]}
              >
                {look.bar ? <View style={[styles.eventBar, { backgroundColor: look.bar }]} /> : null}
                <View style={[styles.lessonInner, box.narrow && styles.innerNarrow, box.tiny && styles.innerTiny]}>
                  <Text style={[styles.lessonName, initialsFirst && styles.laneInitials, initialsFirst && box.tiny && styles.laneInitialsTiny, { color: look.text }]} numberOfLines={1} ellipsizeMode={initialsFirst ? 'clip' : 'tail'}>{line1}</Text>
                  {line2 ? (
                    <Text style={[styles.lessonTime, { color: look.sub }]} numberOfLines={1} ellipsizeMode="tail">
                      {line2}
                    </Text>
                  ) : null}
                  {vehicleLabel ? (
                    <Text style={[styles.lessonVehicle, { color: look.sub }]} numberOfLines={1}>
                      {vehicleLabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Esami — card lavanda: icona + conteggio, orario, nomi se c'e' spazio */}
        {eventsByCol.map(({ exams }, colIdx) =>
          exams.map((appts) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const box = laneBox(colIdx, `e:${a0.id}`);
            if (!box) return null;
            const examInitials = showInstructor ? instructorInitials(a0.instructor?.name ?? (a0.instructorId ? instructorDirectory[a0.instructorId]?.name : null)) : '';
            const examStudents = appts.filter((a) => !isExamPlaceholder(a));
            const examCount = examStudents.length;
            const examNames = examStudents
              .map((a) => a.student?.firstName || a.student?.lastName || '')
              .filter(Boolean);
            // REG-585: l'esame può essere accompagnato da un collega. Il join sta
            // su OGNI riga-allievo → unione, non la prima riga.
            const withNames = sharedWithNames(
              { instructorId: a0.instructorId ?? null, instructorName: a0.instructor?.name ?? null, coInstructors: unionCoInstructors(appts) },
              myInstructorId,
            );
            return (
              <Pressable
                key={`exam-${colIdx}-${a0.id}`}
                onPress={() => onPressExam?.(appts)}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: box.left, width: box.width, backgroundColor: EXAM_LOOK.bg, opacity: pressed ? 0.8 : 1, boxShadow: tintShadow(EXAM_LOOK.glow) },
                ]}
              >
                {EXAM_LOOK.bar ? <View style={[styles.eventBar, { backgroundColor: EXAM_LOOK.bar }]} /> : null}
                <View style={[styles.eventInner, box.narrow && styles.innerNarrow, box.tiny && styles.innerTiny, { backgroundColor: EXAM_LOOK.bg }]}>
                {/* In colonna da ~39pt utili il titolo a parole non ci sta: il
                    tipo lo dicono colore e icona, le parole restano nello sheet. */}
                <View style={styles.eventHead}>
                  <Ionicons name="school" size={12} color={EXAM_LOOK.text} />
                  {examCount > 0 && !box.tiny ? (
                    <Text style={[styles.eventCount, { color: EXAM_LOOK.text }]} numberOfLines={1}>{examCount}</Text>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  {withNames.length ? <Ionicons name="link" size={9} color={EXAM_LOOK.text} /> : null}
                </View>
                {examInitials ? (
                  <Text style={[styles.laneInitials, box.tiny && styles.laneInitialsTiny, { color: EXAM_LOOK.text, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="clip">{examInitials}</Text>
                ) : null}
                {height >= 40 && !box.narrow && (
                  <Text style={[styles.eventTime, { color: EXAM_LOOK.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}
                  </Text>
                )}
                {box.narrow ? null : <EventStudentNames names={examNames} height={height - (examInitials ? 14 : 0)} color={EXAM_LOOK.text} />}
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Guide di gruppo — card teal (arancio se moto): posti N/C + nomi */}
        {eventsByCol.map(({ groups }, colIdx) =>
          groups.map(({ groupLessonId, appts }) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const box = laneBox(colIdx, `gr:${groupLessonId ?? a0.id}`);
            if (!box) return null;
            const glInitials = showInstructor ? instructorInitials(a0.instructor?.name ?? (a0.instructorId ? instructorDirectory[a0.instructorId]?.name : null)) : '';
            const look = a0.groupLessonKind === 'moto' ? GROUP_MOTO_LOOK : GROUP_LOOK;
            const glMotoType = a0.groupLessonKind === 'moto' ? asMotoLessonType(a0.groupLessonMotoType) : null;
            const glStudents = appts.filter((a) => !String(a.id).startsWith('gl-empty:'));
            const glNames = glStudents
              .map((a) => a.student?.firstName || a.student?.lastName || '')
              .filter(Boolean);
            // REG-585: guida di gruppo portata insieme a un collega.
            const withNames = sharedWithNames(
              { instructorId: a0.instructorId ?? null, instructorName: a0.instructor?.name ?? null, coInstructors: unionCoInstructors(appts) },
              myInstructorId,
            );
            return (
              <Pressable
                key={`group-${colIdx}-${groupLessonId ?? a0.id}`}
                onPress={() => { if (groupLessonId) onPressGroupLesson?.(groupLessonId); }}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: box.left, width: box.width, backgroundColor: look.bg, opacity: pressed ? 0.8 : 1, boxShadow: tintShadow(look.glow) },
                ]}
              >
                {look.bar ? <View style={[styles.eventBar, { backgroundColor: look.bar }]} /> : null}
                <View style={[styles.eventInner, box.narrow && styles.innerNarrow, box.tiny && styles.innerTiny, { backgroundColor: look.bg }]}>
                {/* Stessa regola dell'esame: niente parole, il tipo sta nel
                    colore e nell'icona. Per i gruppi moto l'icona è già quella
                    di birilli/strada — la pill con la parola veniva tagliata. */}
                <View style={styles.eventHead}>
                  {a0.groupLessonKind === 'moto' ? (
                    <MaterialCommunityIcons
                      name={glMotoType ? MOTO_LESSON_TYPE_ICON[glMotoType] : 'motorbike'}
                      size={12}
                      color={look.text}
                    />
                  ) : (
                    <Ionicons name="people" size={12} color={look.text} />
                  )}
                  {box.tiny ? null : (
                    <Text style={[styles.eventCount, { color: look.text }]} numberOfLines={1}>
                      {glStudents.length}/{a0.groupLessonCapacity ?? GROUP_CAPACITY}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  {withNames.length ? <Ionicons name="link" size={9} color={look.text} /> : null}
                </View>
                {glInitials ? (
                  <Text style={[styles.laneInitials, box.tiny && styles.laneInitialsTiny, { color: look.text, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="clip">{glInitials}</Text>
                ) : null}
                {height >= 40 && !box.narrow && (
                  <Text style={[styles.eventTime, { color: look.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}
                  </Text>
                )}
                {box.narrow ? null : <EventStudentNames names={glNames} height={height - (glInitials ? 14 : 0)} color={look.text} />}
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Instructor blocks — dashed, tinted (Malattia / Bloccato) */}
        {blocksByCol.map((colBlocks, colIdx) =>
          colBlocks.map((block) => {
            const bStart = new Date(block.startsAt);
            const bEnd = new Date(block.endsAt);
            const sm = bStart.getHours() * 60 + bStart.getMinutes();
            const em = bEnd.getHours() * 60 + bEnd.getMinutes();
            const clampedSm = Math.max(sm, FIRST_HOUR * 60);
            const clampedEm = Math.min(em || LAST_HOUR * 60, LAST_HOUR * 60);
            if (clampedEm <= clampedSm) return null;
            const top = ((clampedSm - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = Math.max(((clampedEm - clampedSm) / 60) * ROW_H, 24);
            const bKind = blockKindOf(block.reason);
            const p = BLOCK_PRESENTATION[bKind];
            // REG-639 clay: blocchi neutri e quieti (bianco, tratteggio grigio,
            // testo grigio); la pausa tra guide si legge «Pausa».
            const tint = { bg: '#FFFFFF', border: 'rgba(17,17,17,0.18)', text: '#6A6A6A', icon: p.icon as any };
            const box = laneBox(colIdx, `b:${block.id}`);
            if (!box) return null;
            const blockInitials = showInstructor ? instructorInitials(instructorDirectory[block.instructorId]?.name) : '';
            const baseLabel = blockLabel(block.reason, p.short);
            const label = blockInitials ? (box.narrow ? blockInitials : `${baseLabel} · ${blockInitials}`) : baseLabel;
            // La lezione teorica è un evento (non un'assenza): rettangolo PIENO
            // indaco, niente bordo tratteggiato — come le guide/esami in griglia.
            const isTheory = bKind === 'theory';
            return (
              <Pressable
                key={`block-${block.id}`}
                onPress={() => onPressBlock?.(block)}
                disabled={!onPressBlock}
                style={[
                  styles.block,
                  isTheory && styles.blockSolid,
                  box.narrow && styles.blockNarrow,
                  box.tiny && styles.innerTiny,
                  { top, height, left: box.left, width: box.width, backgroundColor: tint.bg, borderColor: isTheory ? tint.bg : tint.border },
                ]}
              >
                {/* Teorica: niente icona (in colonna stretta si sovrappone al titolo) */}
                {/* Spazio utile = altezza − bordo (2×1.5). Sotto 13pt niente scritta
                    (resta il tratteggio), sotto 20pt carattere più piccolo. */}
                {height - 3 >= 13 ? (
                  <Text
                    style={[styles.blockName, height - 3 < 20 && styles.blockNameSm, { color: tint.text }]}
                    numberOfLines={1}
                    ellipsizeMode={box.narrow ? 'clip' : 'tail'}
                  >
                    {label}
                  </Text>
                ) : null}
                {height >= 36 && !box.narrow && (
                  <Text style={[styles.blockTime, { color: tint.text }]} numberOfLines={1}>
                    {pad(bStart.getHours())}:{pad(bStart.getMinutes())}–{pad(bEnd.getHours())}:{pad(bEnd.getMinutes())}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* «+N»: la fascia ha più impegni di quanti ne stiano affiancati */}
        {lanesByCol.map(({ overflows }, colIdx) =>
          overflows.map((ov, i) => {
            const w = (colW - 4) / ov.lanes;
            const top = ((ov.start - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = Math.max(((ov.end - ov.start) / 60) * ROW_H, 26);
            return (
              <Pressable
                key={`more-${colIdx}-${i}`}
                onPress={() => openSlot(colIdx, ov)}
                accessibilityRole="button"
                accessibilityLabel={`Altri ${ov.hidden.length} impegni, mostra la fascia`}
                testID="agenda-lane-more"
                style={({ pressed }) => [
                  styles.laneMore,
                  { top, height, left: colX(colIdx) + 2 + ov.lane * w, width: w - LANE_GAP, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.laneMoreTx} numberOfLines={1} ellipsizeMode="clip">+{ov.hidden.length}</Text>
              </Pressable>
            );
          }),
        )}

        {/* Ghost block — the draggable draft of the new lesson */}
        {ghost.ghostOn && canBook && (
          <GhostBlock geo={geo} page={ghost} onDismiss={onGhostDismiss} />
        )}

        {/* Now line — only on today's column */}
        {nowLineTop !== null && todayColIdx >= 0 && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: nowLineTop, left: colX(todayColIdx), width: colW, height: 0, zIndex: 10 }}
          >
            <View style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 1.5, backgroundColor: '#111111' }} />
            <View style={{ position: 'absolute', top: -4, left: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#111111' }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Component — horizontal week carousel                               */
/* ------------------------------------------------------------------ */

export default function WeeklyAgendaView({
  appointments,
  instructorBlocks = [],
  holidays = new Set(),
  anchorDate,
  readOnly = false,
  onPressAppointment,
  onPressExam,
  onPressGroupLesson,
  onPressBlock,
  myInstructorId,
  onCreateAt,
  createKinds = ALL_CREATE_KINDS,
  carColor,
  ghostIgnoresEvents = false,
  ghostResetKey = 0,
  showInstructor = false,
  instructorDirectory = EMPTY_DIRECTORY,
  ghostInstructorName = null,
  allowedDurations,
  onGhostActiveChange,
  onDateChange,
  loading = false,
  studentCompletedMinutes = {},
  weekAvailabilityByDate = {},
  refreshing = false,
  onRefresh,
}: WeeklyAgendaViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  // La tab bar in vetro sta sopra l'agenda: la CTA del blocco fantasma va sopra la barra.
  const barOverlap = useTabBarOverlap();
  // Reclaim the wasted right margin (was -24) so the 6 day columns get a bit
  // more width; keep a small 8px breathing edge.
  const gridWidth = screenWidth - GUTTER_W - 8;
  const colW = (gridWidth - COL_GAP * 5) / 6;

  const today = useMemo(() => new Date(), []);

  // Fixed at mount: the carousel is the source of truth for the visible week.
  const baseMonday = useRef(getMonday(anchorDate ?? new Date())).current;
  const pages = useMemo(
    () => Array.from({ length: WEEK_SPAN * 2 + 1 }, (_, i) => addDays(baseMonday, (i - WEEK_SPAN) * 7)),
    [baseMonday],
  );

  const listRef = useRef<FlatList<Date>>(null);
  const indexRef = useRef(WEEK_SPAN);
  const [visibleMonday, setVisibleMonday] = useState<Date>(baseMonday);
  const [listH, setListH] = useState(0);
  const isCurrentWeek = isSameWeek(visibleMonday, today);

  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  /* ── Bozza + barra «Continua» (agenda/ghost) ── */
  const isOutside = useCallback((info: GhostInfo) => {
    const wins = weekAvailabilityByDate[toDateKey(info.date)] ?? [];
    return !wins.some((w) => w.startMinutes <= info.startMin && w.endMinutes >= info.startMin + info.durMin);
  }, [weekAvailabilityByDate]);
  const { handleGhostChange, dismissGhost, ghostDismissTick, bar } = useGhostDraft({
    createKinds, carColor, onCreateAt, isOutside, ghostResetKey, onGhostActiveChange, barOverlap,
  });

  const settle = useCallback((i: number) => {
    if (i < 0 || i >= pages.length || i === indexRef.current) return;
    indexRef.current = i;
    setVisibleMonday(pages[i]);
    onDateChangeRef.current?.(pages[i]);
    dismissGhost();
  }, [pages, dismissGhost]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  }, [settle, pageWidth]);

  const goToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: WEEK_SPAN, animated: true });
    settle(WEEK_SPAN);
  }, [settle]);

  // Durate consentite (stesse del foglio di prenotazione): il fantasma nasce con `defaultDur`.
  const { defaultDur } = useGhostDurations(allowedDurations);

  const renderItem = useCallback(({ item }: { item: Date }) => (
    <WeekPage
      monday={item}
      pageWidth={pageWidth}
      pageHeight={listH}
      colW={colW}
      today={today}
      appointments={appointments}
      instructorBlocks={instructorBlocks}
      holidays={holidays}
      weekAvailabilityByDate={weekAvailabilityByDate}
      studentCompletedMinutes={studentCompletedMinutes}
      readOnly={readOnly}
      loading={loading}
      onPressAppointment={onPressAppointment}
      onPressExam={onPressExam}
      onPressGroupLesson={onPressGroupLesson}
      onPressBlock={onPressBlock}
      myInstructorId={myInstructorId}
      canBook={!!onCreateAt}
      defaultDur={defaultDur}
      onGhostChange={handleGhostChange}
      ghostDismissTick={ghostDismissTick}
      onGhostDismiss={dismissGhost}
      ghostIgnoresEvents={ghostIgnoresEvents}
      refreshing={refreshing}
      onRefresh={onRefresh}
      showInstructor={showInstructor}
      instructorDirectory={instructorDirectory}
      ghostInstructorName={ghostInstructorName}
    />
  ), [pageWidth, listH, colW, today, appointments, instructorBlocks, holidays, weekAvailabilityByDate,
      studentCompletedMinutes, readOnly, loading, onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock,
      myInstructorId, onCreateAt, defaultDur, handleGhostChange, ghostDismissTick, dismissGhost, ghostIgnoresEvents, refreshing, onRefresh,
      showInstructor, instructorDirectory, ghostInstructorName]);

  return (
    <View style={styles.container}>
      {/* ── Header (Airbnb-clean): week range + "Oggi"; navigate by swipe ── */}
      <View style={styles.header}>
        <Text style={styles.weekLabel}>{formatWeekLabel(visibleMonday)}</Text>
        {!isCurrentWeek && (
          <Pressable
            onPress={goToday}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.55 }}
            accessibilityRole="button"
          >
            <Text style={styles.todayLink}>Oggi</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setListH(e.nativeEvent.layout.height)}>
        {listH > 0 && (
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(d) => String(d.getTime())}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={WEEK_SPAN}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            onMomentumScrollEnd={onMomentumEnd}
            onScrollToIndexFailed={() => { /* getItemLayout makes this unreachable */ }}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            decelerationRate="fast"
          />
        )}
      </View>

      {/* ── Barra «crea»: tipo, giorno e fascia, «Continua» (C-b) ── */}
      {bar}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 12,
  },
  weekLabel: { fontSize: 19, fontWeight: '600', color: '#111111', letterSpacing: -0.4 },
  todayLink: { fontSize: 15, fontWeight: '600', color: '#111111' },
  // Nessun padding orizzontale: le colonne della griglia sono assolute (colX =
  // GUTTER_W + i·(colW + COL_GAP)) e ignorano il padding dello scroll; qui
  // spacer GUTTER_W + celle colW/COL_GAP → ogni etichetta è centrata sulla sua colonna.
  dayHeaderRow: { flexDirection: 'row', paddingBottom: 10 },
  dayHeaderCell: { alignItems: 'center' },
  dayLetter: { fontSize: 12.5, fontWeight: '500', color: '#6A6A6A', marginBottom: 4 },
  // Numero e cerchio di oggi nella stessa scatola alta 26: stessa linea di base.
  dayNumber: { fontSize: 15, fontWeight: '600', color: '#111111', height: 26, lineHeight: 26, textAlign: 'center' },
  todayCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#111111', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  todayCircleText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 26 },
  scrollView: { flex: 1 },
  hourLabel: {
    position: 'absolute', top: -7, left: 4, width: GUTTER_W - 8,
    fontSize: 10, fontWeight: '500', color: '#B0B0B0', fontVariant: ['tabular-nums'],
  },
  // REG-639 clay: la disponibilità è una tinta di fondo appena accennata.
  availTint: {
    position: 'absolute',
    backgroundColor: 'rgba(17,17,17,0.028)',
  },
  // Fondo pieno pastello, niente bordo; l'ombra morbida in tinta è inline (`tintShadow`).
  lesson: {
    position: 'absolute',
    borderRadius: 10,
    zIndex: 4,
  },
  // Barretta del colore (REG-639): a filo sinistro, raggio come il blocco.
  eventBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, zIndex: 1 },
  lessonName: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  lessonTime: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  lessonAbsent: { color: NO_SHOW_INK, fontWeight: '600' },
  lessonVehicle: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  // Card evento (esame / gruppo). Stile allineato UNO A UNO alla web app
  // (`.agenda-card` in assets/styles/globals.css + `rounded-[8px]` sui blocchi
  // della griglia) e a `examGroupCard` della vista giornaliera:
  //   · NIENTE bordo — sul web e' esplicito, "la separazione e' solo
  //     STRUTTURALE, niente bordo". Qui c'era un bordo da 1.5 saturato: e'
  //     quello che faceva sembrare il blocco un chip ritagliato.
  //   · raggio 8 come i blocchi della griglia web (i 22 della giornaliera
  //     sono di una card larga quanto lo schermo: su 52pt diventa una pillola).
  //   · ombra IN TINTA col tipo (shadowColor inline), 0.22 / 14 / y5 /
  //     elevation 4, gli stessi numeri della giornaliera.
  // NOTA iOS: `overflow: 'hidden'` e ombra sulla STESSA view si escludono —
  // RN lo traduce in `clipsToBounds`, che e' `layer.masksToBounds` e ritaglia
  // via anche l'ombra (disegnata fuori dai bounds). Era questo a rendere i
  // blocchi piatti nonostante i valori giusti. Quindi: guscio con l'ombra,
  // interno che ritaglia il contenuto.
  eventCard: {
    position: 'absolute',
    borderRadius: 10,
    zIndex: 4,
  },
  eventInner: {
    flex: 1,
    borderRadius: 10,
    paddingLeft: 7,
    paddingRight: 5,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  lessonInner: {
    flex: 1,
    borderRadius: 13,
    paddingHorizontal: 5,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  // Blocco in colonna stretta: icona del tipo a sinistra, catena "condivisa"
  // a destra, poi orario e conteggio uno sotto l'altro. Niente parole lunghe:
  // in ~39pt utili si spezzavano a meta'.
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 13 },
  eventCount: { flexShrink: 1, fontSize: 9, fontWeight: '700', opacity: 0.9 },
  eventTime: { fontSize: 11, fontWeight: '600', marginTop: 1, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  eventNames: { marginTop: 3 },
  eventNameLine: { fontSize: 8.5, fontWeight: '500', lineHeight: 11, opacity: 0.9 },
  // Timeless exams — canonical lavender exam card (matches day-detail style).
  timelessWrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  examBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 18,
    // Niente `overflow: 'hidden'` qui: taglierebbe l'ombra clay (§0.3). Si
    // ritaglia un figlio (`examBannerClip`) con la barretta.
    ...CLAY_SHADOW.raise,
  },
  examBannerClip: { ...StyleSheet.absoluteFillObject, borderRadius: 18, overflow: 'hidden' },
  examBannerBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#111111' },
  examBannerLabel: { fontSize: 13, fontWeight: '500', color: '#6A6A6A', textTransform: 'capitalize' },
  examBannerTitle: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.2, marginTop: 2 },
  block: {
    position: 'absolute',
    borderRadius: 13,
    paddingHorizontal: 8,
    // Testo centrato in verticale: nei blocchi bassi (pausa da 5', alti 24pt)
    // il padding verticale tagliava la scritta.
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  // Lezione teorica in griglia: pieno, bordo solido (override del dashed).
  blockSolid: { borderStyle: 'solid', borderWidth: 0, ...CLAY_SHADOW.raiseSm },
  blockName: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
  blockNameSm: { fontSize: 8.5, lineHeight: 11 },
  // Corsie affiancate (09/11/2026): meno margine interno, iniziali leggibili.
  innerNarrow: { paddingLeft: 3, paddingRight: 2 },
  blockNarrow: { paddingHorizontal: 2, alignItems: 'center' },
  laneInitials: { fontSize: 10, fontWeight: '600', lineHeight: 13, letterSpacing: -0.2 },
  // Corsia da ~16pt (3 su iPhone): margini al minimo e iniziali centrate, intere.
  innerTiny: { paddingLeft: 1, paddingRight: 1, alignItems: 'center' },
  laneInitialsTiny: { fontSize: 9.5, letterSpacing: -0.4, textAlign: 'center' },
  laneMore: {
    position: 'absolute',
    borderRadius: 10,
    zIndex: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 5,
    ...CLAY_SHADOW.raiseSm,
  },
  laneMoreTx: { fontSize: 11, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  blockTime: { fontSize: 8.5, fontWeight: '500', marginTop: 2, opacity: 0.85 },
});
