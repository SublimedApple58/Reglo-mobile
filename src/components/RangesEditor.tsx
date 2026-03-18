import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../theme';

// ─── Types ──────────────────────────────────────────────────
export type TimeRange = { startMinutes: number; endMinutes: number };

export type RangesEditorProps = {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  onPickTime: (index: number, field: 'start' | 'end') => void;
  disabled?: boolean;
};

// ─── Helpers ────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

const DEFAULT_RANGE: TimeRange = { startMinutes: 540, endMinutes: 1080 };

// ─── Component ──────────────────────────────────────────────
export default function RangesEditor({
  ranges,
  onChange,
  onPickTime,
  disabled = false,
}: RangesEditorProps) {
  const canRemove = ranges.length > 1;

  const handleAdd = () => {
    onChange([...ranges, { ...DEFAULT_RANGE }]);
  };

  const handleRemove = (index: number) => {
    onChange(ranges.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {ranges.map((range, index) => (
        <Animated.View
          key={index}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.rangeRow}
        >
          {/* Start time card */}
          <Pressable
            style={({ pressed }) => [styles.timeCard, pressed && styles.timeCardPressed]}
            onPress={() => onPickTime(index, 'start')}
            disabled={disabled}
          >
            <Text style={styles.timeLabel}>INIZIO</Text>
            <View style={styles.timeValueRow}>
              <Ionicons name="time-outline" size={16} color="#EC4899" />
              <Text style={styles.timeValue}>{fmtMin(range.startMinutes)}</Text>
            </View>
          </Pressable>

          {/* End time card */}
          <Pressable
            style={({ pressed }) => [styles.timeCard, pressed && styles.timeCardPressed]}
            onPress={() => onPickTime(index, 'end')}
            disabled={disabled}
          >
            <Text style={styles.timeLabel}>FINE</Text>
            <View style={styles.timeValueRow}>
              <Ionicons name="time-outline" size={16} color="#EC4899" />
              <Text style={styles.timeValue}>{fmtMin(range.endMinutes)}</Text>
            </View>
          </Pressable>

          {/* Remove button */}
          {canRemove ? (
            <Pressable
              onPress={() => handleRemove(index)}
              disabled={disabled}
              hitSlop={10}
              style={styles.trashBtn}
            >
              <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
            </Pressable>
          ) : (
            <View style={styles.trashPlaceholder} />
          )}
        </Animated.View>
      ))}

      {/* Add range button */}
      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
        onPress={handleAdd}
        disabled={disabled}
      >
        <Ionicons name="add-circle-outline" size={18} color="#CA8A04" />
        <Text style={styles.addText}>Aggiungi fascia</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  timeCardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.98 }],
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  trashBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashPlaceholder: {
    width: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CA8A04',
  },
});
