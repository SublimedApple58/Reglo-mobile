import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../theme';

export type TimeRange = { startMinutes: number; endMinutes: number };

export type RangesEditorProps = {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  onPickTime: (index: number, field: 'start' | 'end') => void;
  disabled?: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const DEFAULT_RANGE: TimeRange = { startMinutes: 540, endMinutes: 1080 };

export default function RangesEditor({ ranges, onChange, onPickTime, disabled = false }: RangesEditorProps) {
  const canRemove = ranges.length > 1;

  return (
    <View style={styles.container}>
      {ranges.map((range, index) => (
        <Animated.View key={index} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.row}>
          {/* Clock icon */}
          <Ionicons name="time-outline" size={18} color="#EC4899" style={styles.clockIcon} />

          {/* Start time — tappable */}
          <Pressable onPress={() => onPickTime(index, 'start')} disabled={disabled} hitSlop={4}>
            <Text style={styles.timeText}>{fmtMin(range.startMinutes)}</Text>
          </Pressable>

          <Text style={styles.dash}> – </Text>

          {/* End time — tappable */}
          <Pressable onPress={() => onPickTime(index, 'end')} disabled={disabled} hitSlop={4}>
            <Text style={styles.timeText}>{fmtMin(range.endMinutes)}</Text>
          </Pressable>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Trash */}
          {canRemove ? (
            <Pressable onPress={() => onChange(ranges.filter((_, i) => i !== index))} disabled={disabled} hitSlop={10}>
              <Ionicons name="trash-outline" size={17} color="#CBD5E1" />
            </Pressable>
          ) : null}
        </Animated.View>
      ))}

      {/* Add range */}
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
        onPress={() => onChange([...ranges, { ...DEFAULT_RANGE }])}
        disabled={disabled}
      >
        <Ionicons name="add-circle-outline" size={18} color="#CA8A04" />
        <Text style={styles.addText}>Aggiungi fascia</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  clockIcon: { marginRight: 10 },
  timeText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  dash: { fontSize: 15, color: '#94A3B8' },
  spacer: { flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  addText: { fontSize: 13, fontWeight: '600', color: '#CA8A04' },
});
