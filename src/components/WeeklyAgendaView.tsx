import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { scrubActive, scrubLabel, scrubX, scrubY } from '../stores/scrubOverlay';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AvailWindow = { startMinutes: number; endMinutes: number };

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
   * Hold-and-scrub booking: fired on release with the picked start minute + the
   * free-segment bounds. Same flow as the day/week views' BookableBand.
   */
  onBookAt?: (date: Date, startMinutes: number, windowStart: number, windowEnd: number) => void;
  /** Fired when the visible week settles (swipe / "Oggi"). */
  onDateChange?: (weekStart: Date) => void;
  loading?: boolean;
  studentCompletedMinutes?: Record<string, number>;
  /** Availability windows keyed by YYYY-MM-DD (minutes since midnight). */
  weekAvailabilityByDate?: Record<string, AvailWindow[]>;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FIRST_HOUR = 7;
// Upper boundary of the grid. With LAST_HOUR = 24 the last visible row is
// labeled "23:00" and covers 23:00–24:00, so events ending up to midnight render.
const LAST_HOUR = 24;
const ROW_H = 56;
const GUTTER_W = 34;
const COL_GAP = 4;        // gap between day columns (Airbnb-ish breathing room)
const GRID_TOP_PAD = 12;  // breathing room so the first hour label isn't clipped

// Hold-and-scrub booking (mirrors BookableBand in the day/week views).
const STEP = 15;          // minutes per scrub step
const PX_PER_STEP = 10;   // px of vertical drag per 15-min step

// Horizontal week carousel: half a year of swipe each way, centered on "today".
const WEEK_SPAN = 26;

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];
const DAY_LABELS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

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
const fmtMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

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

type LessonLook = { bg: string; text: string; sub: string; pressed: string };

// Active guides are navy-filled pills; "spent" states (cancelled / no_show) recede
// to a muted grey so the eye reads the live week at a glance.
const NAVY: LessonLook = { bg: '#1A1A2E', text: '#FFFFFF', sub: 'rgba(255,255,255,0.62)', pressed: '#2A2A45' };
const MUTED: LessonLook = { bg: '#EBEDF3', text: '#8A90A6', sub: 'rgba(110,117,150,0.7)', pressed: '#E1E4EC' };
// Guide oltre le prime 6 obbligatorie → ambra soffusa (mai squillante).
const AMBER: LessonLook = { bg: '#F7E8C3', text: '#6B5413', sub: 'rgba(107,84,19,0.62)', pressed: '#EFDDAE' };
// Allievo con esame il giorno dopo → rosso attenuato ma inconfondibile.
const RED: LessonLook = { bg: '#F6D2CD', text: '#8E2A20', sub: 'rgba(142,42,32,0.62)', pressed: '#EFC2BC' };

