import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClaySurface } from './clay';
import { SkeletonBlock } from './Skeleton';
import { CLAY } from '../theme/clay';
import { useInstructorHours } from '../hooks/queries/useInstructorHours';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** «46 h», «12,5 h»: mezz'ora di precisione, virgola italiana. */
const hoursText = (min: number) => `${String(Math.round((min / 60) * 2) / 2).replace('.', ',')} h`;

/**
 * Card del mese in testa a «Tu» (direzione «D · Mix», REG-639): il numero che
 * conta (ore guidate nel mese), quante guide, e il grafico delle settimane del
 * mese (bucket dell'endpoint ore: oltre 14 giorni sono settimane). La
 * settimana in corso è nera, le altre grigie. Tocco = «Ore di guida».
 */
export function MonthHoursCard({ instructorId, onPress }: { instructorId: string; onPress: () => void }) {
  const { from, to, month, todayKey, prevFrom, prevTo, prevMonth } = useMemo(() => {
    const now = new Date();
    // Il mese prima fino allo stesso giorno: il confronto è alla pari.
    const prevLast = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      month: MONTHS[now.getMonth()],
      todayKey: ymd(now),
      prevFrom: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      prevTo: ymd(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevLast))),
      prevMonth: MONTHS[(now.getMonth() + 11) % 12].toLowerCase(),
    };
  }, []);
  const { data, isLoading } = useInstructorHours(from, to, instructorId);
  const prev = useInstructorHours(prevFrom, prevTo, instructorId);
  const soFar = useInstructorHours(from, todayKey, instructorId);

  if (!isLoading && !data) return null;

  const buckets = data?.buckets ?? [];
  const max = Math.max(60, ...buckets.map((b) => b.totalMinutes));
  // Bucket in corso = l'ultimo iniziato entro oggi.
  const currentIdx = buckets.reduce((acc, b, i) => (b.startDate <= todayKey ? i : acc), -1);
  const count = data?.total.appointmentCount ?? 0;
  // Giro «memorabile»: una frase di confronto, solo se fa piacere leggerla
  // (mai «meno di…»). Si conta fino a oggi, contro lo stesso tratto del mese prima.
  const compare = (() => {
    if (!soFar.data || !prev.data) return null;
    const doneMin = soFar.data.total.totalMinutes;
    const diff = doneMin - prev.data.total.totalMinutes;
    if (diff >= 60) return `${hoursText(diff)} in più di ${prevMonth} a questo punto`;
    if (Math.abs(diff) < 60 && doneMin > 0) return `Come ${prevMonth} a questo punto`;
    return null;
  })();

  return (
    <ClaySurface onPress={onPress} radius={26} style={s.card} testID="more-month-hours" accessibilityLabel={`${month}, ore di guida`}>
      <Text style={s.month}>{month}</Text>
      {data ? (
        <View style={s.numRow}>
          <Text style={s.num}>{hoursText(data.total.totalMinutes)}</Text>
          <Text style={s.numSub}>
            guidate · {count} guid{count === 1 ? 'a' : 'e'}
          </Text>
        </View>
      ) : (
        <SkeletonBlock width={150} height={34} radius={10} style={s.sk} />
      )}
      {compare ? <Text style={s.compare}>{compare}</Text> : null}
      <View style={s.chart}>
        {(data ? buckets : Array.from({ length: 5 }, () => null)).map((b, i) => (
          <View key={b?.key ?? i} style={s.col}>
            <View style={s.track}>
              <View
                style={[
                  s.bar,
                  {
                    height: b ? `${Math.max(6, (b.totalMinutes / max) * 100)}%` : '30%',
                    backgroundColor: b && i === currentIdx ? CLAY.ink : 'rgba(17,17,17,0.10)',
                  },
                ]}
              />
            </View>
            <Text style={[s.lab, b && i === currentIdx && s.labOn]} numberOfLines={1}>
              {b?.label ?? ' '}
            </Text>
          </View>
        ))}
      </View>
    </ClaySurface>
  );
}

const s = StyleSheet.create({
  card: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
  month: { fontSize: 15, fontWeight: '600', color: CLAY.ink3 },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  num: { fontSize: 40, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.2 },
  numSub: { fontSize: 15, color: CLAY.ink3 },
  compare: { fontSize: 14, color: CLAY.ink2, marginTop: 2 },
  sk: { marginTop: 8 },
  chart: { flexDirection: 'row', gap: 6, marginTop: 14 },
  col: { flex: 1, alignItems: 'center' },
  track: { height: 48, justifyContent: 'flex-end' },
  bar: { width: 24, borderRadius: 7 },
  lab: { fontSize: 11, color: CLAY.ink4, textAlign: 'center', marginTop: 5 },
  labOn: { color: CLAY.ink, fontWeight: '600' },
});
