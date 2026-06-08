import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Airbnb-style continuous calendar: months stacked vertically, scrolled by the
// parent ScrollView (no internal scroll → no nested-scroll conflict). One weekday
// header at the top, then each month renders its own days with a leading offset.

export type ScrollableMonthsCalendarProps = {
  selectedDate: string | null; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  markedDates?: Set<string>;
  monthsCount?: number; // how many months ahead to render (default 12)
  monthsBack?: number; // how many months before the current one to render (default 0)
  allowPast?: boolean; // when true, past days are selectable + not greyed (agenda use)
  hideWeekHeader?: boolean; // when the parent renders a fixed weekday header
};

export const CALENDAR_WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const;
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const ScrollableMonthsCalendar: React.FC<ScrollableMonthsCalendarProps> = ({
  selectedDate,
  onSelectDate,
  markedDates,
  monthsCount = 12,
  monthsBack = 0,
  allowPast = false,
  hideWeekHeader = false,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const months = useMemo(
    () =>
      Array.from(
        { length: monthsBack + monthsCount },
        (_, i) => new Date(today.getFullYear(), today.getMonth() - monthsBack + i, 1),
      ),
    [today, monthsCount, monthsBack],
  );

  return (
    <View>
      {!hideWeekHeader && (
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={`wd-${i}`} style={styles.weekLabel}>{w}</Text>
          ))}
        </View>
      )}

      {months.map((monthDate) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
        const offset = firstDow === 0 ? 6 : firstDow - 1; // Monday-start leading blanks
        const cells: (number | null)[] = [
          ...Array.from({ length: offset }, () => null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];

        return (
          <View key={`${year}-${month}`} style={styles.month}>
            <Text style={styles.monthLabel}>{ITALIAN_MONTHS[month]} {year}</Text>
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (day == null) return <View key={`b-${idx}`} style={styles.cell} />;
                const date = new Date(year, month, day);
                date.setHours(0, 0, 0, 0);
                const past = date.getTime() < today.getTime();
                const disabled = past && !allowPast;
                const isToday = date.getTime() === today.getTime();
                const ds = toDateString(year, month, day);
                const selected = selectedDate === ds;
                const marked = (markedDates?.has(ds) ?? false) && !selected;
                return (
                  <Pressable
                    key={`d-${idx}`}
                    style={styles.cell}
                    disabled={disabled}
                    onPress={() => onSelectDate(ds)}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        selected && styles.dayCircleSelected,
                        !selected && isToday && styles.dayCircleToday,
                      ]}
                    >
                      <Text style={[styles.dayText, disabled && styles.dayTextPast, selected && styles.dayTextSelected]}>
                        {day}
                      </Text>
                    </View>
                    {marked && <View style={styles.dot} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const CELL = 44;
const CIRCLE = 40;

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', paddingBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9AA1AC' },

  month: { marginTop: 14 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: '#3A3A3C', letterSpacing: -0.2, marginBottom: 6, marginLeft: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%' as unknown as number, height: CELL, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: '#1A1A2E' },
  dayCircleToday: { borderWidth: 1.5, borderColor: '#1A1A2E' },
  dayText: { fontSize: 15, fontWeight: '400', color: '#4B4B4D' },
  dayTextPast: { color: '#D4D7DC', fontWeight: '400' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  dot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#9AA1AC' },
});
