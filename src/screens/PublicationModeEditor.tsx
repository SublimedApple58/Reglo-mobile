import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import RangesEditor, { TimeRange } from '../components/RangesEditor';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

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

const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const DAY_NAMES_LONG = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
];
const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];
const SPRING_PRESS = { damping: 15, stiffness: 200 };

// ── Helpers ────────────────────────────────────────────────────

const buildTime = (h: number, m: number): Date => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const formatWeekRange = (weekStart: string): string => {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(start.getTime() + 6 * 86400000);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    const month = start.toLocaleDateString('it-IT', {
      month: 'long',
      timeZone: 'UTC',
    });
    return `${start.getUTCDate()} – ${end.getUTCDate()} ${month}`;
  }
  const sm = start.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const em = end.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return `${sm} – ${em}`;
};

const getMonday = (offset: number = 0): string => {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatDetailDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
};

const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Sub-components ─────────────────────────────────────────────

const NavArrow = ({
  onPress,
  direction,
}: {
  onPress: () => void;
  direction: 'back' | 'forward';
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.88, SPRING_PRESS);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING_PRESS);
      }}
      onPress={onPress}
      hitSlop={14}
    >
      <Animated.View style={[styles.navArrow, animStyle]}>
        <Ionicons
          name={direction === 'back' ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
};

// ── Main Component ─────────────────────────────────────────────

