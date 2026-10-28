import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySegmented } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const padTwo = (n: number) => String(n).padStart(2, '0');
const closestMinute = (m: number) =>
  MINUTES.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));

/**
 * Scelta dell'orario — REG-639 clay: il form sheet unico, senza colonne che
 * scorrono dentro il foglio. Le 24 ore sono una griglia (ora scelta = cerchio
 * nero in clay), i minuti un segmentato clay (4 opzioni), conferma in fondo.
 */
export default function RoleTimePickerScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(timePickerStore.subscribe, timePickerStore.get);

  const [hour, setHour] = useState(() => data?.selectedTime.getHours() ?? 9);
  const [minute, setMinute] = useState(() => closestMinute(data?.selectedTime.getMinutes() ?? 0));

  useEffect(() => {
    return () => { timePickerStore.clear(); };
  }, []);

  if (!data) return <View style={s.empty} />;

  const confirm = () => {
    const result = new Date(data.selectedTime);
    result.setHours(hour, minute, 0, 0);
    const onConfirm = data.onConfirm;
    router.back();
    setTimeout(() => onConfirm(result), 250);
  };

  return (
    <FormSheet
      title="Seleziona orario"
      testID="time-picker-sheet"
      cta={<ClayButton title={`Conferma ${padTwo(hour)}:${padTwo(minute)}`} onPress={confirm} testID="time-picker-confirm" />}
    >
      <Text style={s.label}>Ore</Text>
      <View style={s.grid}>
        {HOURS.map((h) => {
          const selected = h === hour;
          return (
            <Pressable
              key={h}
              onPress={() => setHour(h)}
              style={s.cell}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Ore ${padTwo(h)}`}
            >
              <View style={[s.hour, selected && s.hourOn]}>
                <Text style={[s.hourTx, selected && s.hourTxOn]}>{padTwo(h)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.label, s.labelGap]}>Minuti</Text>
      <ClaySegmented
        options={MINUTES.map((m) => ({ value: m, label: padTwo(m) }))}
        value={minute}
        onChange={setMinute}
        testID="time-picker-minutes"
      />
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, marginBottom: 8, paddingHorizontal: 2 },
  labelGap: { marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 6}%`, height: 50, alignItems: 'center', justifyContent: 'center' },
  hour: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hourOn: { backgroundColor: CLAY.ink, ...CLAY_SHADOW.ink },
  hourTx: { fontSize: 17, fontWeight: '400', color: CLAY.ink2 },
  hourTxOn: { color: '#FFFFFF', fontWeight: '600' },
});
