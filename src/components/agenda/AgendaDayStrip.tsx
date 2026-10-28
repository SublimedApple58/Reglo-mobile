import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CLAY, CLAY_CTA } from '../../theme/clay';

/**
 * Striscia dei giorni della vista Giorno (REG-639 clay, notte 28/10/2026):
 * 6 giorni (lun–sab) per pagina, si scorre a settimane. Il giorno scelto sta
 * in un cerchio nero clay (stesso volume della CTA primaria), oggi in nero
 * pieno, i giorni passati in grigio. Sotto ogni giorno il numero di impegni
 * in grigio piccolo (un numero, non un badge); niente se zero.
 */

const WEEK_SPAN = 26;
const DAY_NAMES = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

const mondayOf = (d: Date) => {
  const m = new Date(d);
  const dow = m.getDay();
  m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow));
  m.setHours(0, 0, 0, 0);
  return m;
};
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function AgendaDayStrip({
  selected,
  onSelect,
  counts,
  holidays,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  /** Impegni per giorno (YYYY-MM-DD). */
  counts: Record<string, number>;
  holidays?: Set<string>;
}) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const weeks = useMemo(() => Array.from({ length: WEEK_SPAN * 2 + 1 }, (_, i) => i - WEEK_SPAN), []);
  const weekIndexOf = useCallback(
    (d: Date) => WEEK_SPAN + Math.round((mondayOf(d).getTime() - thisMonday.getTime()) / (7 * 86400000)),
    [thisMonday],
  );
  const [page, setPage] = useState(() => weekIndexOf(selected));
  const todayKey = dateKeyOf(new Date());
  const selKey = dateKeyOf(selected);

  // La settimana segue il giorno scelto da fuori (es. «Oggi», tocco in Settimana).
  useEffect(() => {
    const idx = weekIndexOf(selected);
    if (idx !== page) {
      setPage(idx);
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx === page) return;
    setPage(idx);
    // Cambiando settimana resta lo stesso giorno della settimana.
    const dow = Math.max(0, Math.min(5, (selected.getDay() + 6) % 7));
    const monday = addDays(thisMonday, (idx - WEEK_SPAN) * 7);
    onSelect(addDays(monday, dow));
  };

  const renderWeek = ({ item }: { item: number }) => {
    const monday = addDays(thisMonday, item * 7);
    return (
      <View style={[s.week, { width }]}>
        {DAY_NAMES.map((name, i) => {
          const d = addDays(monday, i);
          const key = dateKeyOf(d);
          const isSel = key === selKey;
          const isToday = key === todayKey;
          const past = !isToday && d < new Date();
          const n = counts[key] ?? 0;
          return (
            <Pressable
              key={key}
              onPressIn={() => {
                if (isSel) return;
                Haptics.selectionAsync().catch(() => {});
                onSelect(d);
              }}
              style={s.day}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={`${name} ${d.getDate()}${n ? `, ${n} impegni` : ''}`}
              testID={`agenda-day-${key}`}
            >
              <Text style={[s.name, past && s.past, isToday && s.todayName]}>{name}</Text>
              <View style={[s.circle, isSel && s.circleSel, isSel && CLAY_CTA.primary]}>
                <Text style={[s.num, past && s.past, isToday && s.todayNum, isSel && s.numSel, holidays?.has(key) && !isSel && s.holiday]}>
                  {d.getDate()}
                </Text>
              </View>
              <Text style={[s.count, !n && s.countEmpty]}>{n || ' '}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={weeks}
      keyExtractor={(w) => String(w)}
      renderItem={renderWeek}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={page}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onMomentumScrollEnd={onMomentumEnd}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      style={s.list}
    />
  );
}

const s = StyleSheet.create({
  list: { flexGrow: 0 },
  week: { flexDirection: 'row', paddingHorizontal: 14 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  name: { fontSize: 13, fontWeight: '500', color: CLAY.ink3, marginBottom: 6 },
  todayName: { color: CLAY.ink, fontWeight: '600' },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  circleSel: { backgroundColor: '#1E1E1E' },
  num: { fontSize: 18, fontWeight: '500', color: CLAY.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  todayNum: { fontWeight: '600', textDecorationLine: 'underline' },
  numSel: { color: '#FFFFFF', fontWeight: '600', textDecorationLine: 'none' },
  past: { color: '#B4B4B4' },
  holiday: { color: '#B4B4B4', textDecorationLine: 'line-through' },
  count: { fontSize: 12, color: CLAY.ink3, marginTop: 5, fontVariant: ['tabular-nums'] },
  countEmpty: { opacity: 0 },
});