export const PublicationModeEditor = ({ instructorId, onToast }: Props) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => getMonday(weekOffset), [weekOffset]);
  const [days, setDays] = useState<DayState[]>([]);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const [timePickerTarget, setTimePickerTarget] = useState<{
    dayIndex: number;
    rangeIndex: number;
    field: 'start' | 'end';
  } | null>(null);

  const todayStr = useMemo(getTodayStr, []);
  const selectedDayData = days[selectedDay] ?? null;

  // ── Data loading ───────────────────────────────────────────

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const ws = new Date(weekStart + 'T00:00:00Z');
      const we = new Date(ws.getTime() + 6 * 86400000);
      const weStr = `${we.getUTCFullYear()}-${String(we.getUTCMonth() + 1).padStart(2, '0')}-${String(we.getUTCDate()).padStart(2, '0')}`;

      const [publishedRes, overridesRes] = await Promise.all([
        regloApi.getPublishedWeeks({
          instructorId,
          from: weekStart,
          to: weekStart,
        }),
        regloApi.getDailyAvailabilityOverrides({
          ownerType: 'instructor',
          ownerId: instructorId,
          from: weekStart,
          to: weStr,
        }),
      ]);

      setPublished(publishedRes.length > 0);

      const newDays: DayState[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws.getTime() + i * 86400000);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const override = overridesRes.find(
          (o: any) => o.date?.slice(0, 10) === dateStr,
        );
        const ranges: TimeRange[] = override?.ranges?.length
          ? (override.ranges as TimeRange[])
          : [];
        newDays.push({
          date: dateStr,
          available: ranges.length > 0,
          ranges: ranges.length > 0 ? ranges : [...DEFAULT_RANGES],
        });
      }
      setDays(newDays);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore nel caricamento',
        'danger',
      );
    } finally {
      setLoading(false);
    }
  }, [weekStart, instructorId, onToast]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // ── Day toggle ─────────────────────────────────────────────

  const toggleDay = useCallback(
    async (dayIndex: number) => {
      const day = days[dayIndex];
      if (!day) return;
      const newAvailable = !day.available;
      const newRanges = newAvailable ? day.ranges : [];

      setSavingDay(dayIndex);
      try {
        await regloApi.setDailyAvailabilityOverride({
          ownerType: 'instructor',
          ownerId: instructorId,
          date: day.date,
          ranges: newRanges,
        });
        setDays((prev) =>
          prev.map((d, i) =>
            i === dayIndex ? { ...d, available: newAvailable } : d,
          ),
        );
      } catch {
        onToast('Errore nel salvataggio', 'danger');
      } finally {
        setSavingDay(null);
      }
    },
    [days, instructorId, onToast],
  );

  // ── Range editing ──────────────────────────────────────────

  const updateRanges = useCallback(
    async (dayIndex: number, ranges: TimeRange[]) => {
      const day = days[dayIndex];
      if (!day) return;
      setDays((prev) =>
        prev.map((d, i) => (i === dayIndex ? { ...d, ranges } : d)),
      );
      try {
        await regloApi.setDailyAvailabilityOverride({
          ownerType: 'instructor',
          ownerId: instructorId,
          date: day.date,
          ranges,
        });
      } catch {
        onToast('Errore nel salvataggio della fascia', 'danger');
      }
    },
    [days, instructorId, onToast],
  );

  const handlePickTime = useCallback(
    (dayIndex: number, rangeIndex: number, field: 'start' | 'end') => {
      setTimePickerTarget({ dayIndex, rangeIndex, field });
    },
    [],
  );

  const handleTimePickerSelect = useCallback(
    (date: Date) => {
      if (!timePickerTarget) return;
      const minutes = date.getHours() * 60 + date.getMinutes();
      const { dayIndex, rangeIndex, field } = timePickerTarget;
      const day = days[dayIndex];
      if (!day) return;
      const key = field === 'start' ? 'startMinutes' : 'endMinutes';
      const newRanges = day.ranges.map((r, i) =>
        i === rangeIndex ? { ...r, [key]: minutes } : r,
      );
      updateRanges(dayIndex, newRanges);
    },
    [timePickerTarget, days, updateRanges],
  );

  const timePickerSelectedTime = useMemo(() => {
    if (!timePickerTarget) return buildTime(9, 0);
    const day = days[timePickerTarget.dayIndex];
    if (!day) return buildTime(9, 0);
    const range = day.ranges[timePickerTarget.rangeIndex];
    if (!range) return buildTime(9, 0);
    const mins =
      timePickerTarget.field === 'start'
        ? range.startMinutes
        : range.endMinutes;
    return buildTime(Math.floor(mins / 60), mins % 60);
  }, [timePickerTarget, days]);

  const handleAddRange = useCallback(
    (dayIndex: number) => {
      const day = days[dayIndex];
      if (!day) return;
      const lastEnd = day.ranges[day.ranges.length - 1]?.endMinutes ?? 540;
      const newRange: TimeRange = {
        startMinutes: lastEnd,
        endMinutes: Math.min(lastEnd + 120, 1440),
      };
      updateRanges(dayIndex, [...day.ranges, newRange]);
    },
    [days, updateRanges],
  );

  // ── Publish / Unpublish ────────────────────────────────────

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await regloApi.publishWeek({ weekStart, instructorId });
      setPublished(true);
      onToast('Settimana pubblicata');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore nella pubblicazione',
        'danger',
      );
    } finally {
      setPublishing(false);
    }
  }, [weekStart, instructorId, onToast]);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    try {
      await regloApi.unpublishWeek({ weekStart, instructorId });
      setPublished(false);
      onToast('Pubblicazione ritirata');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore nel ritiro',
        'danger',
      );
    } finally {
      setPublishing(false);
    }
  }, [weekStart, instructorId, onToast]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Week Navigation ────────────────────────────────── */}
      <View style={styles.weekNav}>
        <NavArrow
          direction="back"
          onPress={() => setWeekOffset((p) => p - 1)}
        />
        <View style={styles.weekCenter}>
          <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: published ? '#F0FDF4' : '#FEFCE8',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: published ? '#22C55E' : '#CA8A04' },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: published ? '#16A34A' : '#CA8A04' },
              ]}
            >
              {published ? 'Pubblicata' : 'Bozza'}
            </Text>
          </View>
        </View>
        <NavArrow
          direction="forward"
          onPress={() => setWeekOffset((p) => p + 1)}
        />
      </View>

      {/* ── Main Panel ─────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.panel}>
            {/* Day strip — horizontal selector */}
            <View style={styles.dayStrip}>
              {days.map((day, i) => {
                const isSelected = i === selectedDay;
                const isToday = day.date === todayStr;
                return (
                  <Pressable
                    key={day.date}
                    onPress={() => setSelectedDay(i)}
                    style={[
                      styles.dayPill,
                      day.available && styles.dayPillAvailable,
                      !day.available && styles.dayPillInactive,
                      isSelected && styles.dayPillSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayPillLetter,
                        day.available && styles.dayPillTextLight,
                      ]}
                    >
                      {DAY_LETTERS[i]}
                    </Text>
                    <Text
                      style={[
                        styles.dayPillDate,
                        day.available && styles.dayPillTextLight,
                        isToday &&
                          !day.available &&
                          styles.dayPillDateToday,
                      ]}
                    >
                      {new Date(day.date + 'T00:00:00Z').getUTCDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.panelDivider} />

            {/* Detail for selected day */}
            {selectedDayData && (
              <Animated.View
                key={selectedDayData.date}
                entering={FadeIn.duration(180)}
              >
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailTitle}>
                      {DAY_NAMES_LONG[selectedDay]}
                    </Text>
                    <Text style={styles.detailSubtitle}>
                      {formatDetailDate(selectedDayData.date)}
                    </Text>
                  </View>
                  <View style={styles.detailControls}>
                    {savingDay === selectedDay && (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                      />
                    )}
                    <Switch
                      value={selectedDayData.available}
                      onValueChange={() => toggleDay(selectedDay)}
                      trackColor={{
                        false: '#E5E7EB',
                        true: colors.primary,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>

                {selectedDayData.available ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(120)}
                    style={styles.detailRanges}
                  >
                    <RangesEditor
                      ranges={selectedDayData.ranges}
                      onChange={(ranges) =>
                        updateRanges(selectedDay, ranges)
                      }
                      onPickTime={(rangeIndex, field) =>
                        handlePickTime(selectedDay, rangeIndex, field)
                      }
                      onAddRange={() => handleAddRange(selectedDay)}
                    />
                  </Animated.View>
                ) : (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={styles.detailOff}
                  >
                    <Ionicons
                      name="moon-outline"
                      size={20}
                      color={colors.textMuted}
                    />
                    <Text style={styles.detailOffText}>
                      Non disponibile
                    </Text>
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </View>

          {/* ── Publish CTA ──────────────────────────────────── */}
          <Animated.View entering={FadeIn.duration(250).delay(200)}>
            <Button
              label={
                published
                  ? publishing
                    ? 'Ritirando...'
                    : 'Ritira pubblicazione'
                  : publishing
                    ? 'Pubblicando...'
                    : 'Pubblica settimana'
              }
              onPress={published ? handleUnpublish : handlePublish}
              tone={published ? 'danger' : 'primary'}
              disabled={publishing}
              fullWidth
            />
          </Animated.View>
        </>
      )}

      <TimePickerDrawer
        visible={timePickerTarget !== null}
        selectedTime={timePickerSelectedTime}
        onSelectTime={handleTimePickerSelect}
        onClose={() => setTimePickerTarget(null)}
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },

  /* ── Week navigation ─────────────────────────────────── */
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  navArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCenter: {
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ── Loader ──────────────────────────────────────────── */
  loader: {
    marginTop: 24,
  },

  /* ── Panel ───────────────────────────────────────────── */
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  /* ── Day strip ───────────────────────────────────────── */
  dayStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayPillAvailable: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayPillInactive: {
    backgroundColor: '#F1F5F9',
  },
  dayPillSelected: {
    borderColor: colors.accent,
  },
  dayPillLetter: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  dayPillDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayPillTextLight: {
    color: '#FFFFFF',
  },
  dayPillDateToday: {
    color: colors.primary,
  },

  /* ── Panel divider ───────────────────────────────────── */
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  /* ── Detail section ──────────────────────────────────── */
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 2,
  },
  detailControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailRanges: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  detailOff: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.xl,
  },
  detailOffText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
});
