import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
  StyleSheet,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuickBookPreview = {
  date: Date;
  hour: number;
  minutes: number;
  duration: number;
};

type WeeklyAgendaViewProps = {
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks?: InstructorBlock[];
  holidays?: Set<string>;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressBlock?: (block: InstructorBlock) => void;
  onPressEmptySlot?: (date: Date, hour: number, minutes: number) => void;
  onDateChange?: (weekStart: Date) => void;
  loading?: boolean;
  studentCompletedMinutes?: Record<string, number>;
  weekAvailability?: Record<number, Array<{ startMinutes: number; endMinutes: number }>>;
  quickBookPreview?: QuickBookPreview | null;
  quickBookTopPanHandlers?: ReturnType<typeof PanResponder.create>['panHandlers'];
  quickBookBottomPanHandlers?: ReturnType<typeof PanResponder.create>['panHandlers'];
  quickBookDragging?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const ROW_H = 56;
const GUTTER_W = 24;

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];
const DAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S'];

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

const isSameWeek = (a: Date, b: Date) =>
  isSameDay(getMonday(a), getMonday(b));

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

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
/*  Appointment colour map                                             */
/* ------------------------------------------------------------------ */

type AppointmentColors = { bg: string; border: string; text: string };

/**
 * Color map aligned with daily view's timelineStatusConfig.
 * Single source of truth for appointment status colors.
 */
