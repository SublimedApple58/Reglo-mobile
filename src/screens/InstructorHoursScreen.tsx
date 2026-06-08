import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { colors, spacing } from '../theme';
import { useInstructorHours } from '../hooks/queries/useInstructorHours';
import { hoursPeriodStore } from '../stores/hoursPeriodStore';
import type { InstructorHoursBucket } from '../types/regloApi';

const FLUENT_CLOCK = require('../../assets/icons/fluent-clock.png');

const pad = (n: number) => String(n).padStart(2, '0');
const isoOfDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const fmtShort = (isoStr: string) => {
  const [, m, d] = isoStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

function currentWeek() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  return { from: isoOfDate(monday), to: isoOfDate(addDays(monday, 6)) };
}

function periodPresets() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const mFirst = new Date(today.getFullYear(), today.getMonth(), 1);
  const mLast = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    week: { from: isoOfDate(monday), to: isoOfDate(addDays(monday, 6)) },
    month: { from: isoOfDate(mFirst), to: isoOfDate(mLast) },
    last30: { from: isoOfDate(addDays(today, -29)), to: isoOfDate(today) },
  };
}

function formatPeriodLabel(from: string, to: string): string {
  const p = periodPresets();
  if (from === p.week.from && to === p.week.to) return 'Questa settimana';
  if (from === p.month.from && to === p.month.to) {
    const [, m] = from.split('-').map(Number);
    return `${MONTHS[m - 1]} ${from.slice(0, 4)}`;
  }
  if (from === p.last30.from && to === p.last30.to) return 'Ultimi 30 giorni';
  if (from === to) return fmtShort(from);
  return `${fmtShort(from)} – ${fmtShort(to)}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const COLUMN_HEIGHT = 132;

function BucketColumn({
  bucket, maxMinutes, isToday, showValue,
}: { bucket: InstructorHoursBucket; maxMinutes: number; isToday: boolean; showValue: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(maxMinutes > 0 ? bucket.totalMinutes / maxMinutes : 0, { duration: 550 });
  }, [bucket.totalMinutes, maxMinutes, progress]);
  const barStyle = useAnimatedStyle(() => ({ height: progress.value * COLUMN_HEIGHT }));

  const isEmpty = bucket.totalMinutes === 0;
  const outsideFrac = bucket.totalMinutes > 0
    ? Math.min(bucket.outsideWorkingHoursMinutes / bucket.totalMinutes, 1) : 0;

  return (
    <View style={s.column}>
      {showValue && !isEmpty ? <Text style={s.colValue}>{formatMinutes(bucket.totalMinutes)}</Text> : <View style={{ height: 14 }} />}
      <View style={s.colTrack}>
        {isEmpty ? (
          <View style={s.colEmpty} />
        ) : (
          <Animated.View style={[s.bar, barStyle]}>
            {outsideFrac > 0 ? <View style={[s.barOutside, { flex: outsideFrac }]} /> : null}
            <View style={[s.barInside, { flex: Math.max(1 - outsideFrac, 0.0001) }]} />
          </Animated.View>
        )}
      </View>
      <Text style={[s.colLabel, isToday && s.colLabelToday]} numberOfLines={1}>{bucket.label}</Text>
    </View>
  );
}

export const InstructorHoursScreen = () => {
  const router = useRouter();
  const [period, setPeriod] = useState(() => currentWeek());

  const { data, isLoading, isError, refetch, isRefetching } = useInstructorHours(period.from, period.to);

  const periodLabel = useMemo(() => formatPeriodLabel(period.from, period.to), [period]);
  const todayISO = useMemo(() => isoOfDate(new Date()), []);
  const currentWeekMonday = useMemo(() => currentWeek().from, []);

  const openPicker = () => {
    hoursPeriodStore.set({
      from: period.from,
      to: period.to,
      onApply: (from, to) => setPeriod({ from, to }),
    });
    router.push('/(tabs)/more/hours-period');
  };

  const maxBucketMinutes = useMemo(
    () => (data ? Math.max(...data.buckets.map((b) => b.totalMinutes), 1) : 1),
    [data],
  );
  const showBarValues = !!data && data.buckets.length <= 8;

  return (
    <Screen>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </Pressable>
        <Text style={s.title}>Ore di guida</Text>
      </View>

      {/* Period selector */}
      <Pressable onPress={openPicker} style={({ pressed }) => [s.periodPill, pressed && { opacity: 0.9 }]}>
        <Ionicons name="calendar-outline" size={16} color="#1A1A2E" />
        <Text style={s.periodLabel}>{periodLabel}</Text>
        <Ionicons name="chevron-down" size={16} color="#64748B" />
      </Pressable>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <SkeletonCard style={s.skelHero}>
              <SkeletonBlock height={34} width="45%" radius={8} />
              <SkeletonBlock height={14} width="35%" radius={6} style={{ marginTop: 10 }} />
            </SkeletonCard>
            <SkeletonCard style={s.skelChart}><SkeletonBlock height={120} radius={10} /></SkeletonCard>
          </View>
        ) : isError ? (
          <View style={s.empty}>
            <View style={s.emptyIconCircle}><Image source={FLUENT_CLOCK} style={s.emptyIcon} /></View>
            <Text style={s.emptyTitle}>Errore nel caricamento</Text>
            <Text style={s.emptySub}>Trascina verso il basso per riprovare.</Text>
          </View>
        ) : !data || data.total.totalMinutes === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconCircle}><Image source={FLUENT_CLOCK} style={s.emptyIcon} /></View>
            <Text style={s.emptyTitle}>Nessuna guida nel periodo</Text>
            <Text style={s.emptySub}>Le ore di guida compariranno qui dopo le lezioni completate.</Text>
          </View>
        ) : (
          <>
            {/* Hero — total + in/out breakdown */}
            <View style={s.hero}>
              <View style={s.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroValue}>{formatMinutes(data.total.totalMinutes)}</Text>
                  <Text style={s.heroSub}>
                    {data.total.appointmentCount} {data.total.appointmentCount === 1 ? 'guida' : 'guide'} · {periodLabel.toLowerCase()}
                  </Text>
                </View>
                <Image source={FLUENT_CLOCK} style={s.heroIcon} />
              </View>

              <View style={s.heroDivider} />

              <View style={s.heroStats}>
                <View style={s.heroStat}>
                  <View style={s.statTop}>
                    <View style={[s.statDot, { backgroundColor: '#1A1A2E' }]} />
                    <Text style={s.statLabel}>In orario</Text>
                  </View>
                  <Text style={s.statValue}>
                    {formatMinutes(Math.max(data.total.totalMinutes - data.total.outsideWorkingHoursMinutes, 0))}
                  </Text>
                </View>
                <View style={s.heroStatDivider} />
                <View style={s.heroStat}>
                  <View style={s.statTop}>
                    <View style={[s.statDot, { backgroundColor: '#1A1A2E' }]} />
                    <Text style={s.statLabel}>Fuori orario</Text>
                  </View>
                  <Text style={s.statValue}>{formatMinutes(data.total.outsideWorkingHoursMinutes)}</Text>
                </View>
              </View>
            </View>

            {/* Breakdown */}
            <Text style={s.sectionLabel}>
              {data.granularity === 'day' ? 'DETTAGLIO GIORNALIERO' : 'DETTAGLIO SETTIMANALE'}
            </Text>
            <View style={s.card}>
              <View style={s.chartRow}>
                {data.buckets.map((b) => {
                  const isToday = data.granularity === 'day'
                    ? b.startDate === todayISO
                    : b.startDate === currentWeekMonday;
                  return (
                    <BucketColumn key={b.key} bucket={b} maxMinutes={maxBucketMinutes} isToday={isToday} showValue={showBarValues} />
                  );
                })}
              </View>
            </View>

            {/* Working hours */}
            {data.workingHoursStart && data.workingHoursEnd ? (
              <View style={s.infoRow}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={s.infoText}>Orario di lavoro {data.workingHoursStart}–{data.workingHoursEnd}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const CARD_SHADOW = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
} as const;

// Informative data cards: INSET shadow (recessed) on a light surface.
const INSET_CARD = {
  backgroundColor: '#FFFFFF',
  boxShadow: [
    { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.10)', inset: true },
    { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.05)', inset: true },
  ],
} as const;

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  backBtn: { padding: 2 },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },

  periodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    marginBottom: 10, backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  periodLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: 8 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 10,
  },

  hero: { borderRadius: 22, padding: 22, ...INSET_CARD },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroValue: { fontSize: 40, fontWeight: '700', color: '#1A1A2E', letterSpacing: -1.2, lineHeight: 44 },
  heroSub: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  heroIcon: { width: 64, height: 64, marginLeft: 12 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 18 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1 },
  heroStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, alignSelf: 'stretch', marginHorizontal: 14 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 6 },

  card: { borderRadius: 20, padding: 16, ...INSET_CARD },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: COLUMN_HEIGHT + 36 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  colTrack: { width: '100%', height: COLUMN_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '64%', borderTopLeftRadius: 7, borderTopRightRadius: 7, minHeight: 5, overflow: 'hidden', flexDirection: 'column' },
  barInside: { width: '100%', backgroundColor: '#1A1A2E' },
  barOutside: { width: '100%', backgroundColor: '#1A1A2E' },
  colEmpty: { width: '64%', height: 5, borderRadius: 3, backgroundColor: '#E5E7EB' },
  colValue: { fontSize: 10, fontWeight: '700', color: '#64748B', fontVariant: ['tabular-nums'] },
  colLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  colLabelToday: { color: '#1A1A2E', fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  infoText: { fontSize: 12, color: '#9CA3AF' },

  skelHero: { borderRadius: 22, padding: 22, height: 108 },
  skelChart: { borderRadius: 20, padding: 16 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...CARD_SHADOW,
  },
  emptyIcon: { width: 48, height: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
