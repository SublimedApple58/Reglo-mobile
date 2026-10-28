import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
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
import { useQueryClient } from '@tanstack/react-query';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayButton, ClayIconButton, ClayList, ClayListRow, ClaySection } from '../components/clay';
import { CLAY } from '../theme/clay';
import { SOFT_SPRING, SOFT_SWAP_OUT, softEnter } from '../utils/motion';
import { ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { TimeRange } from '../types/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { publishDayStore } from '../stores/publishDayStore';
import { useSession } from '../context/SessionContext';
import { usePublishedWeeks } from '../hooks/queries/usePublishedWeeks';
import { usePublicationWeek, DayState } from '../hooks/queries/usePublicationWeek';
import { queryKeys } from '../hooks/queries/queryKeys';

// ── Types ──────────────────────────────────────────────────────

type Props = {
  instructorId: string;
  onToast: (text: string, tone?: ToastTone) => void;
};

// ── Constants ──────────────────────────────────────────────────

const WEEK_COUNT = 8; // weeks reachable with the arrows (this + 7 ahead)
const DAY_FULL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

// ── Helpers ────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
/** Fasce come testo: «08:00–13:00 · 14:00–19:00». */
const rangesText = (ranges: TimeRange[]) =>
  ranges.map((r) => `${fmtMin(r.startMinutes)}–${fmtMin(r.endMinutes)}`).join(' · ');

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
  divider,
}: {
  day: DayState;
  index: number;
  isToday: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /** Lo imposta `ClayList`. */
  divider?: boolean;
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
        tx.value = withSpring(0, SOFT_SPRING);
      }
    });

  const fgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [8, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const title = dayLongLabel(day.date, index);
  const state = day.available ? rangesText(day.ranges) : 'Riposo';

  return (
    <View style={styles.dayRow}>
      {divider ? <View style={styles.divider} /> : null}
      {/* Azione rivelata trascinando a sinistra: solo testo, niente pillola colorata. */}
      <Animated.View style={[styles.swipeAction, actionStyle]} pointerEvents="none">
        <Text style={styles.swipeActionText}>{day.available ? 'Riposo' : 'Attiva'}</Text>
      </Animated.View>

      {/* Foreground (opaque, slides) */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.dayFg, fgStyle]}>
          <ClayListRow
            title={title}
            subtitle={isToday ? `Oggi · ${state}` : state}
            onPress={onEdit}
            testID={`publication-day-${index}`}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────

export const PublicationModeEditor = ({ instructorId, onToast }: Props) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();
  const [selectedOffset, setSelectedOffset] = useState(0);
  const weekStart = useMemo(() => getMonday(selectedOffset), [selectedOffset]);
  const railFrom = useMemo(() => getMonday(0), []);
  const railTo = useMemo(() => getMonday(WEEK_COUNT - 1), []);

  const [publishing, setPublishing] = useState(false);

  const todayStr = useMemo(getTodayStr, []);

  // ── Rail: published-weeks horizon (cached, persisted) ──
  const railQuery = usePublishedWeeks(instructorId, railFrom, railTo);
  const publishedWeeks = useMemo(() => new Set(railQuery.data ?? []), [railQuery.data]);
  const railLoading = railQuery.isLoading && !railQuery.data;
  const published = publishedWeeks.has(weekStart);
  const railKey = queryKeys.publishedWeeks(activeCompanyId, instructorId, { from: railFrom, to: railTo });

  // ── Selected week → 7 day rows (cached, persisted; composite queryFn) ──
  const weekKey = queryKeys.publicationWeek(activeCompanyId, instructorId, weekStart);
  const weekQuery = usePublicationWeek(instructorId, weekStart, { isPublished: published });
  const days = useMemo<DayState[]>(() => weekQuery.data ?? [], [weekQuery.data]);
  const loading = weekQuery.isLoading && !weekQuery.data;

  // Surface a load error (cache, if any, still shows).
  useEffect(() => {
    if (weekQuery.isError) onToast('Errore nel caricamento', 'danger');
  }, [weekQuery.isError, onToast]);

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
      onSave: async (available, ranges) => {
        // No optimistic write: persist, then refetch the week from the BE.
        const finalRanges = available ? (ranges.length ? ranges : [...DEFAULT_RANGES]) : [];
        try {
          await regloApi.setDailyAvailabilityOverride({ ownerType: 'instructor', ownerId: instructorId, date: day.date, ranges: finalRanges });
          await queryClient.invalidateQueries({ queryKey: weekKey });
        } catch {
          onToast('Errore nel salvataggio', 'danger');
        }
      },
    });
    router.push('/(tabs)/role/publish-day' as never);
  };

  // ── Inline day on/off (no sheet) ──
  const toggleDayInline = async (index: number) => {
    const day = days[index];
    if (!day) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextAvailable = !day.available;
    const persistRanges = nextAvailable ? (day.ranges.length ? day.ranges : [...DEFAULT_RANGES]) : [];
    // No optimistic write: persist, then refetch the week from the BE.
    try {
      await regloApi.setDailyAvailabilityOverride({ ownerType: 'instructor', ownerId: instructorId, date: day.date, ranges: persistRanges });
      await queryClient.invalidateQueries({ queryKey: weekKey });
    } catch {
      onToast('Errore nel salvataggio', 'danger');
    }
  };

  // ── Publish / Unpublish ──
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await regloApi.publishWeek({ weekStart, instructorId });
      await queryClient.invalidateQueries({ queryKey: railKey });
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
      await queryClient.invalidateQueries({ queryKey: railKey });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onToast('Pubblicazione ritirata');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nel ritiro', 'danger');
    } finally {
      setPublishing(false);
    }
  }, [weekStart, instructorId, onToast]);

  // ── Render ─────────────────────────────────────────────────

  const canPrev = selectedOffset > 0;
  const canNext = selectedOffset < WEEK_COUNT - 1;
  const status = railLoading ? ' ' : published ? 'Pubblicata' : 'Da pubblicare';

  return (
    <View>
      {/* ── Settimana: frecce + intervallo, stato in testo, Pubblica/Ritira ── */}
      <ClaySection title="Settimana" style={styles.firstSection}>
        <ClayList>
          <ClayListRow
            title={railLabel(weekStart)}
            subtitle={status}
            trailing={
              <View style={styles.weekNav}>
                <ClayIconButton
                  icon="back"
                  onPress={canPrev ? () => setSelectedOffset((o) => o - 1) : undefined}
                  style={!canPrev && styles.navOff}
                  accessibilityLabel="Settimana precedente"
                  testID="publication-week-prev"
                />
                <ClayIconButton
                  icon={<Ionicons name="chevron-forward" size={20} color={CLAY.ink} />}
                  onPress={canNext ? () => setSelectedOffset((o) => o + 1) : undefined}
                  style={!canNext && styles.navOff}
                  accessibilityLabel="Settimana successiva"
                  testID="publication-week-next"
                />
              </View>
            }
          />
        </ClayList>
        <ClayButton
          title={published ? 'Ritira pubblicazione' : 'Pubblica settimana'}
          variant={published ? 'secondary' : 'primary'}
          onPress={published ? handleUnpublish : handlePublish}
          loading={publishing}
          style={styles.publish}
          testID="publication-publish"
        />
      </ClaySection>

      {/* ── Giorni della settimana scelta ── */}
      <ClaySection
        title="Giorni"
        style={styles.section}
        footnote={loading ? undefined : 'Tocca un giorno per gli orari. Trascinalo verso sinistra per attivarlo o metterlo a riposo.'}
      >
        {loading ? (
          <ClayList>
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </ClayList>
        ) : (
          <Animated.View key={weekStart} entering={softEnter()} exiting={SOFT_SWAP_OUT}>
            <ClayList>
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
            </ClayList>
          </Animated.View>
        )}
      </ClaySection>
    </View>
  );
};

/** Riga scheletro dentro una `ClayList` (stesse misure di `ClayListRow`). */
const SkeletonRow = ({ divider }: { divider?: boolean }) => (
  <View style={styles.skRow}>
    {divider ? <View style={styles.divider} /> : null}
    <SkeletonBlock width={150} height={15} radius={7} />
    <SkeletonBlock width={100} height={12} radius={6} style={styles.skSub} />
  </View>
);

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  firstSection: { marginTop: 8 },
  section: { marginTop: 34 },
  weekNav: { flexDirection: 'row', gap: 10 },
  navOff: { opacity: 0.35 },
  publish: { marginTop: 14 },

  dayRow: { overflow: 'hidden' },
  divider: {
    position: 'absolute', top: 0, left: 18, right: 18, zIndex: 1,
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)',
  },
  dayFg: { backgroundColor: CLAY.surface },
  swipeAction: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: MAX_SWIPE,
    alignItems: 'center', justifyContent: 'center',
  },
  swipeActionText: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },

  skRow: { paddingVertical: 14, paddingHorizontal: 18, minHeight: 62, justifyContent: 'center' },
  skSub: { marginTop: 7 },
});
