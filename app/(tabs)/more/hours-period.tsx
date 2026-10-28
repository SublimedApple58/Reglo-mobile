import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayIconButton, ClayList, ClayListRow } from '../../../src/components/clay';
import { hoursPeriodStore } from '../../../src/stores/hoursPeriodStore';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const isoOfDate = (date: Date) => iso(date.getFullYear(), date.getMonth(), date.getDate());
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const fmtShort = (isoStr: string) => {
  const [, m, d] = isoStr.split('-').map(Number);
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

/**
 * Periodo delle «Ore di guida» — REG-639 clay: il form sheet unico. I periodi
 * pronti sono righe con la spunta, poi il mese (frecce clay) con gli estremi
 * in nero; il riepilogo è il sottotitolo, «Applica» la CTA in fondo.
 */
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

  if (!data) return <View style={s.empty} />;

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

  const presetOptions = [
    { key: 'week', label: 'Questa settimana', p: presets.week },
    { key: 'month', label: 'Questo mese', p: presets.month },
    { key: 'last30', label: 'Ultimi 30 giorni', p: presets.last30 },
  ] as const;

  return (
    <FormSheet
      title="Periodo"
      subtitle={summary}
      testID="hours-period-sheet"
      cta={<ClayButton title="Applica" onPress={handleApply} disabled={!canApply} testID="hours-period-apply" />}
    >
      {/* Periodi pronti: scelta singola = righe con la spunta. */}
      <ClayList>
        {presetOptions.map((opt) => (
          <ClayListRow
            key={opt.key}
            title={opt.label}
            chevron={false}
            trailing={activePreset === opt.key ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : undefined}
            onPress={() => applyPreset(opt.p)}
            testID={`hours-period-${opt.key}`}
          />
        ))}
      </ClayList>

      {/* Calendario: estremi = cerchio nero clay, i giorni in mezzo su una banda tenue. */}
      <View style={s.calHeader}>
        <ClayIconButton icon="back" onPress={() => goMonth(-1)} accessibilityLabel="Mese precedente" />
        <Text style={s.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
        <ClayIconButton
          icon={<Ionicons name="chevron-forward" size={20} color={CLAY.ink} />}
          onPress={() => { if (canGoNext) goMonth(1); }}
          accessibilityLabel="Mese successivo"
          style={!canGoNext && s.arrowOff}
        />
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
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 14 },
  arrowOff: { opacity: 0.35 },
  calMonth: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: CLAY.ink3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Banda del periodo: velo d'inchiostro tenue (non un fondo grigio di superficie).
  band: { position: 'absolute', top: 3, height: 38, backgroundColor: 'rgba(17,17,17,0.06)' },
  bandFull: { left: 0, right: 0 },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: CLAY.ink, ...CLAY_SHADOW.ink },
  dayText: { fontSize: 15, fontWeight: '400', color: CLAY.ink },
  dayTextEdge: { color: '#FFFFFF', fontWeight: '600' },
  dayTextDisabled: { color: '#D4D4D4' },
});
