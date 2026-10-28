import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';
import { colorPickerStore } from '../../../src/stores/colorPickerStore';
import { CLAY } from '../../../src/theme/clay';
import { NEUTRAL_BLUE } from '../../../src/utils/agendaColors';

/**
 * Scelta del colore di una voce agenda — REG-639 clay: il form sheet unico.
 * Il «colore standard» è una riga di lista clay con la spunta; i colori sono
 * dati di prodotto e restano pallini colorati (scelto = anello nero). Tocca →
 * applica e chiude.
 */
export default function ColorPickerScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(colorPickerStore.subscribe, colorPickerStore.get);
  if (!data) return <View style={s.empty} />;

  const { title, subtitle, currentHex, swatches, onSelect, resetLabel, resetHex } = data;
  const norm = (h: string | null) => (h ?? '').toUpperCase();
  const pick = (hex: string | null) => {
    onSelect(hex);
    router.back();
  };

  return (
    <FormSheet title={title} subtitle={subtitle} testID="color-picker-sheet">
      <ClayList>
        <ClayListRow
          title={resetLabel ?? 'Colore standard'}
          chevron={false}
          trailing={
            <View style={s.resetTrailing}>
              {resetHex ? <View style={[s.resetDot, { backgroundColor: resetHex }]} /> : null}
              {currentHex == null ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null}
            </View>
          }
          onPress={() => pick(null)}
          testID="color-picker-reset"
        />
      </ClayList>

      <View style={s.grid}>
        {swatches.map((sw) => {
          const selected = norm(sw.hex) === norm(currentHex);
          return (
            <Pressable
              key={sw.hex}
              onPress={() => pick(sw.hex)}
              style={({ pressed }) => [s.swatchCell, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={sw.name}
            >
              <View style={[s.ring, selected && s.ringOn]}>
                <View style={[s.swatch, { backgroundColor: sw.hex }]} />
              </View>
              <Text style={[s.swatchName, selected && s.swatchNameOn]} numberOfLines={1}>
                {sw.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Solo per i colori dei blocchi: il bordo delle automatiche non viene neutralizzato. */}
      {NEUTRAL_BLUE && !resetHex ? <Text style={s.note}>Sul telefono i colori blu e azzurri compaiono in nero.</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  resetTrailing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resetDot: { width: 22, height: 22, borderRadius: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, marginTop: 22 },
  swatchCell: { width: '25%', alignItems: 'center', gap: 6 },
  // Anello di selezione: nero, staccato dal pallino da 3pt di bianco.
  ring: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  ringOn: { borderColor: CLAY.ink },
  swatch: { width: 42, height: 42, borderRadius: 21 },
  swatchName: { fontSize: 12, color: CLAY.ink3 },
  swatchNameOn: { color: CLAY.ink, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 20, paddingHorizontal: 4 },
});
