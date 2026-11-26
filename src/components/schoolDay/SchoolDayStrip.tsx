import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from '../../utils/haptics';
import { CLAY } from '../../theme/clay';
import { fmtLongDay } from '../agenda/ghost';
import { mondayOf, toDateKey } from './schoolDayModel';

/**
 * Striscia della settimana del giorno della scuola (REG-794, anteprima A):
 * in alto il giorno a parole e, a destra, quante guide o «Oggi» per tornarci;
 * sotto lun–sab, il giorno scelto nel cerchio nero. Si scorre di settimana in
 * settimana col dito; il tocco su un giorno lo apre (nessuna chiamata: i dati
 * della finestra sono già in memoria).
 */

const WEEK_SPAN = 26;
const DAY_LETTERS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const H_PAD = 20;

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const WeekCells = React.memo(function WeekCells({
  monday,
  width,
  selectedKey,
  todayKey,
  holidays,
  onSelect,
}: {
  monday: Date;
  width: number;
  selectedKey: string;
  todayKey: string;
  holidays: Set<string>;
  onSelect: (d: Date) => void;
}) {
  return (
    <View style={[s.week, { width }]}>
      {DAY_LETTERS.map((letter, i) => {
        const day = addDays(monday, i);
        const key = toDateKey(day);
        const on = key === selectedKey;
        const past = key < todayKey;
        const holiday = holidays.has(key);
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(day)}
            style={s.cell}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={fmtLongDay(day)}
            testID={`school-day-${key}`}
          >
            <Text style={[s.letter, past && s.dim, holiday && s.holiday]}>{letter}</Text>
            <View style={[s.num, on && s.numOn]}>
              <Text style={[s.numTx, past && !on && s.dim, holiday && !on && s.holiday, on && s.numTxOn]}>
                {day.getDate()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});

export function SchoolDayStrip({
  date,
  width,
  holidays,
  countLabel,
  onSelect,
}: {
  date: Date;
  /** Larghezza della schermata. */
  width: number;
  holidays: Set<string>;
  /** «46 guide» del giorno scelto (a destra quando il giorno è oggi). */
  countLabel: string;
  onSelect: (d: Date) => void;
}) {
  const pageW = width - H_PAD * 2;
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const base = useRef(mondayOf(date)).current;
  const pages = useMemo(
    () => Array.from({ length: WEEK_SPAN * 2 + 1 }, (_, i) => addDays(base, (i - WEEK_SPAN) * 7)),
    [base],
  );
  const listRef = useRef<FlatList<Date>>(null);
  const indexRef = useRef(WEEK_SPAN);
  const [, setIndex] = useState(WEEK_SPAN);

  // Giorno cambiato da fuori («Oggi», ritorno dalla settimana): la striscia lo segue.
  const weekIndex = Math.round((mondayOf(date).getTime() - base.getTime()) / (7 * 86400000)) + WEEK_SPAN;
  useEffect(() => {
    if (weekIndex === indexRef.current || weekIndex < 0 || weekIndex >= pages.length) return;
    indexRef.current = weekIndex;
    setIndex(weekIndex);
    listRef.current?.scrollToIndex({ index: weekIndex, animated: true });
  }, [weekIndex, pages.length]);

  const select = useCallback((d: Date) => {
    Haptics.selectionAsync();
    onSelect(d);
  }, [onSelect]);

  // Scorrendo di settimana il giorno scelto resta lo stesso giorno della settimana.
  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i === indexRef.current || i < 0 || i >= pages.length) return;
    const delta = i - indexRef.current;
    indexRef.current = i;
    setIndex(i);
    onSelect(addDays(date, delta * 7));
  }, [pageW, pages.length, onSelect, date]);

  const selectedKey = toDateKey(date);
  const renderItem = useCallback(({ item }: { item: Date }) => (
    <WeekCells monday={item} width={pageW} selectedKey={selectedKey} todayKey={todayKey} holidays={holidays} onSelect={select} />
  ), [pageW, selectedKey, todayKey, holidays, select]);

  const isToday = sameDay(date, today);
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.day} numberOfLines={1}>{fmtLongDay(date)}</Text>
        {isToday ? (
          <Text style={s.count} numberOfLines={1}>{countLabel}</Text>
        ) : (
          <Pressable
            onPress={() => select(new Date())}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.55 }}
            accessibilityRole="button"
            testID="school-day-today"
          >
            <Text style={s.todayLink}>Oggi</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(d) => String(d.getTime())}
        renderItem={renderItem}
        extraData={selectedKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={WEEK_SPAN}
        getItemLayout={(_, i) => ({ length: pageW, offset: pageW * i, index: i })}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollToIndexFailed={() => { /* getItemLayout makes this unreachable */ }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        decelerationRate="fast"
        style={{ width: pageW, alignSelf: 'center' }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: H_PAD,
    marginTop: 14,
    marginBottom: 8,
  },
  day: { flexShrink: 1, fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4 },
  count: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  todayLink: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { width: 44, alignItems: 'center' },
  letter: { fontSize: 12.5, fontWeight: '500', color: CLAY.ink3, marginBottom: 4 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numOn: {
    backgroundColor: CLAY.ink,
    boxShadow: [{ offsetX: 0, offsetY: 3, blurRadius: 8, spreadDistance: 0, color: 'rgba(17,17,17,0.2)' }],
  },
  numTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  numTxOn: { color: '#FFFFFF' },
  dim: { color: '#B5B5B5' },
  holiday: { color: '#B4B4B4', textDecorationLine: 'line-through' },
});
