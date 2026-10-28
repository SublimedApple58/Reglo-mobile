import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ClayButton, ClayList } from './clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { SOFT_LAYOUT, SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../utils/motion';

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

/**
 * Fasce orarie — REG-639 clay: una `ClayList` con una riga per fascia
 * («Fascia 1», inizio – fine come due orari incavati premibili, X per
 * toglierla) e «Aggiungi fascia» come CTA secondaria compatta sotto.
 * Usato da Disponibilità istruttore (fogli publish-day, availability-exception)
 * e da OwnerInstructorScreen / InstructorManageScreen.
 */
export default function RangesEditor({ ranges, onChange, onPickTime, onAddRange, disabled = false }: RangesEditorProps) {
  const canRemove = ranges.length > 1;

  return (
    <Animated.View layout={SOFT_LAYOUT} style={styles.container}>
      <ClayList>
        {ranges.map((range, index) => (
          <RangeRow
            key={index}
            index={index}
            range={range}
            disabled={disabled}
            onPickTime={onPickTime}
            onRemove={canRemove ? () => onChange(ranges.filter((_, i) => i !== index)) : undefined}
          />
        ))}
      </ClayList>

      <ClayButton title="Aggiungi fascia" variant="secondary" compact onPress={onAddRange} disabled={disabled} />
    </Animated.View>
  );
}

/** Una fascia. `divider` lo imposta `ClayList` (linea sottile sopra, non sulla prima). */
function RangeRow({
  index,
  range,
  disabled,
  onPickTime,
  onRemove,
  divider,
}: {
  index: number;
  range: TimeRange;
  disabled: boolean;
  onPickTime: (index: number, field: 'start' | 'end') => void;
  onRemove?: () => void;
  divider?: boolean;
}) {
  return (
    <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={styles.row}>
      {divider ? <View style={styles.divider} /> : null}
      <Text style={styles.label}>Fascia {index + 1}</Text>
      <TimeValue
        value={fmtMin(range.startMinutes)}
        label={`Inizio fascia ${index + 1}`}
        onPress={() => onPickTime(index, 'start')}
        disabled={disabled}
      />
      <Text style={styles.dash}>–</Text>
      <TimeValue
        value={fmtMin(range.endMinutes)}
        label={`Fine fascia ${index + 1}`}
        onPress={() => onPickTime(index, 'end')}
        disabled={disabled}
      />
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          hitSlop={8}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={`Rimuovi fascia ${index + 1}`}
        >
          <Ionicons name="close" size={18} color={CLAY.ink3} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** Orario premibile: capsula incavata (`sink`), come un campo clay. */
function TimeValue({ value, label, onPress, disabled }: { value: string; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.time, CLAY_SHADOW.sink, pressed && styles.timePressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
    >
      <Text style={styles.timeText}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  label: { flex: 1, fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  time: { height: 40, minWidth: 74, borderRadius: 20, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: CLAY.surface },
  timePressed: { opacity: 0.6 },
  timeText: { fontSize: 16.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  dash: { fontSize: 16, color: CLAY.ink3 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
});
