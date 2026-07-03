import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { hoursPeriodStore } from '../../../src/stores/hoursPeriodStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const isoOfDate = (date: Date) => iso(date.getFullYear(), date.getMonth(), date.getDate());
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const fmtShort = (isoStr: string) => {
  const [y, m, d] = isoStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

function computePresets() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  const sunday = addDays(monday, 6);
  const monthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthLast = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    week: { from: isoOfDate(monday), to: isoOfDate(sunday) },
    month: { from: isoOfDate(monthFirst), to: isoOfDate(monthLast) },
    last30: { from: isoOfDate(addDays(today, -29)), to: isoOfDate(today) },
  };
}

export default function HoursPeriodScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(hoursPeriodStore.subscribe, hoursPeriodStore.get);

  const presets = useMemo(computePresets, []);
  const todayISO = isoOfDate(new Date());

  const [start, setStart] = useState<string | null>(data?.from ?? null);
  const [end, setEnd] = useState<string | null>(data?.to ?? null);
  const initMonth = data?.from ? new Date(data.from + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initMonth.getMonth());

  if (!data) return <View style={s.root} />;

  const applyPreset = (p: { from: string; to: string }) => {
    setStart(p.from);
    setEnd(p.to);
    const fm = new Date(p.from + 'T00:00:00');
    setViewYear(fm.getFullYear());
    setViewMonth(fm.getMonth());
  };

  const onTapDay = (dISO: string) => {
    if (dISO > todayISO) return;
    if (!start || (start && end)) {
      setStart(dISO);
      setEnd(null);
    } else {
      if (dISO >= start) setEnd(dISO);
      else { setStart(dISO); setEnd(null); }
    }
  };

  const activePreset = (() => {
    if (start && end) {
      if (start === presets.week.from && end === presets.week.to) return 'week';
      if (start === presets.month.from && end === presets.month.to) return 'month';
      if (start === presets.last30.from && end === presets.last30.to) return 'last30';
    }
    return null;
  })();

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  // Grid
  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const nextMonthFirstISO = iso(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, 1);
  const canGoNext = nextMonthFirstISO <= todayISO;

  const canApply = !!start;
  const handleApply = () => {
    if (!start) return;
    const a = start;
    const b = end ?? start;
    const from = a <= b ? a : b;
    const to = a <= b ? b : a;
    data.onApply(from, to);
    router.back();
  };

  const summary = start
    ? (end && end !== start ? `${fmtShort(start)} – ${fmtShort(end)}` : fmtShort(start))
    : 'Seleziona un periodo';

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
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
              <GradientCTABackground radius={26} />
              <Text style={s.ctaText}>Applica</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={s.title}>Periodo</Text>

        {/* Presets */}
        <View style={s.presetRow}>
        {[
          { key: 'week', label: 'Questa settimana', p: presets.week },
          { key: 'month', label: 'Questo mese', p: presets.month },
          { key: 'last30', label: 'Ultimi 30 giorni', p: presets.last30 },
        ].map((opt) => {
          const active = activePreset === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => applyPreset(opt.p)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Calendar */}
      <View style={s.calHeader}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={12} style={s.calArrow}>
          <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
        </Pressable>
        <Text style={s.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={() => canGoNext && goMonth(1)} hitSlop={12} style={s.calArrow} disabled={!canGoNext}>
          <Ionicons name="chevron-forward" size={18} color={canGoNext ? '#1A1A2E' : '#D1D5DB'} />
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
          const bandRight = isStart && hasRange; // start: band extends to the right
          const bandLeft = isEnd && hasRange; // end: band extends to the left
          const disabled = dISO > todayISO;
          return (
            <Pressable key={dISO} style={s.cell} onPress={() => onTapDay(dISO)} disabled={disabled}>
              {bandFull || bandLeft || bandRight ? (
                <View style={[s.band, bandFull && s.bandFull, bandLeft && s.bandLeft, bandRight && s.bandRight]} />
              ) : null}
              <View style={[s.day, isEdge && s.dayEdge]}>
                <Text style={[s.dayText, disabled && s.dayTextDisabled, isEdge && s.dayTextEdge]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
        </View>
      </SheetScaffold>
    </View>
  );
}

const NAVY = '#1A1A2E';
const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 28 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3, marginBottom: 16 },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  chipActive: { borderColor: NAVY, backgroundColor: '#FFFFFF' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: NAVY, fontWeight: '700' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  calMonth: { fontSize: 16, fontWeight: '700', color: NAVY, letterSpacing: -0.2 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Continuous in-range band (behind the day circle). Half-bands on the edges
  // connect to the full bands of the in-between days.
  band: { position: 'absolute', top: 3, height: 38, backgroundColor: '#EEF2F6' },
  bandFull: { left: 0, right: 0 },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: NAVY },
  dayText: { fontSize: 14, fontWeight: '600', color: NAVY },
  dayTextEdge: { color: '#FFFFFF', fontWeight: '700' },
  dayTextDisabled: { color: '#CBD5E1' },

  footer: { marginTop: 20, gap: 12 },
  summary: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  cta: {
    height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
