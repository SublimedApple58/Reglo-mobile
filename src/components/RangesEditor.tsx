import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export type TimeRange = { startMinutes: number; endMinutes: number };

export type RangesEditorProps = {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  onPickTime: (index: number, field: 'start' | 'end') => void;
  onAddRange: () => void;
  disabled?: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

export default function RangesEditor({ ranges, onChange, onPickTime, onAddRange, disabled = false }: RangesEditorProps) {
  const canRemove = ranges.length > 1;

  return (
    <View style={styles.container}>
      {ranges.map((range, index) => (
        <Animated.View key={index} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.row}>
          {/* Inizio */}
          <Pressable
            style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
            onPress={() => onPickTime(index, 'start')}
            disabled={disabled}
          >
            <Text style={styles.fieldLabel}>Inizio</Text>
            <Text style={styles.fieldValue}>{fmtMin(range.startMinutes)}</Text>
          </Pressable>

          <Ionicons name="arrow-forward" size={15} color="#C0C4CC" style={styles.arrow} />

          {/* Fine */}
          <Pressable
            style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
            onPress={() => onPickTime(index, 'end')}
            disabled={disabled}
          >
            <Text style={styles.fieldLabel}>Fine</Text>
            <Text style={styles.fieldValue}>{fmtMin(range.endMinutes)}</Text>
          </Pressable>

          {canRemove ? (
            <Pressable
              onPress={() => onChange(ranges.filter((_, i) => i !== index))}
              disabled={disabled}
              hitSlop={8}
              style={styles.removeBtn}
            >
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </Animated.View>
      ))}

      {/* Aggiungi fascia — filled light button (no dashed border) */}
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
        onPress={onAddRange}
        disabled={disabled}
      >
        <Ionicons name="add" size={18} color="#1A1A2E" />
        <Text style={styles.addText}>Aggiungi fascia</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  field: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldPressed: { transform: [{ scale: 0.98 }], shadowOpacity: 0.05 },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#9AA1AC', letterSpacing: 0.4, textTransform: 'uppercase' },
  fieldValue: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },

  arrow: { width: 16, textAlign: 'center' },

  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EAEDF1',
    borderWidth: 1,
    borderColor: '#DBDFE5',
  },
  addText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
});
