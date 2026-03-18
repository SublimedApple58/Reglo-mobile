import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export type TimeRange = { startMinutes: number; endMinutes: number };

export type RangesEditorProps = {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  /** Called when user taps "Aggiungi fascia" — parent should add a default range and open the start time picker for it */
  onAddRange: () => void;
  disabled?: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

export default function RangesEditor({ ranges, onChange, onAddRange, disabled = false }: RangesEditorProps) {
  const canRemove = ranges.length > 1;

  return (
    <View style={styles.container}>
      {ranges.map((range, index) => (
        <Animated.View key={index} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.row}>
          {/* Pink circle clock icon */}
          <View style={styles.clockCircle}>
            <Ionicons name="time" size={18} color="#EC4899" />
          </View>

          {/* Time range text — read-only */}
          <Text style={styles.timeText}>{fmtMin(range.startMinutes)}</Text>
          <Text style={styles.dash}> – </Text>
          <Text style={styles.timeText}>{fmtMin(range.endMinutes)}</Text>

          <View style={{ flex: 1 }} />

          {/* Trash */}
          {canRemove ? (
            <Pressable onPress={() => onChange(ranges.filter((_, i) => i !== index))} disabled={disabled} hitSlop={10} style={styles.trashBtn}>
              <Ionicons name="trash-outline" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </Animated.View>
      ))}

      {/* Add range — dashed border pill */}
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
        onPress={onAddRange}
        disabled={disabled}
      >
        <Ionicons name="add-circle" size={18} color="#64748B" />
        <Text style={styles.addText}>Aggiungi fascia</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clockCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  dash: {
    fontSize: 15,
    color: '#94A3B8',
  },
  trashBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  addText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
});
