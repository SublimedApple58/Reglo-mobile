import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { colors, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import type { InstructorHoursEntry, InstructorHoursDayBreakdown } from '../types/regloApi';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getUTCDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) =>
    `${d.getUTCDate()} ${d.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' })}`;
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

const COLUMN_HEIGHT = 120;

function DayColumn({
  day,
  maxMinutes,
}: {
  day: InstructorHoursDayBreakdown;
  maxMinutes: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(maxMinutes > 0 ? day.totalMinutes / maxMinutes : 0, {
      duration: 500,
    });
  }, [day.totalMinutes, maxMinutes, progress]);

  const barStyle = useAnimatedStyle(() => ({
    height: progress.value * COLUMN_HEIGHT,
  }));

  const hasOutside = day.outsideWorkingHoursMinutes > 0;
  const isEmpty = day.totalMinutes === 0;

  return (
    <View style={s.column}>
      {!isEmpty && (
        <Text style={s.colValue}>{formatMinutes(day.totalMinutes)}</Text>
      )}
      <View style={s.colTrack}>
        {isEmpty ? (
          <View style={s.colEmpty} />
        ) : (
          <Animated.View
            style={[
              s.colFill,
              hasOutside ? s.colFillAmber : s.colFillPink,
              barStyle,
            ]}
          />
        )}
      </View>
      <Text style={s.colLabel}>{day.dayLabel}</Text>
    </View>
  );
}

export const InstructorHoursScreen = () => {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [data, setData] = useState<InstructorHoursEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async (ws: Date, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const monthStart = `${ws.toISOString().slice(0, 7)}-01`;
      const result = await regloApi.getInstructorHours({
        weekStart: formatDateISO(ws),
        monthStart,
      });
      if (Array.isArray(result) && result.length > 0) {
        setData(result[0]);
      } else {
        setData(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(weekStart);
  }, [weekStart, fetchData]);

  const navigateWeek = (delta: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setUTCDate(next.getUTCDate() + delta * 7);
      return next;
    });
  };

  const isThisWeek = formatDateISO(weekStart) === formatDateISO(getWeekStart(new Date()));

  const maxDayMinutes = useMemo(
    () => (data ? Math.max(...data.weekly.byDay.map((d) => d.totalMinutes), 1) : 1),
    [data],
  );

  const onRefresh = () => fetchData(weekStart, true);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header with back button */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.title}>Ore di guida</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Week navigation */}
        <View style={s.weekNav}>
          <Pressable onPress={() => navigateWeek(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.weekLabel}>
            {isThisWeek ? 'Questa settimana' : formatWeekLabel(weekStart)}
          </Text>
          <Pressable onPress={() => navigateWeek(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={s.skeletonWrap}>
            <SkeletonCard>
              <SkeletonBlock height={32} width="40%" />
              <SkeletonBlock height={14} width="60%" />
            </SkeletonCard>
            <SkeletonCard>
              <SkeletonBlock height={100} />
            </SkeletonCard>
            <SkeletonCard>
              <SkeletonBlock height={20} width="50%" />
            </SkeletonCard>
          </View>
        ) : error ? (
          <Card>
            <Text style={s.emptyText}>Errore nel caricamento. Trascina per riprovare.</Text>
          </Card>
        ) : !data ? (
          <Card>
            <Text style={s.emptyText}>Nessuna guida completata.</Text>
          </Card>
        ) : (
          <>
            {/* Weekly summary */}
            <Card hierarchy="primary" style={s.summaryCard}>
              <Text style={s.bigNumber}>{formatMinutes(data.weekly.totalMinutes)}</Text>
              <Text style={s.summarySubtitle}>questa settimana</Text>
              {data.weekly.outsideWorkingHoursMinutes > 0 && (
                <View style={s.outsideBadge}>
                  <Text style={s.outsideBadgeText}>
                    {formatMinutes(data.weekly.outsideWorkingHoursMinutes)} fuori orario
                  </Text>
                </View>
              )}
            </Card>

            {/* Column chart */}
            <SectionHeader title="Dettaglio giornaliero" />
            <Card style={s.chartCard}>
              <View style={s.chartRow}>
                {data.weekly.byDay.map((day) => (
                  <DayColumn key={day.date} day={day} maxMinutes={maxDayMinutes} />
                ))}
              </View>
            </Card>

            {/* Monthly summary */}
            <SectionHeader title="Mese corrente" />
            <Card>
              <Text style={s.monthTitle}>
                {data.monthly.monthLabel}: {formatMinutes(data.monthly.totalMinutes)}
              </Text>
              {data.monthly.outsideWorkingHoursMinutes > 0 && (
                <Text style={s.monthOutside}>
                  di cui {formatMinutes(data.monthly.outsideWorkingHoursMinutes)} fuori orario
                </Text>
              )}
            </Card>

            {/* Working hours info */}
            {data.workingHoursStart && data.workingHoursEnd && (
              <View style={s.infoRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={s.infoText}>
                  Orario di lavoro: {data.workingHoursStart}–{data.workingHoursEnd}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const s = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  skeletonWrap: {
    gap: 12,
  },
  summaryCard: {
    alignItems: 'center',
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: -4,
  },
  outsideBadge: {
    backgroundColor: '#FEF9C3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FDE047',
    marginTop: 4,
  },
  outsideBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A16207',
  },
  chartCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    height: COLUMN_HEIGHT + 40,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  colTrack: {
    width: '100%',
    height: COLUMN_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  colFill: {
    width: '70%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  colFillPink: {
    backgroundColor: colors.primary,
  },
  colFillAmber: {
    backgroundColor: '#FACC15',
  },
  colEmpty: {
    width: '70%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
  },
  colValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  monthOutside: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A16207',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
