import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayIconButton } from '../../../src/components/clay';
import { dateRangeStore } from '../../../src/stores/dateRangeStore';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const fmtShort = (isoStr: string) => { const [, m, d] = isoStr.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000) + 1;

/**
 * Scelta di un periodo — REG-639 clay: il form sheet unico. Mese con frecce
 * clay, estremi = cerchio nero in clay, i giorni in mezzo su una banda tenue.
 * Il riepilogo è il sottotitolo, «Applica» la CTA in fondo.
 */
export default function SelectDateRangeScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(dateRangeStore.subscribe, dateRangeStore.get);

  const [start, setStart] = useState<string | null>(data?.from ?? null);
  const [end, setEnd] = useState<string | null>(data?.to ?? null);
  const initMonth = data?.from ? new Date(data.from + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initMonth.getMonth());

  if (!data) return <View style={s.empty} />;
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
    <FormSheet
      title={data.title ?? 'Seleziona periodo'}
      subtitle={summary}
      testID="select-date-range-sheet"
      cta={<ClayButton title="Applica" onPress={handleApply} disabled={!canApply} testID="select-date-range-apply" />}
    >
      <View style={s.calHeader}>
        <ClayIconButton
          icon="back"
          onPress={() => { if (canGoPrev) goMonth(-1); }}
          accessibilityLabel="Mese precedente"
          style={!canGoPrev && s.arrowOff}
        />
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
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
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
