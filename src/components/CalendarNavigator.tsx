import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SelectableChip } from './SelectableChip';
import { colors, spacing, typography } from '../theme';

export type CalendarNavigatorMode = 'day' | 'week' | 'month';

export type CalendarNavigatorRange = {
  mode: CalendarNavigatorMode;
  from: Date;
  to: Date;
  label: string;
  anchor: Date;
};

type CalendarNavigatorProps = {
  initialMode?: CalendarNavigatorMode;
  initialDate?: Date;
  onChange: (range: CalendarNavigatorRange) => void;
  style?: ViewStyle;
};

const modeLabels: Array<{ value: CalendarNavigatorMode; label: string }> = [
  { value: 'day', label: 'Giorno' },
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
];

const toDayStart = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const toDayEnd = (value: Date) => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toWeekStart = (value: Date) => {
  const next = toDayStart(value);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
};

const toWeekEnd = (value: Date) => {
  const start = toWeekStart(value);
  const next = new Date(start);
  next.setDate(start.getDate() + 6);
  return toDayEnd(next);
};

const toMonthStart = (value: Date) => {
  const next = new Date(value);
  next.setDate(1);
  return toDayStart(next);
};

const toMonthEnd = (value: Date) => {
  const next = new Date(value);
  next.setMonth(next.getMonth() + 1, 0);
  return toDayEnd(next);
};

const formatShort = (value: Date) =>
  value.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatLabel = (mode: CalendarNavigatorMode, anchor: Date, from: Date, to: Date) => {
  if (mode === 'day') {
    return anchor.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }
  if (mode === 'week') {
    return `${formatShort(from)} - ${formatShort(to)}`;
  }
  return anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

const stepAnchor = (mode: CalendarNavigatorMode, anchor: Date, direction: -1 | 1) => {
  const next = new Date(anchor);
  if (mode === 'day') {
    next.setDate(anchor.getDate() + direction);
  } else if (mode === 'week') {
    next.setDate(anchor.getDate() + 7 * direction);
  } else {
    next.setMonth(anchor.getMonth() + direction, 1);
  }
  return next;
};

export const CalendarNavigator = ({
  initialMode = 'week',
  initialDate,
  onChange,
  style,
}: CalendarNavigatorProps) => {
  const [mode, setMode] = useState<CalendarNavigatorMode>(initialMode);
  const [anchor, setAnchor] = useState<Date>(initialDate ?? new Date());

  const range = useMemo<CalendarNavigatorRange>(() => {
    const safeAnchor = new Date(anchor);
    const from =
      mode === 'day'
        ? toDayStart(safeAnchor)
        : mode === 'week'
          ? toWeekStart(safeAnchor)
          : toMonthStart(safeAnchor);
    const to =
      mode === 'day'
        ? toDayEnd(safeAnchor)
        : mode === 'week'
          ? toWeekEnd(safeAnchor)
          : toMonthEnd(safeAnchor);
    return {
      mode,
      anchor: safeAnchor,
      from,
      to,
      label: formatLabel(mode, safeAnchor, from, to),
    };
  }, [anchor, mode]);

  const isTodaySelected = useMemo(() => {
    const today = new Date();
    return mode === 'day' && isSameDay(today, range.anchor);
  }, [mode, range.anchor]);

  useEffect(() => {
    onChange(range);
  }, [onChange, range]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setAnchor((current) => stepAnchor(mode, current, -1))}
          style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
        >
          <Text style={styles.arrowLabel}>‹</Text>
        </Pressable>
        <Text style={styles.rangeLabel}>{range.label}</Text>
        <Pressable
          onPress={() => setAnchor((current) => stepAnchor(mode, current, 1))}
          style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
        >
          <Text style={styles.arrowLabel}>›</Text>
        </Pressable>
      </View>
      <View style={styles.modeRow}>
        {modeLabels.map((item) => (
          <SelectableChip
            key={item.value}
            label={item.label}
            active={mode === item.value}
            onPress={() => setMode(item.value)}
          />
        ))}
        <SelectableChip
          label="Oggi"
          active={isTodaySelected}
          onPress={() => {
            setMode('day');
            setAnchor(new Date());
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  arrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonPressed: {
    opacity: 0.72,
  },
  arrowLabel: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
  rangeLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
