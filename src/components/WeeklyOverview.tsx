import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  computeDayPlan,
  fmtClockFull,
  fmtFreeWindows,
  type AvailWindow,
  type DayPlan,
} from '../utils/weeklyAgenda';
import { colors, spacing } from '../theme';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'] as const;
const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'] as const;
const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'] as const;

const H_PAD = spacing.lg; // 22 — aligns with the screen greeting
const DAY_FALLBACK_MIN = 8 * 60;
const DAY_FALLBACK_MAX = 20 * 60;

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const mondayOf = (d: Date) => { const c = new Date(d); const dow = c.getDay(); c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow)); c.setHours(0, 0, 0, 0); return c; };
const isSameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type SharedProps = {
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks: InstructorBlock[];
  weekAvailability: Record<string, AvailWindow[]>;
  holidays: Set<string>;
  completedMinutes?: Record<string, number>;
  now: Date;
  canBook: boolean;
  onOpenDay: (date: Date) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

type Props = SharedProps & {
  selectedDate: Date;
  loading?: boolean;
  onSelectDate: (date: Date) => void;
  onToday: () => void;
  onOpenCalendar?: () => void;
};

export const WeeklyOverview = ({
  selectedDate, loading, onSelectDate, onToday, onOpenCalendar, ...shared
}: Props) => {
  const { width } = useWindowDimensions();
  const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
  const [pagerH, setPagerH] = useState(0);
  const flatRef = useRef<FlatList<Date>>(null);
  // Set true right before a swipe-driven selectedDate change, so the
  // scroll-on-external-change effect doesn't fight the user's own scroll.
  const skipScrollRef = useRef(false);

  // A long, FIXED list of week-start Mondays (±1y around mount). Stable items +
  // pagingEnabled FlatList = native paging with NO remount/recenter (the source
  // of the 1-frame glitch). Base is frozen at mount so the list never reshuffles.
  const WEEK_SPAN = 52;
  const baseMonday = useMemo(() => mondayOf(shared.now), []); // eslint-disable-line react-hooks/exhaustive-deps
  const weekList = useMemo(
    () => Array.from({ length: WEEK_SPAN * 2 + 1 }, (_, i) => addDays(baseMonday, (i - WEEK_SPAN) * 7)),
    [baseMonday],
  );
  const currentIndex = useMemo(() => {
    const key = dateKey(weekStart);
    const idx = weekList.findIndex((w) => dateKey(w) === key);
    return idx >= 0 ? idx : WEEK_SPAN;
  }, [weekList, weekStart]);

  // External week change (Oggi / calendar jump) → snap the list to it. Swipe
  // changes set skipScrollRef so we never re-scroll what the user just scrolled.
  useEffect(() => {
    if (skipScrollRef.current) { skipScrollRef.current = false; return; }
    const id = requestAnimationFrame(() => {
      try { flatRef.current?.scrollToIndex({ index: currentIndex, animated: false }); } catch { /* layout not ready */ }
    });
    return () => cancelAnimationFrame(id);
  }, [currentIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const ws = weekList[index];
    if (ws && dateKey(ws) !== dateKey(weekStart)) {
      skipScrollRef.current = true;
      onSelectDate(ws);
    }
  };

  const weekEnd = addDays(weekStart, 5);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeMain = sameMonth
    ? `${weekStart.getDate()} – ${weekEnd.getDate()}`
    : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]}`;
  const rangeMonth = sameMonth ? MONTHS_FULL[weekEnd.getMonth()] : '';

  return (
    <View style={styles.root}>
      {/* Tonal header panel — mirrors the day-view calendar panel */}
      <View style={styles.panel}>
        <View style={styles.panelRow}>
          <Text style={styles.title} numberOfLines={1}>
            {rangeMain}{rangeMonth ? <Text style={styles.titleMonth}> {rangeMonth}</Text> : null}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onToday} hitSlop={6} style={({ pressed }) => [styles.todayChip, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}>
              <Text style={styles.todayChipText}>Oggi</Text>
            </Pressable>
            {onOpenCalendar ? (
              <Pressable onPress={onOpenCalendar} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="calendar-outline" size={21} color="#1A1A2E" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} /></View>
      ) : null}

      <FlatList
        ref={flatRef}
        data={weekList}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => dateKey(item)}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialScrollIndex={currentIndex}
        onMomentumScrollEnd={onMomentumEnd}
        decelerationRate="fast"
        windowSize={3}
        style={{ flex: 1 }}
        onLayout={(e) => setPagerH(e.nativeEvent.layout.height)}
        renderItem={({ item }) => (
          <View style={{ width, height: pagerH || undefined }}>
            <WeekPage weekStart={item} {...shared} />
          </View>
        )}
      />
    </View>
  );
};

// ─── One week page (vertical list of overview rows) ────────────
const WeekPage = ({
  weekStart, appointments, instructorBlocks, weekAvailability, holidays, completedMinutes, now, canBook, onOpenDay, refreshing, onRefresh,
}: SharedProps & { weekStart: Date }) => {
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const plans = useMemo(
    () => days.map((date) => computeDayPlan(date, appointments, instructorBlocks, weekAvailability[dateKey(date)] ?? [], {
      now, canBook, isHoliday: holidays.has(dateKey(date)), completedMinutes,
    })),
    [days, appointments, instructorBlocks, weekAvailability, holidays, completedMinutes, now, canBook],
  );

  const [spanMin, spanMax] = useMemo(() => {
    let lo = DAY_FALLBACK_MIN, hi = DAY_FALLBACK_MAX;
    for (const p of plans) {
      if (p.availStart != null) lo = Math.min(lo, p.availStart);
      if (p.availEnd != null) hi = Math.max(hi, p.availEnd);
      for (const s of p.segments) { lo = Math.min(lo, s.startMin); hi = Math.max(hi, s.endMin); }
    }
    return [lo, hi];
  }, [plans]);

  const todayNorm = new Date(now); todayNorm.setHours(0, 0, 0, 0);

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {plans.map((plan, i) => {
        const date = days[i];
        const isToday = isSameDate(date, todayNorm);
        const openable = !plan.isEmptyAvail || plan.lessonCount > 0 || plan.examCount > 0 || plan.blocks.length > 0;
        return (
          <Pressable
            key={dateKey(date)}
            onPress={openable ? () => onOpenDay(date) : undefined}
            style={({ pressed }) => [styles.dRow, isToday && styles.dRowToday, pressed && openable && { opacity: 0.6 }]}
          >
            <DayLabel weekday={WEEKDAYS[i]} num={date.getDate()} isToday={isToday} muted={plan.isEmptyAvail} />
            <View style={styles.dMid}>
              <DensityStrip plan={plan} spanMin={spanMin} spanMax={spanMax} />
              <DayWords plan={plan} />
            </View>
            {openable ? (
              <View style={styles.chev}><Ionicons name="chevron-forward" size={17} color="#D6D9E6" /></View>
            ) : <View style={styles.chev} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// ─── Day label (left) ──────────────────────────────────────────
const DayLabel = ({ weekday, num, isToday, muted }: { weekday: string; num: number; isToday: boolean; muted: boolean }) => (
  <View style={styles.dLabel}>
    <Text style={[styles.dWd, isToday && styles.dWdToday, muted && styles.dMutedText]}>{weekday}</Text>
    {isToday ? (
      <View style={styles.dNumWrap}><Text style={styles.dNumToday}>{num}</Text></View>
    ) : (
      <Text style={[styles.dNum, muted && styles.dMutedText]}>{num}</Text>
    )}
  </View>
);

// ─── Density strip (rhythm only) ───────────────────────────────
const DensityStrip = ({ plan, spanMin, spanMax }: { plan: DayPlan; spanMin: number; spanMax: number }) => {
  const span = Math.max(1, spanMax - spanMin);
  const left = (m: number) => `${(Math.max(spanMin, Math.min(spanMax, m)) - spanMin) / span * 100}%`;
  const width = (s: number, e: number) => `${(Math.max(0, Math.min(spanMax, e) - Math.max(spanMin, s))) / span * 100}%`;
  if (plan.isEmptyAvail && plan.segments.length === 0) return <View style={[styles.strip, styles.stripRest]} />;
  return (
    <View style={styles.strip}>
      {plan.availStart != null && plan.availEnd != null ? (
        <View style={[styles.stripAvail, { left: left(plan.availStart) as unknown as number, width: width(plan.availStart, plan.availEnd) as unknown as number }]} />
      ) : null}
      {plan.segments.map((s, idx) => (
        <View
          key={idx}
          style={[
            styles.stripSeg,
            s.kind === 'booked' && styles.segBooked,
            s.kind === 'exam' && styles.segExam,
            s.kind === 'group' && styles.segGroup,
            s.kind === 'block' && styles.segBlock,
            { left: left(s.startMin) as unknown as number, width: width(s.startMin, s.endMin) as unknown as number },
          ]}
        />
      ))}
    </View>
  );
};

// ─── Day words (the meaning) ───────────────────────────────────
const DayWords = ({ plan }: { plan: DayPlan }) => {
  if (plan.isHoliday) return <Text style={styles.wHoliday}>Festivo</Text>;
  if (plan.hasFullDaySick) return <Text style={styles.wSick}>In malattia</Text>;
  if (plan.hasFullDayFerie) return <Text style={styles.wFerie}>In ferie</Text>;

  const freeTxt = fmtFreeWindows(plan.freeWindows);
  const freeHours = Math.round(plan.freeMinutes / 60);

  // Bookings win over availability state, so a day with guide never flashes
  // "Riposo" while availability is (re)loading.
  if (plan.lessonCount === 0 && plan.examCount === 0) {
    if (plan.isEmptyAvail) return <Text style={styles.wRest}>Riposo</Text>;
    return (
      <Text style={styles.wFree}>
        <Text style={styles.wFreeStrong}>Libero</Text> tutto il giorno{freeHours > 0 ? ` · ${freeHours}h` : ''}
      </Text>
    );
  }

  const firstExam = plan.examRows[0];
  return (
    <View style={styles.words}>
      {plan.examCount > 0 ? (
        <Text style={styles.wExam}>
          {plan.examRows.length > 0 && firstExam ? `Esame ${fmtClockFull(firstExam.startMin)}` : `${plan.examCount} ${plan.examCount === 1 ? 'esame' : 'esami'}`}
        </Text>
      ) : null}
      {plan.lessonCount > 0 ? (
        <Text style={styles.wCount}>{plan.examCount > 0 ? '· ' : ''}{plan.lessonCount} {plan.lessonCount === 1 ? 'guida' : 'guide'}</Text>
      ) : null}
      {freeTxt ? (
        <Text style={styles.wFree}>· libero <Text style={styles.wFreeStrong}>{freeTxt}</Text></Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Tonal header panel (mirrors day-view calendar panel) */
  panel: { backgroundColor: '#F4F5F9', paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  panelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 26, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5, lineHeight: 28 },
  titleMonth: { color: '#AEB4CC', fontWeight: '400' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayChip: { height: 34, paddingHorizontal: 15, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1A2E', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  todayChipText: { fontSize: 13, fontWeight: '500', color: '#1A1A2E' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1A2E', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },

  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  scroll: { paddingHorizontal: H_PAD, paddingBottom: 140, paddingTop: 6 },

  dRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 17, borderRadius: 16, borderBottomWidth: 1, borderBottomColor: '#E9EBF2' },
  dRowToday: { backgroundColor: '#F4F5F9', borderBottomColor: 'transparent', borderRadius: 20, paddingHorizontal: 14, marginHorizontal: -14, marginVertical: 6 },

  dLabel: { width: 40, alignItems: 'center', gap: 3 },
  dWd: { fontSize: 11, fontWeight: '600', color: '#AEB4CC', letterSpacing: 0.6 },
  dWdToday: { color: '#1A1A2E' },
  dNum: { fontSize: 19, fontWeight: '500', letterSpacing: -0.3, color: '#1A1A2E' },
  dNumWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dNumToday: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  dMutedText: { color: '#D6D9E6' },

  dMid: { flex: 1, minWidth: 0, gap: 10 },
  strip: { height: 8, borderRadius: 4, backgroundColor: '#EEF0F6', overflow: 'hidden', position: 'relative' },
  stripRest: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E9EBF2' },
  stripAvail: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#E9EBF2', borderRadius: 4 },
  stripSeg: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  segBooked: { backgroundColor: '#1A1A2E' },
  segExam: { backgroundColor: '#8B5CF6' },
  segGroup: { backgroundColor: '#10B981' },
  segBlock: { backgroundColor: '#D6D9E6' },

  words: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 },
  wCount: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  wExam: { fontSize: 13, fontWeight: '600', color: '#6D28D9' },
  wRest: { fontSize: 14, fontWeight: '400', color: '#AEB4CC' },
  wHoliday: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  wSick: { fontSize: 13, fontWeight: '600', color: '#C2410C' },
  wFerie: { fontSize: 13, fontWeight: '600', color: '#0F766E' },
  wFree: { fontSize: 13, fontWeight: '400', color: '#6E7596' },
  wFreeStrong: { color: '#1A1A2E', fontWeight: '500' },

  chev: { width: 22, alignItems: 'center' },
});
