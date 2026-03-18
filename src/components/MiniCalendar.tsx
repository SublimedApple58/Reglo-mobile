import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { colors, spacing, radii } from '../theme';

// ---------------------------------------------------------------------------
// Enable LayoutAnimation on Android
// ---------------------------------------------------------------------------
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MiniCalendarProps = {
  selectedDate: string | null; // YYYY-MM-DD or null
  onSelectDate: (date: string) => void; // YYYY-MM-DD
  markedDates?: Set<string>; // dates with a dot indicator (overrides exist)
  maxWeeks?: number; // default 12
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ITALIAN_MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
] as const;

const WEEKDAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

const CELL_SIZE = 40;

const pad = (n: number) => n.toString().padStart(2, '0');

const toDateString = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a Date for the 1st of the month containing `date`, at midnight local. */
const firstOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

/** Return the Monday on or before `date`. */
const mondayBefore = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// ---------------------------------------------------------------------------
// Fade wrapper for month transitions
// ---------------------------------------------------------------------------
const FadeView: React.FC<{ trigger: number; children: React.ReactNode }> = ({
  trigger,
  children,
}) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const prevTrigger = useRef(trigger);

  if (prevTrigger.current !== trigger) {
    prevTrigger.current = trigger;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  selectedDate,
  onSelectDate,
  markedDates,
  maxWeeks = 12,
}) => {
  // ── Today (stable reference) ──────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ── Parse selectedDate string into a Date ────────────────
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedDate]);

  // ── Month navigation state ───────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() =>
    firstOfMonth(selectedDateObj ?? today),
  );

  // ── Max date boundary ────────────────────────────────────
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxWeeks * 7);
    return d;
  }, [today, maxWeeks]);

  const minMonth = useMemo(() => firstOfMonth(today), [today]);
  const maxMonth = useMemo(() => firstOfMonth(maxDate), [maxDate]);

  const canGoPrev = currentMonth.getTime() > minMonth.getTime();
  const canGoNext = currentMonth.getTime() < maxMonth.getTime();

  const goPrev = () => {
    if (!canGoPrev) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const goNext = () => {
    if (!canGoNext) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  // ── Build 6x7 grid cells ─────────────────────────────────
  const gridCells = useMemo(() => {
    const first = firstOfMonth(currentMonth);
    const startMonday = mondayBefore(first);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      cells.push(d);
    }
    return cells;
  }, [currentMonth]);

  const monthLabel = `${ITALIAN_MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // Unique numeric key for fade transitions
  const monthKey = currentMonth.getFullYear() * 12 + currentMonth.getMonth();

  // ── Handlers ──────────────────────────────────────────────
  const handleDayPress = (date: Date) => {
    const ds = toDateString(date.getFullYear(), date.getMonth(), date.getDate());
    onSelectDate(ds);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable
          onPress={goPrev}
          disabled={!canGoPrev}
          style={[styles.monthArrow, !canGoPrev && styles.monthArrowDisabled]}
          hitSlop={8}
        >
          <Text
            style={[
              styles.monthArrowText,
              !canGoPrev && styles.monthArrowTextDisabled,
            ]}
          >
            {'\u2039'}
          </Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          onPress={goNext}
          disabled={!canGoNext}
          style={[styles.monthArrow, !canGoNext && styles.monthArrowDisabled]}
          hitSlop={8}
        >
          <Text
            style={[
              styles.monthArrowText,
              !canGoNext && styles.monthArrowTextDisabled,
            ]}
          >
            {'\u203A'}
          </Text>
        </Pressable>
      </View>

      {/* Weekday header */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={`wd-${i}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid with fade on month change */}
      <FadeView trigger={monthKey}>
        <View style={styles.grid}>
          {gridCells.map((date, idx) => {
            const inMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected =
              selectedDateObj != null && isSameDay(date, selectedDateObj);
            const inRange = date >= today && date <= maxDate;
            const tappable = inRange;
            const dateStr = toDateString(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
            );
            const isMarked = markedDates?.has(dateStr) ?? false;

            // ── Determine styles ──────────────────────────
            let cellStyle: object = styles.dayCell;
            let textStyle: object = styles.dayText;

            if (!inMonth) {
              // Other month
              textStyle = styles.dayTextOtherMonth;
            } else if (isSelected && isToday) {
              // Selected + today: pink bg wins, yellow border on top
              cellStyle = styles.dayCellSelectedToday;
              textStyle = styles.dayTextSelected;
            } else if (isSelected) {
              cellStyle = styles.dayCellSelected;
              textStyle = styles.dayTextSelected;
            } else if (isToday) {
              cellStyle = styles.dayCellToday;
              textStyle = styles.dayTextToday;
            } else if (!inRange && inMonth) {
              // Past or beyond max range
              textStyle = styles.dayTextMuted;
            }

            return (
              <Pressable
                key={`mc-${idx}`}
                onPress={tappable ? () => handleDayPress(date) : undefined}
                disabled={!tappable}
                style={styles.dayCellWrapper}
              >
                <View style={cellStyle}>
                  <Text style={textStyle}>{date.getDate()}</Text>
                  {isMarked && inMonth && (
                    <View style={styles.markedDot} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </FadeView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    // Inline component — no background, let parent decide
  },
  // ── Month nav ─────────────────────────────────────────────
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  monthArrowDisabled: {
    opacity: 0.35,
  },
  monthArrowText: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  monthArrowTextDisabled: {
    color: colors.textMuted,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // ── Weekday row ───────────────────────────────────────────
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // ── Grid ──────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: '14.2857%' as any,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellToday: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  dayCellSelected: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EC4899',
  },
  dayCellSelectedToday: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EC4899',
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  // ── Day text ──────────────────────────────────────────────
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextToday: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayTextSelected: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayTextMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  dayTextOtherMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  // ── Marked dot ────────────────────────────────────────────
  markedDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EC4899',
  },
});