const getLessonLook = (appt: AutoscuolaAppointmentWithRelations): LessonLook => {
  const status = (appt.status ?? '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'no_show') return MUTED;
  // Priorità: esame domani (rosso) > prime 6 obbligatorie (navy) > altre (ambra).
  // I flag arrivano dal BE; se assenti (BE non ancora deployato) → navy come prima.
  if (appt.examNextDay) return RED;
  if (appt.mandatoryLesson === false) return AMBER;
  return NAVY;
};

// Dedicated tinted looks for exams (indigo) and group lessons (teal) — same
// palettes as the day/week views, so the event type reads at a glance.
const EXAM_LOOK = { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA' };
const GROUP_LOOK = { bg: '#ECFDF5', border: '#10B981', text: '#0F766E' };
const GROUP_CAPACITY = 3;

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
  const animStyle = useAnimatedStyle(() => ({ backgroundColor: '#1A1A2E', opacity: opacity.value }));
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
/*  Free segment = hold-and-scrub bookable surface                     */
/* ------------------------------------------------------------------ */

type GridBookableProps = {
  top: number; height: number; left: number; width: number;
  /** This free segment's bounds (minutes from midnight), used for seeding. */
  windowStart: number; windowEnd: number;
  /** Day-wide ascending 15-min bookable starts (every free segment), the scrub walks them. */
  starts: number[];
  /** All free segments of the day, to resolve which one the picked time falls in. */
  segments: Array<[number, number]>;
  date: Date;
  onBook: (date: Date, startMin: number, winStart: number, winEnd: number) => void;
};

// Any free time is bookable — the surface spans a free segment (the day minus
// guides/blocks), NOT the availability. Press-and-hold (220ms) to arm, drag
// up/down in 15-min steps across every free time; a floating card bubble follows
// the finger (screen-level <ScrubBubble/>). Release books the held time; a tap
// books the tapped time. The surface is invisible — a faint navy tint shows while held.
const GridBookableWindow = ({
  top, height, left, width, windowStart, windowEnd, starts, segments, date, onBook,
}: GridBookableProps) => {
  const active = useSharedValue(0);
  const baseIdx = useSharedValue(0);
  const curIdx = useSharedValue(0);

  const idxNearest = (m: number) => {
    'worklet';
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < starts.length; i++) {
      const d = starts[i] - m; const ad = d < 0 ? -d : d;
      if (ad < bestD) { bestD = ad; best = i; }
    }
    return best;
  };
  const clampIdx = (i: number) => { 'worklet'; return Math.max(0, Math.min(starts.length - 1, i)); };

  const startHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const stepHaptic = () => Haptics.selectionAsync();
  const setLabel = (m: number) => scrubLabel.set(fmtMin(m));
  // Resolve the free segment containing the picked minute so the sheet clamps the
  // new lesson's duration up to the next guide/block (not into it).
  const doBook = (m: number) => {
    let ws = m; let we = m + 60;
    for (const [s, e] of segments) { if (m >= s && m < e) { ws = s; we = e; break; } }
    onBook(date, m, ws, we);
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((e) => {
      active.value = withTiming(1, { duration: 140 });
      const frac = Math.max(0, Math.min(1, e.y / Math.max(height, 1)));
      const localMin = windowStart + Math.round((frac * (windowEnd - windowStart)) / STEP) * STEP;
      const idx = idxNearest(localMin);
      baseIdx.value = idx; curIdx.value = idx;
      scrubX.value = e.absoluteX; scrubY.value = e.absoluteY;
      scrubActive.value = withTiming(1, { duration: 140 });
      runOnJS(setLabel)(starts[idx]);
      runOnJS(startHaptic)();
    })
    .onUpdate((e) => {
      scrubX.value = e.absoluteX; scrubY.value = e.absoluteY;
      const steps = Math.round(e.translationY / PX_PER_STEP);
      const idx = clampIdx(baseIdx.value + steps);
      if (idx !== curIdx.value) {
        curIdx.value = idx;
        runOnJS(setLabel)(starts[idx]);
        runOnJS(stepHaptic)();
      }
    })
    .onEnd(() => {
      active.value = withTiming(0, { duration: 180 });
      scrubActive.value = withTiming(0, { duration: 180 });
      runOnJS(doBook)(starts[curIdx.value]);
    })
    .onFinalize((_e, success) => {
      active.value = withTiming(0, { duration: 180 });
      if (!success) scrubActive.value = withTiming(0, { duration: 180 });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      // Book at the tapped position (not the segment start), snapped to the grid.
      const frac = Math.max(0, Math.min(1, e.y / Math.max(height, 1)));
      const localMin = windowStart + Math.round((frac * (windowEnd - windowStart)) / STEP) * STEP;
      runOnJS(doBook)(starts[idxNearest(localMin)]);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const aStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.value, [0, 1], ['rgba(26,26,46,0)', 'rgba(26,26,46,0.07)']),
  }));

  return (
    <View style={{ position: 'absolute', top, height, left, width, zIndex: 2 }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.bookSurface, aStyle]} />
      </GestureDetector>
    </View>
  );
};

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
  onBookAt?: (date: Date, startMinutes: number, windowStart: number, windowEnd: number) => void;
};

