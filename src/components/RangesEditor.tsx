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
          style={styles.row}
        >
          {/* Start time card */}
          <Pressable
            style={styles.timeCard}
            onPress={() => onPickTime(index, 'start')}
            disabled={disabled}
          >
            <Ionicons name="time-outline" size={16} color="#EC4899" />
            <Text style={styles.timeText}>{fmtMin(range.startMinutes)}</Text>
          </Pressable>

          <Text style={styles.separator}>–</Text>

          {/* End time card */}
          <Pressable
            style={styles.timeCard}
            onPress={() => onPickTime(index, 'end')}
            disabled={disabled}
          >
            <Ionicons name="time-outline" size={16} color="#EC4899" />
            <Text style={styles.timeText}>{fmtMin(range.endMinutes)}</Text>
          </Pressable>

          {/* Remove button */}
          {canRemove && (
            <Pressable
              onPress={() => handleRemove(index)}
              disabled={disabled}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          )}
        </Animated.View>
      ))}

      {/* Add range button */}
      <Pressable
        style={styles.addButton}
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
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  timeText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  separator: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CA8A04',
  },
});
