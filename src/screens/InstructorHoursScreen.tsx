import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonBlock } from '../components/Skeleton';
import {
  ClayEmpty,
  ClayHeroNumber,
  ClayList,
  ClayListRow,
  ClaySection,
  ClayStat,
  ClaySurface,
  Icon3D,
} from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { useInstructorHours } from '../hooks/queries/useInstructorHours';
import { hoursPeriodStore } from '../stores/hoursPeriodStore';
import type { InstructorHoursBucket } from '../types/regloApi';

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

/** Numero protagonista: «11 h 30», «45 min», «6 h». */
function heroParts(minutes: number): { value: string; unit: string } {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return { value: String(m), unit: 'min' };
  if (m === 0) return { value: String(h), unit: 'h' };
  return { value: String(h), unit: `h ${pad(m)}` };
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
      {showValue && !isEmpty ? <Text style={s.colValue}>{formatMinutes(bucket.totalMinutes)}</Text> : <View style={s.colValueSlot} />}
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

/**
 * «Ore di guida» — REG-639 clay: testata grande con l'indietro clay, il
 * periodo come riga di lista, il totale come numero protagonista (con il
 * trofeo, unica icona di morale della schermata), due tessere numero e il
 * grafico su una superficie clay. Barre nere = in orario, grigie = fuori
 * orario (detto nella nota sotto, niente pallini colorati).
 */
export const InstructorHoursScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const chartNote = data
    ? [
        data.workingHoursStart && data.workingHoursEnd
          ? `Orario di lavoro ${data.workingHoursStart}–${data.workingHoursEnd}.`
          : null,
        data.total.outsideWorkingHoursMinutes > 0 ? 'In grigio le ore fuori orario.' : null,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={CLAY.ink3} />}
      >
        <ClayPageHeader title="Ore di guida" subtitle="Il tempo che hai passato al volante" onBack={() => router.back()} />

        <ClayList style={s.period}>
          <ClayListRow
            title="Periodo"
            trailing={<Text style={s.periodValue} numberOfLines={1}>{periodLabel}</Text>}
            onPress={openPicker}
            testID="hours-period-row"
          />
        </ClayList>

        {isLoading ? (
          <View style={s.skel}>
            <SkeletonBlock height={46} width="45%" radius={10} />
            <SkeletonBlock height={14} width="35%" radius={6} style={{ marginTop: 12 }} />
            <SkeletonBlock height={150} radius={22} style={{ marginTop: 28 }} />
          </View>
        ) : isError ? (
          <ClayEmpty title="Errore nel caricamento" text="Trascina verso il basso per riprovare." />
        ) : !data || data.total.totalMinutes === 0 ? (
          <ClayEmpty
            icon={VITA_ART.orologio}
            title="Nessuna guida nel periodo"
            text="Le ore di guida compariranno qui dopo le lezioni completate."
          />
        ) : (
          <>
            {/* REG-639 «vita»: il numero che conta in una card, con l'orologio 3D. */}
            <ClaySurface radius={26} style={s.heroCard}>
              <View style={s.heroMain}>
                <ClayHeroNumber
                  {...heroParts(data.total.totalMinutes)}
                  caption={`${data.total.appointmentCount} ${data.total.appointmentCount === 1 ? 'guida' : 'guide'} · ${periodLabel.toLowerCase()}`}
                />
                {data.total.theoryMinutes > 0 ? (
                  <Text style={s.theory}>Lezione teorica · {formatMinutes(data.total.theoryMinutes)}</Text>
                ) : null}
              </View>
              <Icon3D source={VITA_ART.orologio} size={72} />
            </ClaySurface>

            <View style={s.stats}>
              <ClayStat
                value={formatMinutes(Math.max(data.total.totalMinutes - data.total.outsideWorkingHoursMinutes, 0))}
                label="nei tuoi orari"
              />
              <ClayStat value={formatMinutes(data.total.outsideWorkingHoursMinutes)} label="fuori orario" />
            </View>

            <ClaySection
              title={data.granularity === 'day' ? 'Dettaglio giornaliero' : 'Dettaglio settimanale'}
              footnote={chartNote || undefined}
            >
              <ClaySurface style={s.chartCard}>
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
              </ClaySurface>
            </ClaySection>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },

  period: { marginTop: 20 },
  periodValue: { fontSize: 15.5, color: CLAY.ink3, maxWidth: 200 },

  skel: { marginTop: 28 },

  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingVertical: 18, paddingHorizontal: 20 },
  heroMain: { flex: 1, minWidth: 0 },
  theory: { fontSize: 14.5, color: CLAY.ink3, marginTop: 4 },

  stats: { flexDirection: 'row', gap: 12, marginTop: 12 },

  chartCard: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: COLUMN_HEIGHT + 36 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  colTrack: { width: '100%', height: COLUMN_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '58%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4, overflow: 'hidden', flexDirection: 'column' },
  barInside: { width: '100%', backgroundColor: CLAY.ink },
  barOutside: { width: '100%', backgroundColor: '#CECECE' },
  colEmpty: { width: '58%', height: 4, borderRadius: 2, backgroundColor: 'rgba(17,17,17,0.08)' },
  colValueSlot: { height: 14 },
  colValue: { fontSize: 10, fontWeight: '600', color: CLAY.ink3, fontVariant: ['tabular-nums'] },
  colLabel: { fontSize: 11, fontWeight: '500', color: CLAY.ink4 },
  colLabelToday: { color: CLAY.ink, fontWeight: '600' },
});