const WeekPage = React.memo(function WeekPage({
  monday, pageWidth, pageHeight, colW, today, appointments, instructorBlocks, holidays,
  weekAvailabilityByDate, readOnly, loading,
  onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock, onBookAt,
}: WeekPageProps) {
  const colX = (i: number) => GUTTER_W + i * (colW + COL_GAP);
  const gridHeight = (LAST_HOUR - FIRST_HOUR) * ROW_H;

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), [monday]);
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
      occupied.sort((a, b) => a[0] - b[0]);
      const occ: Array<[number, number]> = [];
      for (const o of occupied) {
        const last = occ[occ.length - 1];
        if (last && o[0] <= last[1]) last[1] = Math.max(last[1], o[1]);
        else occ.push([o[0], o[1]]);
      }
      const segments: Array<[number, number]> = [];
      let cursor = DAY_START;
      for (const [os, oe] of occ) {
        if (oe <= cursor) continue;
        if (os > cursor) segments.push([cursor, Math.min(os, DAY_END)]);
        cursor = Math.max(cursor, oe);
        if (cursor >= DAY_END) break;
      }
      if (cursor < DAY_END) segments.push([cursor, DAY_END]);
      const segs = segments.filter(([s, e]) => e - s >= STEP);
      const starts: number[] = [];
      for (const [s, e] of segs) for (let m = s; m <= e - STEP; m += STEP) starts.push(m);
      return { segments: segs, starts };
    });
  }, [weekDays, appointmentsByCol, blocksByCol]);

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
                  isPast && !isHoliday && { color: '#C2C7DA' },
                  isToday && { color: '#1A1A2E' },
                  isHoliday && { color: '#DC2626' },
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
                    isPast && !isHoliday && { color: '#C2C7DA' },
                    isHoliday && { color: '#DC2626' },
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
            const n = timeless.length;
            return (
              <Pressable
                key={`tl-${colIdx}`}
                onPress={() => onPressExam?.(timeless)}
                style={({ pressed }) => [styles.examBanner, pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] }]}
              >
                <Image source={require('../../assets/icons/fluent-graduate.png')} style={styles.examBannerIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.examBannerLabel}>Esame di guida · {dayLabel}</Text>
                  <Text style={styles.examBannerTitle} numberOfLines={1}>
                    {n} {n === 1 ? 'allievo' : 'allievi'} · Orario da definire
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
        contentContainerStyle={{ height: gridHeight + GRID_TOP_PAD + 28, paddingHorizontal: 12, paddingTop: GRID_TOP_PAD }}
        showsVerticalScrollIndicator={false}
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
                borderRadius: 14,
                backgroundColor: isHoliday ? '#FBEAEA' : '#EFF0F6',
                borderWidth: isTodayCol ? 1.5 : 0,
                borderColor: '#D6D9E6',
              }}
            />
          );
        })}

        {/* Hour gridlines + labels */}
        {hours.map((hour, idx) => (
          <View
            key={hour}
            pointerEvents="none"
            style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
          >
            <Text style={styles.hourLabel}>{pad(hour)}</Text>
            {idx > 0 && (
              <View style={{ position: 'absolute', top: 0, left: GUTTER_W, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#E4E6EF' }} />
            )}
          </View>
        ))}

        {/* Availability veil — faint light hint only (does not gate booking) */}
        {availTintByCol.map((wins, colIdx) =>
          wins.map(([sMin, eMin], i) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <View
                key={`avt-${colIdx}-${i}`}
                pointerEvents="none"
                style={[styles.availTint, { top, height, left: colX(colIdx) + 3, width: colW - 6 }]}
              />
            );
          }),
        )}

        {/* Bookable free segments — invisible press-and-hold scrub surfaces */}
        {onBookAt && !readOnly && bookableByCol.map(({ segments, starts }, colIdx) =>
          starts.length ? segments.map(([sMin, eMin], si) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <GridBookableWindow
                key={`bk-${colIdx}-${si}`}
                top={top} height={height} left={colX(colIdx) + 3} width={colW - 6}
                windowStart={sMin} windowEnd={eMin}
                starts={starts} segments={segments} date={weekDays[colIdx]} onBook={onBookAt}
              />
            );
          }) : null,
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
              width: colW - 6,
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
            const look = getLessonLook(appt);
            const label = [appt.student?.lastName, appt.student?.firstName].filter(Boolean).join(' ') || 'Guida';
            const showTime = height >= 40;
            return (
              <Pressable
                key={appt.id}
                onPress={() => onPressAppointment(appt)}
                style={({ pressed }) => [
                  styles.lesson,
                  { top, height, left: colX(colIdx) + 3, width: colW - 6, backgroundColor: pressed ? look.pressed : look.bg },
                ]}
              >
                <Text style={[styles.lessonName, { color: look.text }]} numberOfLines={1}>{label}</Text>
                {showTime && (
                  <Text style={[styles.lessonTime, { color: look.sub }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Exam slots — collapsed indigo card (icon + count) */}
        {eventsByCol.map(({ exams }, colIdx) =>
          exams.map((appts) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const showMeta = height >= 40;
            return (
              <Pressable
                key={`exam-${colIdx}-${a0.id}`}
                onPress={() => onPressExam?.(appts)}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: colX(colIdx) + 3, width: colW - 6, backgroundColor: EXAM_LOOK.bg, borderColor: EXAM_LOOK.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="school" size={11} color={EXAM_LOOK.text} style={{ position: 'absolute', top: 6, right: 6 }} />
                <Text style={[styles.eventName, { color: EXAM_LOOK.text }]} numberOfLines={1}>Esame</Text>
                {showMeta && (
                  <Text style={[styles.eventMeta, { color: EXAM_LOOK.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}{appts.length > 1 ? ` · ${appts.length}` : ''}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Group lessons — collapsed teal card (people icon + seats N/3) */}
        {eventsByCol.map(({ groups }, colIdx) =>
          groups.map(({ groupLessonId, appts }) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const showMeta = height >= 40;
            return (
              <Pressable
                key={`group-${colIdx}-${groupLessonId ?? a0.id}`}
                onPress={() => { if (groupLessonId) onPressGroupLesson?.(groupLessonId); }}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: colX(colIdx) + 3, width: colW - 6, backgroundColor: GROUP_LOOK.bg, borderColor: GROUP_LOOK.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="people" size={11} color={GROUP_LOOK.text} style={{ position: 'absolute', top: 6, right: 6 }} />
                <Text style={[styles.eventName, { color: GROUP_LOOK.text }]} numberOfLines={1}>Gruppo</Text>
                {showMeta && (
                  <Text style={[styles.eventMeta, { color: GROUP_LOOK.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())} · {appts.length}/{GROUP_CAPACITY}
                  </Text>
                )}
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
            const isSick = block.reason === 'sick_leave';
            const tint = isSick
              ? { bg: '#FFF4E8', border: '#F59E42', text: '#B5681C', icon: 'medkit' as const }
              : { bg: '#ECEEF5', border: '#AEB4CC', text: '#6E7596', icon: 'lock-closed' as const };
            const label = isSick ? 'Malattia' : (block.reason || 'Bloccato');
            return (
              <Pressable
                key={`block-${block.id}`}
                onPress={() => onPressBlock?.(block)}
                disabled={!onPressBlock}
                style={[
                  styles.block,
                  { top, height, left: colX(colIdx) + 3, width: colW - 6, backgroundColor: tint.bg, borderColor: tint.border },
                ]}
              >
                <Ionicons name={tint.icon} size={11} color={tint.text} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85 }} />
                <Text style={[styles.blockName, { color: tint.text }]} numberOfLines={1}>{label}</Text>
                {height >= 36 && (
                  <Text style={[styles.blockTime, { color: tint.text }]} numberOfLines={1}>
                    {pad(bStart.getHours())}:{pad(bStart.getMinutes())}–{pad(bEnd.getHours())}:{pad(bEnd.getMinutes())}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Now line — only on today's column */}
        {nowLineTop !== null && todayColIdx >= 0 && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: nowLineTop, left: colX(todayColIdx), width: colW, height: 0, zIndex: 10 }}
          >
            <View style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 2, backgroundColor: '#FF3B30' }} />
            <View style={{ position: 'absolute', top: -4, left: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3B30' }} />
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
  onBookAt,
  onDateChange,
  loading = false,
  studentCompletedMinutes = {},
  weekAvailabilityByDate = {},
}: WeeklyAgendaViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  const gridWidth = screenWidth - GUTTER_W - 24;
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

  const settle = useCallback((i: number) => {
    if (i < 0 || i >= pages.length || i === indexRef.current) return;
    indexRef.current = i;
    setVisibleMonday(pages[i]);
    onDateChangeRef.current?.(pages[i]);
  }, [pages]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  }, [settle, pageWidth]);

  const goToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: WEEK_SPAN, animated: true });
    settle(WEEK_SPAN);
  }, [settle]);

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
      onBookAt={onBookAt}
    />
  ), [pageWidth, listH, colW, today, appointments, instructorBlocks, holidays, weekAvailabilityByDate,
      studentCompletedMinutes, readOnly, loading, onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock, onBookAt]);

  return (
    <View style={styles.container}>
      {/* ── Header (Airbnb-clean): week range + "Oggi"; navigate by swipe ── */}
      <View style={styles.header}>
        <Text style={styles.weekLabel}>{formatWeekLabel(visibleMonday)}</Text>
        {!isCurrentWeek && (
          <Pressable
            onPress={goToday}
            hitSlop={8}
            style={({ pressed }) => [styles.todayPill, pressed && { backgroundColor: '#2A2A45' }]}
          >
            <Ionicons name="arrow-undo" size={13} color="#FFFFFF" />
            <Text style={styles.todayPillText}>Oggi</Text>
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
  weekLabel: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#1A1A2E',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  todayPillText: { fontSize: 13.5, fontWeight: '600', color: '#FFFFFF' },
  dayHeaderRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10 },
  dayHeaderCell: { alignItems: 'center' },
  dayLetter: { fontSize: 11, fontWeight: '600', color: '#6E7596', letterSpacing: 0.3, marginBottom: 4 },
  dayNumber: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  todayCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#1A1A2E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  todayCircleText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scrollView: { flex: 1 },
  hourLabel: {
    position: 'absolute', top: -7, left: 4, width: GUTTER_W - 8,
    fontSize: 10, fontWeight: '500', color: '#AEB4CC', fontVariant: ['tabular-nums'],
  },
  // Faint availability hint over the grey canvas — just lighter, no shadow.
  availTint: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  // Invisible bookable surface (the tint is added while held by the gesture).
  bookSurface: {
    flex: 1,
    borderRadius: 10,
  },
  lesson: {
    position: 'absolute',
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    zIndex: 4,
    shadowColor: '#0D0D16',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  lessonName: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  lessonTime: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  // Dedicated event card (exam / group) — tinted, bordered, rounded.
  eventCard: {
    position: 'absolute',
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    zIndex: 4,
    borderWidth: 1.5,
    shadowColor: '#0D0D16',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventName: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  eventMeta: { fontSize: 9, fontWeight: '500', marginTop: 2, opacity: 0.85 },
  // Timeless exams — canonical lavender exam card (matches day-detail style).
  timelessWrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  examBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F0FF',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  examBannerIcon: { width: 42, height: 42 },
  examBannerLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  examBannerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, marginTop: 2 },
  block: {
    position: 'absolute',
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    zIndex: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  blockName: { fontSize: 10, fontWeight: '700', lineHeight: 13 },
  blockTime: { fontSize: 8.5, fontWeight: '500', marginTop: 2, opacity: 0.85 },
});