const getAppointmentColors = (
  appt: AutoscuolaAppointmentWithRelations,
  completedMinutes: Record<string, number>,
): AppointmentColors => {
  const status = (appt.status ?? '').trim().toLowerCase();

  // Exam type overrides status (unless cancelled/no_show)
  if (appt.type === 'esame' && status !== 'cancelled' && status !== 'no_show') {
    return { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA' };
  }

  switch (status) {
    case 'pending_review':
      return { bg: '#FFF7ED', border: '#F97316', text: '#EA580C' };
    case 'checked_in':
      return { bg: '#FDF2F8', border: '#EC4899', text: '#9D174D' };
    case 'completed':
      return { bg: '#F0FDF4', border: '#22C55E', text: '#16A34A' };
    case 'no_show':
    case 'cancelled':
      return { bg: '#F1F5F9', border: '#94A3B8', text: '#64748B' };
    case 'proposal':
      return { bg: '#F5F3FF', border: '#A78BFA', text: '#7C3AED' };
    case 'scheduled':
    case 'confirmed':
    default: {
      // Mandatory if student < 8h completed AND lesson ≥ 60 min
      const start = new Date(appt.startsAt).getTime();
      const end = appt.endsAt ? new Date(appt.endsAt).getTime() : start + 60 * 60 * 1000;
      const dur = Math.round((end - start) / 60000);
      const mins = completedMinutes[appt.studentId] ?? 0;
      if (mins < MANDATORY_MINUTES_THRESHOLD && dur >= 60) {
        return { bg: '#F0F9FF', border: '#0EA5E9', text: '#0369A1' };
      }
      return { bg: '#FEF9C3', border: '#FACC15', text: '#CA8A04' };
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Skeleton pulse block                                               */
/* ------------------------------------------------------------------ */

const SkeletonBlock = ({ style }: { style: object }) => {
  const opacity = useSharedValue(0.12);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.28, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: '#EC4899',
    opacity: opacity.value,
  }));
  return <Animated.View style={[style, animStyle]} />;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/* Skeleton placeholder positions (col, startHour fraction, height fraction) */
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

const MANDATORY_MINUTES_THRESHOLD = 480; // 8 hours

export default function WeeklyAgendaView({
  appointments,
  instructorBlocks = [],
  holidays = new Set(),
  onPressAppointment,
  onPressExam,
  onPressBlock,
  onPressEmptySlot,
  onDateChange,
  loading = false,
  studentCompletedMinutes = {},
  weekAvailability = {},
  quickBookPreview = null,
  quickBookTopPanHandlers,
  quickBookBottomPanHandlers,
  quickBookDragging = false,
}: WeeklyAgendaViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const colW = (screenWidth - GUTTER_W) / 6;

  const [weekAnchor, setWeekAnchor] = useState<Date>(() => getMonday(new Date()));

  const today = useMemo(() => new Date(), []);
  const isCurrentWeek = isSameWeek(weekAnchor, today);

  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  );

  const hours = useMemo(
    () => Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i),
    [],
  );

  /* ── Swipe navigation ── */
  const swipeRef = useRef({ startX: 0 });
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: (_, g) => { swipeRef.current.startX = g.x0; },
        onPanResponderRelease: (_, g) => {
          if (g.dx > 60) setWeekAnchor((prev) => addDays(prev, -7));
          else if (g.dx < -60) setWeekAnchor((prev) => addDays(prev, 7));
        },
      }),
    [],
  );

  useEffect(() => {
    onDateChange?.(weekAnchor);
  }, [weekAnchor, onDateChange]);

  /* ── Bucket appointments by column ── */
  const appointmentsByCol = useMemo(() => {
    const buckets: AutoscuolaAppointmentWithRelations[][] = Array.from(
      { length: 6 },
      () => [],
    );
    const active = appointments.filter(
      (a) => (a.status ?? '').toLowerCase() !== 'cancelled',
    );
    for (const appt of appointments) {
      const status = (appt.status ?? '').toLowerCase();
      // Hide cancelled appointments that have been replaced
      if (status === 'cancelled' && appt.replacedByAppointmentId) continue;
      // Hide cancelled appointments when another active appointment overlaps
      if (status === 'cancelled') {
        const cs = new Date(appt.startsAt).getTime();
        const ce = new Date(appt.endsAt ?? appt.startsAt).getTime();
        if (active.some((a) => {
          const as_ = new Date(a.startsAt).getTime();
          const ae = new Date(a.endsAt ?? a.startsAt).getTime();
          return as_ < ce && ae > cs;
        })) continue;
      }
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

  /* ── Holiday columns ── */
  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const holidayCols = useMemo(
    () => new Set(weekDays.map((d, i) => (holidays.has(toDateKey(d)) ? i : -1)).filter((i) => i >= 0)),
    [weekDays, holidays],
  );

  /* ── Bucket instructor blocks by column ── */
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

  /* ── Now line ── */
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

  const weekLabel = formatWeekLabel(weekAnchor);
  const gridHeight = (LAST_HOUR - FIRST_HOUR) * ROW_H;

  return (
    <View style={styles.container}>
      {/* ──── Week nav ──── */}
      <View style={styles.weekNav}>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <View style={styles.weekNavBtns}>
          <Pressable
            onPress={() => setWeekAnchor((prev) => addDays(prev, -7))}
            hitSlop={8}
            style={({ pressed }) => [styles.weekNavBtn, pressed && { backgroundColor: '#F1F5F9' }]}
          >
            <Ionicons name="chevron-back-outline" size={18} color="#94A3B8" />
          </Pressable>
          <Pressable
            onPress={() => setWeekAnchor((prev) => addDays(prev, 7))}
            hitSlop={8}
            style={({ pressed }) => [styles.weekNavBtn, pressed && { backgroundColor: '#F1F5F9' }]}
          >
            <Ionicons name="chevron-forward-outline" size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      {/* ──── Day header ──── */}
      <View style={styles.dayHeaderRow}>
        <View style={{ width: GUTTER_W }} />
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const isHoliday = holidayCols.has(idx);
          return (
            <View key={idx} style={[styles.dayHeaderCell, { width: colW }, isHoliday && { backgroundColor: '#FEE2E2' }]}>
              <Text
                style={[
                  styles.dayLetter,
                  isPast && !isHoliday && { color: '#CBD5E1' },
                  isToday && !isHoliday && { color: '#EC4899' },
                  isHoliday && { color: '#DC2626' },
                ]}
              >
                {DAY_LABELS[idx]}
              </Text>
              {isToday && !isHoliday ? (
                <View style={styles.todayCircle}>
                  <Text style={styles.todayCircleText}>{day.getDate()}</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.dayNumber,
                    isPast && !isHoliday && { color: '#CBD5E1' },
                    isHoliday && { color: '#DC2626' },
                  ]}
                >
                  {day.getDate()}
                </Text>
              )}
              {isHoliday && (
                <View style={{ backgroundColor: '#FECACA', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, marginTop: 2 }}>
                  <Text style={{ fontSize: 7, fontWeight: '700', color: '#DC2626' }}>Festivo</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ──── Scrollable time grid ──── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ height: gridHeight + (quickBookPreview ? 500 : 100) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!quickBookDragging}
        {...panResponder.panHandlers}
      >
        {/* Today column highlight */}
        {todayColIdx >= 0 && !holidayCols.has(todayColIdx) && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: GUTTER_W + todayColIdx * colW,
              width: colW,
              height: gridHeight,
              backgroundColor: '#FDF2F8',
              opacity: 0.35,
            }}
          />
        )}

        {/* Holiday column overlays */}
        {Array.from(holidayCols).map((colIdx) => (
          <View
            key={`holiday-${colIdx}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: GUTTER_W + colIdx * colW,
              width: colW,
              height: gridHeight,
              backgroundColor: '#FEE2E2',
              opacity: 0.35,
            }}
          />
        ))}

        {/* Tap-to-book: tap empty area to create lesson */}
        {onPressEmptySlot && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: GUTTER_W, right: 0, height: gridHeight, zIndex: 0 }}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              const y = e.nativeEvent.locationY;
              const col = Math.floor(x / colW);
              if (col < 0 || col > 5) return;
              const hourOffset = y / ROW_H;
              const hour = FIRST_HOUR + Math.floor(hourOffset);
              const minutes = Math.floor((hourOffset % 1) * 4) * 15;
              onPressEmptySlot(weekDays[col], hour, minutes);
            }}
          />
        )}

        {/* Hour rows + horizontal grid lines */}
        {hours.map((hour, idx) => (
          <View
            key={hour}
            pointerEvents="none"
            style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
          >
            <View style={styles.hourGutter}>
              <Text style={styles.hourLabel}>
                {String(hour).padStart(2, '0')}
              </Text>
            </View>
            <View style={{ position: 'absolute', top: 0, left: GUTTER_W, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0' }} />
          </View>
        ))}

        {/* Availability highlights per column */}
        {Object.entries(weekAvailability).map(([colIdxStr, slots]) => {
          const ci = Number(colIdxStr);
          return slots.map((slot, si) => {
            const topMin = Math.max(slot.startMinutes, FIRST_HOUR * 60);
            const botMin = Math.min(slot.endMinutes, LAST_HOUR * 60);
            if (botMin <= topMin) return null;
            const top = ((topMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((botMin - topMin) / 60) * ROW_H;
            return (
              <View
                key={`avail-${ci}-${si}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top,
                  height,
                  left: GUTTER_W + ci * colW + 1,
                  width: colW - 2,
                  backgroundColor: '#86EFAC',
                  opacity: 0.12,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                }}
              />
            );
          });
        })}

        {/* Vertical column separators */}
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={`v${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: GUTTER_W + i * colW,
              width: StyleSheet.hairlineWidth,
              height: gridHeight,
              backgroundColor: i === 0 ? '#CBD5E1' : '#F1F5F9',
            }}
          />
        ))}

        {/* Skeleton blocks */}
        {loading && appointments.length === 0 && SKELETON_BLOCKS.map((sk, i) => (
          <SkeletonBlock
            key={`sk-${i}`}
            style={{
              position: 'absolute',
              top: sk.top * ROW_H,
              height: sk.h * ROW_H,
              left: GUTTER_W + sk.col * colW + 2,
              width: colW - 4,
              borderRadius: 4,
            }}
          />
        ))}

        {/* Appointment blocks */}
        {appointmentsByCol.map((colAppts, colIdx) =>
          colAppts.map((appt) => {
            const start = new Date(appt.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (appt.endsAt) {
              dur = (new Date(appt.endsAt).getTime() - start.getTime()) / 60000;
            }
            const height = Math.max((dur / 60) * ROW_H, 24);
            const { bg, border, text } = getAppointmentColors(appt, studentCompletedMinutes);
            const isExam = appt.type === 'esame';
            const label = isExam ? 'Esame' : (appt.student?.firstName ?? '');
            const showTime = height >= 38;

            return (
              <Pressable
                key={appt.id}
                onPress={() => {
                  if (isExam && onPressExam) {
                    onPressExam(colAppts.filter((a) => a.type === 'esame' && a.startsAt === appt.startsAt));
                  } else {
                    onPressAppointment(appt);
                  }
                }}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top,
                  height,
                  left: GUTTER_W + colIdx * colW + 2,
                  width: colW - 4,
                  backgroundColor: pressed ? border + '30' : bg,
                  borderLeftWidth: 3,
                  borderLeftColor: border,
                  borderRadius: 4,
                  paddingHorizontal: 3,
                  paddingVertical: 2,
                  overflow: 'hidden',
                })}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: text, lineHeight: 14 }} numberOfLines={1}>
                  {label}
                </Text>
                {showTime && (
                  <Text style={{ fontSize: 9, fontWeight: '500', color: text, opacity: 0.65, lineHeight: 11, marginTop: 1 }} numberOfLines={1}>
                    {String(start.getHours()).padStart(2, '0')}:{String(start.getMinutes()).padStart(2, '0')}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Instructor blocks */}
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
            const height = Math.max(((clampedEm - clampedSm) / 60) * ROW_H, 20);
            const isSick = block.reason === 'sick_leave';
            const borderColor = isSick ? '#FB923C' : '#94A3B8';
            const bgColor = isSick ? '#FFF7ED' : '#F8FAFC';
            const textColor = isSick ? '#EA580C' : '#94A3B8';
            const label = isSick ? 'Malattia' : (block.reason || 'Bloccato');
            return (
              <Pressable
                key={`block-${block.id}`}
                onPress={() => onPressBlock?.(block)}
                style={{
                  position: 'absolute',
                  top,
                  height,
                  left: GUTTER_W + colIdx * colW + 2,
                  width: colW - 4,
                  backgroundColor: bgColor,
                  borderLeftWidth: 3,
                  borderLeftColor: borderColor,
                  borderRadius: 4,
                  paddingHorizontal: 3,
                  paddingVertical: 2,
                  overflow: 'hidden',
                  zIndex: 5,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: textColor, lineHeight: 12 }} numberOfLines={1}>
                  {label}
                </Text>
                {height >= 32 && (
                  <Text style={{ fontSize: 8, fontWeight: '500', color: textColor, opacity: 0.7, lineHeight: 10, marginTop: 1 }} numberOfLines={1}>
                    {String(bStart.getHours()).padStart(2, '0')}:{String(bStart.getMinutes()).padStart(2, '0')}–{String(bEnd.getHours()).padStart(2, '0')}:{String(bEnd.getMinutes()).padStart(2, '0')}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Quick-book preview block with handles */}
        {quickBookPreview && (() => {
          const qbDate = quickBookPreview.date;
          const qbDow = qbDate.getDay();
          if (qbDow === 0) return null;
          const qbColIdx = qbDow - 1;
          if (qbColIdx > 5) return null;
          const qbDateNorm = new Date(qbDate); qbDateNorm.setHours(0, 0, 0, 0);
          const weekDayNorm = new Date(weekDays[qbColIdx]); weekDayNorm.setHours(0, 0, 0, 0);
          if (qbDateNorm.getTime() !== weekDayNorm.getTime()) return null;
          const startMin = quickBookPreview.hour * 60 + quickBookPreview.minutes;
          const topPx = ((startMin - FIRST_HOUR * 60) / 60) * ROW_H;
          const blockH = Math.max((quickBookPreview.duration / 60) * ROW_H, 20);
          const endTotal = startMin + quickBookPreview.duration;
          const endH = Math.floor(endTotal / 60);
          const endM = endTotal % 60;
          const hasHandles = Boolean(quickBookTopPanHandlers && quickBookBottomPanHandlers);
          return (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: topPx - (hasHandles ? 10 : 0),
                left: GUTTER_W + qbColIdx * colW + 2,
                width: colW - 4,
                height: blockH + (hasHandles ? 20 : 0),
                zIndex: 12,
              }}
            >
              {/* Block body */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: hasHandles ? 10 : 0,
                  left: 0,
                  right: 0,
                  height: blockH,
                  backgroundColor: '#FDF2F8',
                  borderWidth: 1.5,
                  borderColor: '#EC4899',
                  borderStyle: 'dashed',
                  borderRadius: 4,
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#EC4899', lineHeight: 12 }} numberOfLines={1}>
                  {String(quickBookPreview.hour).padStart(2, '0')}:{String(quickBookPreview.minutes).padStart(2, '0')}–{String(endH).padStart(2, '0')}:{String(endM).padStart(2, '0')}
                </Text>
              </View>
              {/* Drag handles */}
              {hasHandles && (
                <>
                  <View
                    {...quickBookTopPanHandlers}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                  >
                    <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: '#EC4899' }} />
                  </View>
                  <View
                    {...quickBookBottomPanHandlers}
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                  >
                    <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: '#EC4899' }} />
                  </View>
                </>
              )}
            </View>
          );
        })()}

        {/* Now line */}
        {nowLineTop !== null && (
          <View pointerEvents="none" style={{ position: 'absolute', top: nowLineTop, left: 0, right: 0, height: 0, zIndex: 10 }}>
            <View style={{ position: 'absolute', top: -0.75, left: GUTTER_W, right: 0, height: 1.5, backgroundColor: '#EC4899' }} />
            <View style={{ position: 'absolute', top: -4, left: GUTTER_W - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EC4899' }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  weekLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  weekNavBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dayHeaderCell: {
    alignItems: 'center',
  },
  dayLetter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  todayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  hourGutter: {
    position: 'absolute',
    top: -6,
    left: 4,
    width: GUTTER_W - 4,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
});
