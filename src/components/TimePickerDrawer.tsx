import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { radii, spacing } from '../theme';

type TimePickerDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onSelectTime: (date: Date) => void;
  selectedTime: Date;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const ITEM_HEIGHT = 48;
const COLUMN_HEIGHT = 250;

const padTwo = (n: number) => String(n).padStart(2, '0');

export const TimePickerDrawer = ({
  visible,
  onClose,
  onClosed,
  onSelectTime,
  selectedTime,
}: TimePickerDrawerProps) => {
  const [hour, setHour] = useState(() => selectedTime.getHours());
  const [minute, setMinute] = useState(() => {
    const m = selectedTime.getMinutes();
    const closest = MINUTES.reduce((prev, curr) =>
      Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev,
    );
    return closest;
  });

  const hourScrollRef = useRef<ScrollView | null>(null);
  const minuteScrollRef = useRef<ScrollView | null>(null);

  // Sync internal state when selectedTime changes or drawer opens
  useEffect(() => {
    if (visible) {
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const closestMinute = MINUTES.reduce((prev, curr) =>
        Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev,
      );
      setHour(h);
      setMinute(closestMinute);

      // Auto-scroll to selected values on mount
      setTimeout(() => {
        const hourIndex = HOURS.indexOf(h);
        const minuteIndex = MINUTES.indexOf(closestMinute);
        hourScrollRef.current?.scrollTo({
          y: Math.max(0, hourIndex * ITEM_HEIGHT - COLUMN_HEIGHT / 2 + ITEM_HEIGHT / 2),
          animated: false,
        });
        minuteScrollRef.current?.scrollTo({
          y: Math.max(0, minuteIndex * ITEM_HEIGHT - COLUMN_HEIGHT / 2 + ITEM_HEIGHT / 2),
          animated: false,
        });
      }, 100);
    }
  }, [visible, selectedTime]);

  const handleClose = () => {
    const result = new Date(selectedTime);
    result.setHours(hour, minute, 0, 0);
    onSelectTime(result);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      onClosed={onClosed}
      title="Seleziona orario"
      showHandle
      footer={
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [styles.confirmCta, pressed && styles.confirmCtaPressed]}
        >
          <Text style={styles.confirmCtaText}>Conferma {padTwo(hour)}:{padTwo(minute)}</Text>
        </Pressable>
      }
    >
      <View style={styles.columnsRow}>
        {/* Hours column */}
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Ore</Text>
          <View style={styles.scrollContainer}>
            <ScrollView
              ref={hourScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {HOURS.map((h) => {
                const isSelected = h === hour;
                return (
                  <Pressable
                    key={`hour-${h}`}
                    onPress={() => setHour(h)}
                    style={[styles.item, isSelected && styles.itemSelected]}
                  >
                    <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                      {padTwo(h)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Minutes column */}
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Minuti</Text>
          <View style={styles.scrollContainer}>
            <ScrollView
              ref={minuteScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {MINUTES.map((m) => {
                const isSelected = m === minute;
                return (
                  <Pressable
                    key={`minute-${m}`}
                    onPress={() => setMinute(m)}
                    style={[styles.item, isSelected && styles.itemSelected]}
                  >
                    <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                      {padTwo(m)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Duck mascot */}
      <View style={styles.mascotSection}>
        <Image
          source={require('../../assets/duck-clock.png')}
          style={styles.mascotImage}
          resizeMode="contain"
        />
        <Text style={styles.mascotText}>Scegli l'ora della guida</Text>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  scrollContainer: {
    height: COLUMN_HEIGHT,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  item: {
    height: ITEM_HEIGHT,
    width: '80%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSelected: {
    backgroundColor: '#FACC15',
  },
  itemText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748B',
  },
  itemTextSelected: {
    fontWeight: '700',
    color: '#92400E',
  },
  mascotSection: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: 4,
  },
  mascotImage: {
    width: 100,
    height: 73,
    marginBottom: 4,
  },
  mascotText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  confirmCta: {
    backgroundColor: '#EC4899',
    borderRadius: radii.sm,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  confirmCtaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  confirmCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
