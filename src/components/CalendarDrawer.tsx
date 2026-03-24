import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../theme';

type CalendarDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
  maxWeeks?: number;
  caption?: string | null;
  bookedDates?: Set<string>;
};

const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const;

const ITALIAN_WEEKDAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;

/** Return a Date for the 1st of the month containing `date`, at midnight local. */
const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

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

export const CalendarDrawer = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  maxWeeks = 4,
  caption = 'Scegli un giorno e prenota la tua guida!',
  bookedDates,
}: CalendarDrawerProps) => {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;

  const [mounted, setMounted] = useState(visible);
  const [dismissEnabled, setDismissEnabled] = useState(false);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const lastDrag = useRef(0);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentMonth, setCurrentMonth] = useState(() => firstOfMonth(selectedDate));

  // Reset currentMonth when drawer opens with a new selectedDate
  useEffect(() => {
    if (visible) {
      setCurrentMonth(firstOfMonth(selectedDate));
    }
  }, [visible, selectedDate]);

  // Max date boundary
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxWeeks * 7);
    return d;
  }, [today, maxWeeks]);

  // Min month = month of today, max month = month of maxDate
  const minMonth = useMemo(() => firstOfMonth(today), [today]);
  const maxMonth = useMemo(() => firstOfMonth(maxDate), [maxDate]);

  const canGoPrev = currentMonth.getTime() > minMonth.getTime();
  const canGoNext = currentMonth.getTime() < maxMonth.getTime();

  const goPrev = () => {
    if (!canGoPrev) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goNext = () => {
    if (!canGoNext) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Build 6x7 = 42 cells grid
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

  // ─── Animation ───────────────────────────────────────────
  const resetDrag = () => {
    dragY.setValue(0);
    lastDrag.current = 0;
  };

  const triggerClose = useCallback(
    (fromDrag = false) => {
      if (fromDrag) {
        const baseOffset = Math.max(0, lastDrag.current);
        translateY.setValue(baseOffset);
        dragY.setValue(0);
      }
      onClose();
    },
    [onClose, translateY, dragY],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setDismissEnabled(false);
      resetDrag();
      translateY.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
        }),
      ]).start(() => setDismissEnabled(true));
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      resetDrag();
      translateY.setValue(screenHeight);
    });
  }, [visible, mounted, screenHeight, backdropOpacity, translateY]);

  const animatedTranslate = useMemo(
    () => Animated.add(translateY, dragY),
    [translateY, dragY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderMove: (_, gesture) => {
          const drag = gesture.dy < 0 ? gesture.dy * 0.2 : gesture.dy;
          const clamped = Math.max(-8, drag);
          lastDrag.current = clamped;
          dragY.setValue(clamped);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dy > 120 || gesture.vy > 0.9;
          if (shouldClose) {
            triggerClose(true);
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              stiffness: 220,
              damping: 18,
            }).start();
          }
        },
      }),
    [dragY, triggerClose],
  );

  const handleDayPress = (date: Date) => {
    onSelectDate(date);
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={() => triggerClose(false)}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => triggerClose(false)}
          disabled={!dismissEnabled}
        />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            { transform: [{ translateY: animatedTranslate }] },
          ]}
        >
          {/* Drag handle zone */}
          <View style={styles.dragZone} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Seleziona data</Text>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <Pressable
              onPress={goPrev}
              disabled={!canGoPrev}
              style={[styles.monthArrow, !canGoPrev && styles.monthArrowDisabled]}
            >
              <Text style={[styles.monthArrowText, !canGoPrev && styles.monthArrowTextDisabled]}>{'\u2039'}</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={goNext}
              disabled={!canGoNext}
              style={[styles.monthArrow, !canGoNext && styles.monthArrowDisabled]}
            >
              <Text style={[styles.monthArrowText, !canGoNext && styles.monthArrowTextDisabled]}>{'\u203A'}</Text>
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {ITALIAN_WEEKDAYS.map((wd) => (
              <View key={wd} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{wd}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {gridCells.map((date, idx) => {
              const inMonth = isSameMonth(date, currentMonth);
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate) && !isToday;
              const inRange = date >= today && date <= maxDate;
              const tappable = inMonth && inRange;
              const hasBooking = inMonth && bookedDates?.has(
                `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
              );

              let cellStyle: ViewStyle = styles.dayCell;
              let textStyle: TextStyle = styles.dayText;

              if (!inMonth) {
                textStyle = styles.dayTextOtherMonth;
              } else if (isToday) {
                cellStyle = styles.dayCellToday;
                textStyle = styles.dayTextToday;
              } else if (isSelected) {
                cellStyle = styles.dayCellSelected;
                textStyle = styles.dayTextSelected;
              } else if (!inRange) {
                textStyle = styles.dayTextUnavailable;
              }

              return (
                <Pressable
                  key={`cal-${idx}`}
                  onPress={tappable ? () => handleDayPress(date) : undefined}
                  disabled={!tappable}
                  style={styles.dayCellWrapper}
                >
                  <View style={cellStyle}>
                    <Text style={textStyle}>{date.getDate()}</Text>
                  </View>
                  {hasBooking ? (
                    <View
                      style={[
                        styles.dayDot,
                        (isSelected || isToday) && styles.dayDotHighlight,
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Duck mascot */}
          <View style={styles.mascotSection}>
            <Image
              source={require('../../assets/duck-calendar.png')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
            {caption ? (
              <Text style={styles.mascotText}>{caption}</Text>
            ) : null}
            <Text style={styles.mascotHint}>
              Puoi navigare fino a {maxWeeks} settimane
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 6,
  },
  dragZone: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  monthArrowDisabled: {
    opacity: 0.35,
  },
  monthArrowText: {
    fontSize: 22,
    color: '#1E293B',
    lineHeight: 26,
  },
  monthArrowTextDisabled: {
    color: '#94A3B8',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
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
    color: '#94A3B8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: '14.2857%',
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
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayTextToday: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  dayTextSelected: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayTextUnavailable: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  dayTextOtherMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC4899',
    marginTop: 2,
  },
  dayDotHighlight: {
    backgroundColor: '#FACC15',
  },
  mascotSection: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 4,
  },
  mascotImage: {
    width: 120,
    height: 85,
    marginBottom: 4,
  },
  mascotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  mascotHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
