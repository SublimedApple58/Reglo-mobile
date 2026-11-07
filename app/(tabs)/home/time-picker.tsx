import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySegmented } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';
import { FIELD_HEIGHT } from '../../../src/theme/spacing';
import { SOFT } from '../../../src/utils/motion';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
/** Quinta voce del segmentato: minuti esatti (orari spezzati, es. 14:50). */
const EXACT = -1;

const padTwo = (n: number) => String(n).padStart(2, '0');
const FIELD_IN = FadeIn.duration(220).easing(SOFT).reduceMotion(ReduceMotion.Never);
const FIELD_OUT = FadeOut.duration(160).easing(SOFT).reduceMotion(ReduceMotion.Never);

/**
 * Scelta dell'orario — REG-639 clay: il form sheet unico, senza colonne che
 * scorrono dentro il foglio. Le 24 ore sono una griglia (ora scelta = cerchio
 * nero in clay), i minuti un segmentato clay, conferma in fondo.
 *
 * Orari spezzati (Ricca, punto 5): le scelte rapide restano 00/15/30/45; la
 * quinta voce «Altro» apre il campo «Minuti esatti» (tastierino numerico) e,
 * scelto un minuto, ne diventa l'etichetta («50»). Questo foglio serve solo
 * allo staff (guide, esami, blocchi, gruppi, malattia): le prenotazioni
 * dell'allievo restano a slot, le disponibilità usano gli altri time-picker.
 */
export default function HomeTimePickerScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(timePickerStore.subscribe, timePickerStore.get);

  const [hour, setHour] = useState(() => data?.selectedTime.getHours() ?? 9);
  const [minute, setMinute] = useState(() => data?.selectedTime.getMinutes() ?? 0);
  const [exact, setExact] = useState(() => !MINUTES.includes(data?.selectedTime.getMinutes() ?? 0));
  const [typed, setTyped] = useState(() => (exact ? padTwo(minute) : ''));

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
      cta={
        <ClayButton
          title={exact && !typed.length ? 'Scrivi i minuti' : `Conferma ${padTwo(hour)}:${padTwo(minute)}`}
          disabled={exact && !typed.length}
          onPress={confirm}
          testID="time-picker-confirm"
        />
      }
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
        options={[
          ...MINUTES.map((m) => ({ value: m, label: padTwo(m) })),
          { value: EXACT, label: exact && typed.length ? padTwo(minute) : 'Altro', testID: 'time-picker-exact' },
        ]}
        value={exact ? EXACT : minute}
        onChange={(v) => {
          if (v === EXACT) {
            setExact(true);
            setTyped(MINUTES.includes(minute) ? '' : padTwo(minute));
            return;
          }
          setExact(false);
          setMinute(v);
        }}
        testID="time-picker-minutes"
      />
      {exact ? (
        <Animated.View entering={FIELD_IN} exiting={FIELD_OUT} style={s.exactRow}>
          <Text style={s.exactLabel}>Minuti esatti</Text>
          <View style={[s.exactField, CLAY_SHADOW.sink]}>
            <TextInput
              value={typed}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '').slice(0, 2);
                if (digits.length && Number(digits) > 59) return;
                setTyped(digits);
                if (digits.length) setMinute(Number(digits));
              }}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus={!typed.length}
              placeholder="--"
              placeholderTextColor={CLAY.ink4}
              selectTextOnFocus
              style={s.exactInput}
              accessibilityLabel="Minuti esatti"
              testID="time-picker-exact-input"
            />
          </View>
        </Animated.View>
      ) : null}
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
  exactRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  exactLabel: { fontSize: 15, fontWeight: '500', color: CLAY.ink },
  exactField: {
    width: 92,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_HEIGHT / 2,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exactInput: {
    width: '100%',
    height: FIELD_HEIGHT,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '600',
    color: CLAY.ink,
    fontVariant: ['tabular-nums'],
  },
});
