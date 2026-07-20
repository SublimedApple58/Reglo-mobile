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
        <Ionicons name="chevron-down" size={16} color="#6A6A6A" />
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
            {/* Hero — numero grande + sub + pill teoria (borderless, stile Airbnb/web) */}
            <View style={s.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroValue}>{formatMinutes(data.total.totalMinutes)}</Text>
                <Text style={s.heroSub}>
                  {data.total.appointmentCount} {data.total.appointmentCount === 1 ? 'guida' : 'guide'} · {periodLabel.toLowerCase()}
                </Text>
                {data.total.theoryMinutes > 0 && (
                  <View style={s.theoryPill}>
                    <Ionicons name="book" size={12} color="#4F46E5" />
                    <Text style={s.theoryPillText}>Lezione teorica · {formatMinutes(data.total.theoryMinutes)}</Text>
                  </View>
                )}
              </View>
              <Image source={FLUENT_CLOCK} style={s.heroIcon} />
            </View>

            <View style={s.divider} />

            {/* Statistiche — pallini coordinati con le barre del grafico */}
            <View style={s.stats}>
              <View style={s.stat}>
                <View style={s.statLabelRow}>
                  <View style={[s.statDot, { backgroundColor: '#1A1A2E' }]} />
                  <Text style={s.statLabel}>In orario</Text>
                </View>
                <Text style={s.statValue}>
                  {formatMinutes(Math.max(data.total.totalMinutes - data.total.outsideWorkingHoursMinutes, 0))}
                </Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.stat}>
                <View style={s.statLabelRow}>
                  <View style={[s.statDot, { backgroundColor: '#C9CCD6' }]} />
                  <Text style={s.statLabel}>Fuori orario</Text>
                </View>
                <Text style={s.statValue}>{formatMinutes(data.total.outsideWorkingHoursMinutes)}</Text>
              </View>
            </View>

            {/* Breakdown */}
            <Text style={s.sectionLabel}>
              {data.granularity === 'day' ? 'Dettaglio giornaliero' : 'Dettaglio settimanale'}
            </Text>
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

            {/* Working hours */}
            {data.workingHoursStart && data.workingHoursEnd ? (
              <View style={s.infoRow}>
                <Ionicons name="time-outline" size={14} color="#929292" />
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

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  backBtn: { padding: 2 },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },

  periodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#DDDDDD',
  },
  periodLabel: { fontSize: 15, fontWeight: '600', color: '#222222', letterSpacing: -0.2 },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: 8 },

  // Airbnb puro: sezioni borderless su pagina bianca, separate da linee sottili.
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#929292', marginTop: 26, marginBottom: 16 },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  heroValue: { fontSize: 44, fontWeight: '800', color: '#222222', letterSpacing: -2, lineHeight: 46 },
  heroSub: { fontSize: 14, fontWeight: '500', color: '#929292', marginTop: 8 },
  heroIcon: { width: 54, height: 54, marginLeft: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: '#EBEBEB', marginVertical: 22 },

  stats: { flexDirection: 'row', alignItems: 'flex-start' },
  stat: { flex: 1 },
  statDiv: { width: 1, backgroundColor: '#EBEBEB', alignSelf: 'stretch', marginHorizontal: 20 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statDot: { width: 8, height: 8, borderRadius: 3 },
  statLabel: { fontSize: 13, fontWeight: '500', color: '#929292' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#222222', letterSpacing: -0.6, marginTop: 6 },

  // Lezione teorica — pill indaco (uguale alla web app).
  theoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 10, backgroundColor: '#E6E9FF', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11,
  },
  theoryPillText: { fontSize: 12.5, fontWeight: '600', color: '#3730A3', letterSpacing: -0.1 },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: COLUMN_HEIGHT + 36 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  colTrack: { width: '100%', height: COLUMN_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '58%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4, overflow: 'hidden', flexDirection: 'column' },
  barInside: { width: '100%', backgroundColor: '#1A1A2E' },
  barOutside: { width: '100%', backgroundColor: '#C9CCD6' },
  colEmpty: { width: '58%', height: 4, borderRadius: 2, backgroundColor: '#F2F2F4' },
  colValue: { fontSize: 10, fontWeight: '700', color: '#929292', fontVariant: ['tabular-nums'] },
  colLabel: { fontSize: 11, fontWeight: '500', color: '#C1C1C1' },
  colLabelToday: { color: '#222222', fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  infoText: { fontSize: 12, color: '#929292' },

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
