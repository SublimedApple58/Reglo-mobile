import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { useRouter } from 'expo-router';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { TimeRange } from '../types/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { publishDayStore } from '../stores/publishDayStore';
import { availabilityCache } from '../services/availabilityCache';

const FLUENT_CHECK = require('../../assets/icons/fluent-check.png');

// ── Types ──────────────────────────────────────────────────────

type Props = {
  instructorId: string;
  onToast: (text: string, tone?: ToastTone) => void;
};

type DayState = {
  date: string;
  available: boolean;
  ranges: TimeRange[];
};

// ── Constants ──────────────────────────────────────────────────

const WEEK_COUNT = 8; // weeks shown in the horizontal rail
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const DAY_FULL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

// ── Helpers ────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

const getMonday = (offset: number = 0): string => {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const railLabel = (weekStart: string): string => {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(start.getTime() + 6 * 86400000);
  const em = end.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  if (start.getUTCMonth() === end.getUTCMonth()) return `${start.getUTCDate()}–${end.getUTCDate()} ${em}`;
  const sm = start.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${start.getUTCDate()} ${sm}–${end.getUTCDate()} ${em}`;
};

const dayLongLabel = (dateStr: string, index: number): string => {
  const d = new Date(dateStr + 'T00:00:00Z');
  const month = d.toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
  return `${DAY_FULL[index]} ${d.getUTCDate()} ${month}`;
};

const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ── Swipe-to-toggle row (custom Pan gesture) ───────────────────

const SWIPE_THRESHOLD = 76; // px past which release commits the toggle
const MAX_SWIPE = 116;      // how far the row can be dragged left

const SwipeRow = ({
  day,
  index,
  isToday,
  onToggle,
  onEdit,
}: {
  day: DayState;
  index: number;
  isToday: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) => {
  const tx = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])   // only grab on clear horizontal intent
    .failOffsetY([-14, 14])     // let the vertical ScrollView win otherwise
    .onUpdate((e) => {
      tx.value = Math.max(-MAX_SWIPE, Math.min(0, e.translationX));
    })
    .onEnd(() => {
      if (tx.value <= -SWIPE_THRESHOLD) {
        runOnJS(onToggle)();
        tx.value = withTiming(0, { duration: 200 });
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const fgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [8, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const dateNum = new Date(day.date + 'T00:00:00Z').getUTCDate();

  return (
    <View style={styles.dayRow}>
      {/* Action revealed behind on left-swipe — floating rounded pill */}
      <Animated.View style={[styles.swipeActionWrap, actionStyle]} pointerEvents="none">
        <View style={[styles.swipePill, day.available ? styles.swipePillDisable : styles.swipePillEnable]}>
          <Ionicons name={day.available ? 'moon' : 'checkmark'} size={15} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>{day.available ? 'Riposo' : 'Attiva'}</Text>
        </View>
      </Animated.View>

      {/* Foreground (opaque, slides) */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.dayFg, fgStyle]}>
          <Pressable onPress={onEdit} style={({ pressed }) => [styles.dayRowTap, pressed && styles.rowPressed]}>
            <Text style={styles.dayName}>{DAY_SHORT[index]} {dateNum}</Text>
            {isToday && <Text style={styles.todayLabel}>Oggi</Text>}
            <View style={styles.chipsArea}>
              {day.available ? (
                day.ranges.map((r, ri) => (
                  <View key={ri} style={styles.timeChip}>
                    <Text style={styles.timeChipText}>{fmtMin(r.startMinutes)}–{fmtMin(r.endMinutes)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.restText}>Riposo</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" style={{ marginLeft: 8 }} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────

export const PublicationModeEditor = ({ instructorId, onToast }: Props) => {
  const router = useRouter();
  const [selectedOffset, setSelectedOffset] = useState(0);
  const weekStart = useMemo(() => getMonday(selectedOffset), [selectedOffset]);
  const weeksList = useMemo(
    () => Array.from({ length: WEEK_COUNT }, (_, i) => ({ offset: i, start: getMonday(i) })),
    [],
  );

  const [publishedWeeks, setPublishedWeeks] = useState<Set<string>>(new Set());
  const [railLoading, setRailLoading] = useState(true);
  const [days, setDays] = useState<DayState[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const daysRef = useRef<DayState[]>([]);
  daysRef.current = days;
  const publishedRef = useRef<Set<string>>(publishedWeeks);
  publishedRef.current = publishedWeeks;
  const weekStartRef = useRef(weekStart);
  weekStartRef.current = weekStart;

  const todayStr = useMemo(getTodayStr, []);
  const published = publishedWeeks.has(weekStart);

  // ── Rail: published-weeks horizon (one call) ──
  const fetchRail = useCallback(async () => {
    try {
      const res = await regloApi.getPublishedWeeks({ instructorId, from: getMonday(0), to: getMonday(WEEK_COUNT - 1) });
      const list = res.map((w) => w.weekStart);
      setPublishedWeeks(new Set(list));
      availabilityCache.setPublishedWeeks(instructorId, list);
    } catch {
      // keep whatever is cached
    } finally {
      setRailLoading(false);
    }
  }, [instructorId]);

  // ── Fetch one week's days from network, then cache ──
  const fetchWeek = useCallback(async (ws: string) => {
    try {
      const wsDate = new Date(ws + 'T00:00:00Z');
      const we = new Date(wsDate.getTime() + 6 * 86400000);
      const weStr = `${we.getUTCFullYear()}-${pad(we.getUTCMonth() + 1)}-${pad(we.getUTCDate())}`;

      const overridesRes = await regloApi.getDailyAvailabilityOverrides({
        ownerType: 'instructor', ownerId: instructorId, from: ws, to: weStr,
      });

      const isPublished = publishedRef.current.has(ws);
      const hasAnyOverride = overridesRes.length > 0;

      let templateOverrides: typeof overridesRes = [];
      if (!hasAnyOverride && !isPublished) {
        try {
          const allPublished = await regloApi.getPublishedWeeks({ instructorId, from: '2020-01-01', to: ws });
          const previous = allPublished
            .filter((pw) => pw.weekStart < ws)
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
          if (previous) {
            const prevWs = new Date(previous.weekStart + 'T00:00:00Z');
            const prevWe = new Date(prevWs.getTime() + 6 * 86400000);
            const prevWeStr = `${prevWe.getUTCFullYear()}-${pad(prevWe.getUTCMonth() + 1)}-${pad(prevWe.getUTCDate())}`;
            templateOverrides = await regloApi.getDailyAvailabilityOverrides({
              ownerType: 'instructor', ownerId: instructorId, from: previous.weekStart, to: prevWeStr,
            });
          }
        } catch { /* skip pre-fill */ }
      }

      const newDays: DayState[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(wsDate.getTime() + i * 86400000);
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        const override = overridesRes.find((o: any) => o.date?.slice(0, 10) === dateStr);
        if (override?.ranges?.length) {
          newDays.push({ date: dateStr, available: true, ranges: override.ranges as TimeRange[] });
        } else if (templateOverrides.length > 0) {
          const tpl = templateOverrides.find((o: any) => new Date(o.date?.slice(0, 10) + 'T00:00:00Z').getUTCDay() === d.getUTCDay());
          const tplRanges: TimeRange[] = tpl?.ranges?.length ? (tpl.ranges as TimeRange[]) : [];
          newDays.push({ date: dateStr, available: tplRanges.length > 0, ranges: tplRanges.length > 0 ? tplRanges : [...DEFAULT_RANGES] });
        } else {
          newDays.push({ date: dateStr, available: false, ranges: [...DEFAULT_RANGES] });
        }
      }
      // Only commit if the user is still on this week.
      if (weekStartRef.current === ws) setDays(newDays);
      availabilityCache.setWeekDays(instructorId, ws, newDays);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nel caricamento', 'danger');
    } finally {
      if (weekStartRef.current === ws) setLoading(false);
    }
  }, [instructorId, onToast]);

  // Hydrate rail from cache instantly, then refresh.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cachedPW = await availabilityCache.getPublishedWeeks(instructorId);
      if (alive && cachedPW) { setPublishedWeeks(new Set(cachedPW)); setRailLoading(false); }
      fetchRail();
    })();
    return () => { alive = false; };
  }, [instructorId, fetchRail]);

  // On week change: paint cached days instantly (or skeleton), then refresh.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await availabilityCache.getWeekDays(instructorId, weekStart);
      if (!alive) return;
      if (cached) { setDays(cached); setLoading(false); } else { setLoading(true); }
      fetchWeek(weekStart);
    })();
    return () => { alive = false; };
  }, [weekStart, instructorId, fetchWeek]);

  // ── Time picker (shared route in role stack) ──
  const openTimePicker = useCallback(
    (current: Date, onPick: (d: Date) => void) => {
      timePickerStore.set({ selectedTime: current, onConfirm: onPick });
      router.push('/(tabs)/role/time-picker' as never);
    },
    [router],
  );

  // ── Open the per-day formSheet ──
  const openDaySheet = (index: number) => {
    const day = days[index];
    if (!day) return;
    publishDayStore.set({
      dayLabel: dayLongLabel(day.date, index),
      available: day.available,
      ranges: day.ranges.length ? day.ranges : [...DEFAULT_RANGES],
      openTimePicker,
      onSave: (available, ranges) => {
        // Optimistic + instant: update UI and cache now, persist in the background.
        const finalRanges = available ? (ranges.length ? ranges : [...DEFAULT_RANGES]) : [];
        const prev = daysRef.current;
        const next = prev.map((d) =>
          d.date === day.date ? { ...d, available, ranges: available ? finalRanges : d.ranges } : d,
        );
        setDays(next);
        availabilityCache.setWeekDays(instructorId, weekStart, next);
        regloApi
          .setDailyAvailabilityOverride({ ownerType: 'instructor', ownerId: instructorId, date: day.date, ranges: finalRanges })
          .catch(() => {
            // Revert on failure.
            setDays(prev);
            availabilityCache.setWeekDays(instructorId, weekStart, prev);
            onToast('Errore nel salvataggio', 'danger');
          });
      },
    });
    router.push('/(tabs)/role/publish-day' as never);
  };

  // ── Inline day on/off (optimistic, no sheet) ──
  const toggleDayInline = (index: number) => {
    const day = days[index];
    if (!day) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextAvailable = !day.available;
    // Keep the ranges in local state when turning off, so they come back on re-enable.
    const keptRanges = nextAvailable ? (day.ranges.length ? day.ranges : [...DEFAULT_RANGES]) : day.ranges;
    const persistRanges = nextAvailable ? keptRanges : [];
    const prev = daysRef.current;
    const next = prev.map((d, i) => (i === index ? { ...d, available: nextAvailable, ranges: keptRanges } : d));
    setDays(next);
    availabilityCache.setWeekDays(instructorId, weekStart, next);
    regloApi
      .setDailyAvailabilityOverride({ ownerType: 'instructor', ownerId: instructorId, date: day.date, ranges: persistRanges })
      .catch(() => {
        setDays(prev);
        availabilityCache.setWeekDays(instructorId, weekStart, prev);
        onToast('Errore nel salvataggio', 'danger');
      });
  };

  // ── Publish / Unpublish ──
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await regloApi.publishWeek({ weekStart, instructorId });
      setPublishedWeeks((prev) => {
        const n = new Set(prev).add(weekStart);
        availabilityCache.setPublishedWeeks(instructorId, [...n]);
        return n;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onToast('Settimana pubblicata');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nella pubblicazione', 'danger');
    } finally {
      setPublishing(false);
    }
  }, [weekStart, instructorId, onToast]);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    try {
      await regloApi.unpublishWeek({ weekStart, instructorId });
      setPublishedWeeks((prev) => {
        const n = new Set(prev); n.delete(weekStart);
        availabilityCache.setPublishedWeeks(instructorId, [...n]);
        return n;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onToast('Pubblicazione ritirata');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nel ritiro', 'danger');
    } finally {
      setPublishing(false);
    }
  }, [weekStart, instructorId, onToast]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Week pills (chunky, rounded, greyscale state) ─── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {weeksList.map((w) => {
          const isSel = w.offset === selectedOffset;
          const isPub = !railLoading && publishedWeeks.has(w.start);
          return (
            <Pressable
              key={w.start}
              onPress={() => setSelectedOffset(w.offset)}
              style={[styles.weekPill, isSel ? styles.weekPillSel : isPub ? styles.weekPillPub : styles.weekPillOff]}
            >
              {isPub && (
                <Ionicons name="checkmark-circle" size={14} color={isSel ? '#FFFFFF' : PUB_FG} style={{ marginRight: 5 }} />
              )}
              <Text style={[styles.weekPillText, isSel ? styles.weekPillTextSel : isPub && styles.weekPillTextPub]}>
                {railLabel(w.start)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Action bar: status + publish (high & visible) ─── */}
      <View style={styles.actionBar}>
        <View style={styles.actionInfo}>
          <View style={styles.actionStatusRow}>
            {published ? (
              <Image source={FLUENT_CHECK} style={styles.statusIcon} />
            ) : (
              <Ionicons name="ellipse-outline" size={17} color="#C0C4CC" />
            )}
            <Text style={styles.actionTitle}>{published ? 'Pubblicata' : 'Da pubblicare'}</Text>
          </View>
        </View>
        <Pressable
          onPress={publishing ? undefined : published ? handleUnpublish : handlePublish}
          disabled={publishing}
          style={({ pressed }) => [
            published ? styles.btnGhost : styles.btnPublish,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            publishing && { opacity: 0.6 },
          ]}
        >
          {publishing ? (
            <ActivityIndicator color={published ? '#6B7280' : '#FFFFFF'} />
          ) : (
            <Text style={published ? styles.btnGhostText : styles.btnPublishText}>
              {published ? 'Ritira' : 'Pubblica'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* ── Swipe hint ────────────────────────────────────── */}
      {!loading && (
        <View style={styles.swipeHint}>
          <Ionicons name="arrow-back" size={13} color="#B0B5BD" />
          <Text style={styles.swipeHintText}>Trascina un giorno verso sinistra per attivarlo o disattivarlo</Text>
        </View>
      )}

      {/* ── Day list — flat rows, hairline dividers ───────── */}
      {loading ? (
        <View style={styles.list}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[styles.dayRow, styles.daySkeletonRow]}>
              <SkeletonBlock width={70} height={15} radius={7} />
              <View style={{ flex: 1 }} />
              <SkeletonBlock width={96} height={13} radius={7} />
            </View>
          ))}
        </View>
      ) : (
        <Animated.View key={weekStart} entering={FadeIn.duration(220)} style={styles.list}>
          {days.map((day, i) => (
            <SwipeRow
              key={day.date}
              day={day}
              index={i}
              isToday={day.date === todayStr}
              onToggle={() => toggleDayInline(i)}
              onEdit={() => openDaySheet(i)}
            />
          ))}
        </Animated.View>
      )}

    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────

const HAIRLINE = '#ECECEC';
const PUB_BG = '#E9F9F0';   // chiarissimo menta (pill pubblicata)
const PUB_FG = '#34C759';   // verde fresco iOS (check)

const styles = StyleSheet.create({
  container: {},

  /* ── Week pills ──────────────────────────────────────── */
  rail: { gap: 8, paddingRight: 8, paddingVertical: 2 },
  weekPill: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  weekPillOff: { backgroundColor: '#F1F2F4' },
  weekPillPub: { backgroundColor: PUB_BG },
  weekPillSel: { backgroundColor: '#1A1A2E' },
  weekPillText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', letterSpacing: -0.2 },
  weekPillTextPub: { color: '#334155', fontWeight: '700' },
  weekPillTextSel: { color: '#FFFFFF', fontWeight: '700' },

  /* ── Swipe hint ──────────────────────────────────────── */
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  swipeHintText: { fontSize: 12, fontWeight: '500', color: '#B0B5BD', letterSpacing: -0.1 },

  /* ── Day list (flat) ─────────────────────────────────── */
  list: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: HAIRLINE },
  dayRow: {
    minHeight: 60, overflow: 'hidden', position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE,
  },
  dayFg: { backgroundColor: '#FDFDFD' },
  daySkeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  dayRowTap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, minHeight: 60 },
  rowPressed: { opacity: 0.5 },
  swipeActionWrap: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: MAX_SWIPE,
    alignItems: 'center', justifyContent: 'center',
  },
  swipePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999,
  },
  swipePillDisable: { backgroundColor: '#64748B' },
  swipePillEnable: { backgroundColor: '#34C759' },
  swipeActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  dayName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  todayLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginLeft: 1 },

  chipsArea: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  timeChip: {
    backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  timeChipText: { fontSize: 13.5, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  restText: { fontSize: 15, fontWeight: '400', color: '#C0C4CC' },

  /* ── Action bar (Airbnb footer-style, placed up top) ─── */
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  actionInfo: { flex: 1, gap: 3 },
  actionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIcon: { width: 20, height: 20, resizeMode: 'contain' },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  btnPublish: {
    backgroundColor: '#1A1A2E', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minWidth: 112,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  btnPublishText: { fontSize: 15.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  btnGhost: {
    backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 22, minWidth: 100,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
});
