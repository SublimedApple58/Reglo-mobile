import React, { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { dateRangeStore } from '../../../src/stores/dateRangeStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const NAVY = '#1A1A2E';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const fmtShort = (isoStr: string) => { const [, m, d] = isoStr.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000) + 1;

export default function SelectDateRangeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(dateRangeStore.subscribe, dateRangeStore.get);

  const [start, setStart] = useState<string | null>(data?.from ?? null);
  const [end, setEnd] = useState<string | null>(data?.to ?? null);
  const initMonth = data?.from ? new Date(data.from + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initMonth.getMonth());

  if (!data) return <View style={s.root} />;
  const { minISO, maxISO } = data;

  const isDisabled = (dISO: string) => (!!minISO && dISO < minISO) || (!!maxISO && dISO > maxISO);

  const onTapDay = (dISO: string) => {
    if (isDisabled(dISO)) return;
    if (!start || (start && end)) {
      setStart(dISO);
      setEnd(null);
    } else {
      if (dISO >= start) setEnd(dISO);
      else { setStart(dISO); setEnd(null); }
    }
  };

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const prevMonthLastISO = iso(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1, new Date(viewYear, viewMonth, 0).getDate());
  const nextMonthFirstISO = iso(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, 1);
  const canGoPrev = !minISO || prevMonthLastISO >= minISO;
  const canGoNext = !maxISO || nextMonthFirstISO <= maxISO;

  const canApply = !!start;
  const handleApply = () => {
    if (!start) return;
    const b = end ?? start;
    const from = start <= b ? start : b;
    const to = start <= b ? b : start;
    data.onApply(from, to);
    router.back();
  };

  const summary = start
    ? (end && end !== start
        ? `${fmtShort(start)} – ${fmtShort(end)} · ${daysBetween(start, end)} giorni`
        : `${fmtShort(start)} · 1 giorno`)
    : 'Tocca il giorno di inizio e quello di fine';

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 16 }, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.header}>
        <Text style={s.title}>{data.title ?? 'Seleziona periodo'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <SheetScaffold
        footer={
          <View style={s.footer}>
            <Text style={s.summary}>{summary}</Text>
            <Pressable
              onPress={canApply ? handleApply : undefined}
              disabled={!canApply}
              style={({ pressed }) => [s.cta, !canApply && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.ctaText}>Applica</Text>
            </Pressable>
          </View>
        }
      >
      <View style={s.calHeader}>
        <Pressable onPress={() => canGoPrev && goMonth(-1)} hitSlop={12} style={s.calArrow} disabled={!canGoPrev}>
          <Ionicons name="chevron-back" size={18} color={canGoPrev ? NAVY : '#D1D5DB'} />
        </Pressable>
        <Text style={s.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={() => canGoNext && goMonth(1)} hitSlop={12} style={s.calArrow} disabled={!canGoNext}>
          <Ionicons name="chevron-forward" size={18} color={canGoNext ? NAVY : '#D1D5DB'} />
        </Pressable>
      </View>

      <View style={s.weekRow}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={s.weekday}>{w}</Text>)}
      </View>

      <View style={s.grid}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`b${i}`} style={s.cell} />;
          const dISO = iso(viewYear, viewMonth, day);
          const isStart = dISO === start;
          const isEnd = dISO === end;
          const inRange = !!start && !!end && dISO > start && dISO < end;
          const isEdge = isStart || isEnd;
          const hasRange = !!start && !!end && start !== end;
          const bandFull = inRange;
          const bandRight = isStart && hasRange;
          const bandLeft = isEnd && hasRange;
          const disabled = isDisabled(dISO);
          return (
            <Pressable key={dISO} style={s.cell} onPress={() => onTapDay(dISO)} disabled={disabled}>
              {bandFull || bandLeft || bandRight ? (
                <View style={[s.band, bandFull && s.bandFull, bandLeft && s.bandLeft, bandRight && s.bandRight]} />
              ) : null}
              <View style={[s.day, isEdge && s.dayEdge]}>
                <Text style={[s.dayText, disabled && s.dayTextDisabled, isEdge && s.dayTextEdge]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 14, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  calMonth: { fontSize: 16, fontWeight: '700', color: NAVY, letterSpacing: -0.2 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 3, height: 38, backgroundColor: '#EEF2F6' },
  bandFull: { left: 0, right: 0 },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: NAVY },
  dayText: { fontSize: 14, fontWeight: '600', color: NAVY },
  dayTextEdge: { color: '#FFFFFF', fontWeight: '700' },
  dayTextDisabled: { color: '#CBD5E1' },

  footer: { marginTop: 18, gap: 12 },
  summary: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  cta: { backgroundColor: NAVY, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
