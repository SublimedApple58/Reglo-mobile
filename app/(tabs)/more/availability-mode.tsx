import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow } from '../../../src/components/clay';
import { instructorSettingsStore, type InstrAvailabilityMode } from '../../../src/stores/instructorSettingsStore';
import { CLAY } from '../../../src/theme/clay';

const OPTIONS: { value: InstrAvailabilityMode; label: string; desc: string }[] = [
  { value: 'default', label: 'Predefinita', desc: 'La tua disponibilità abituale, valida ogni settimana.' },
  { value: 'publication', label: 'Pubblicazione', desc: 'Compili e pubblichi la disponibilità settimana per settimana.' },
];

/**
 * Modalità della disponibilità — REG-639 clay: form sheet unico, due righe
 * con la spunta nera sulla scelta, «Salva» in fondo.
 */
export default function AvailabilityModeScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorSettingsStore.subscribe, instructorSettingsStore.get);
  const [selected, setSelected] = useState<InstrAvailabilityMode>(data?.availabilityMode ?? 'default');

  if (!data) return <View style={s.empty} />;

  const { onPickAvailabilityMode } = data;

  return (
    <FormSheet
      title="Disponibilità"
      subtitle="Come gestisci gli orari in cui sei prenotabile."
      testID="availability-mode-sheet"
      cta={
        <ClayButton
          title="Salva"
          onPress={() => { onPickAvailabilityMode(selected); router.back(); }}
          testID="availability-mode-save"
        />
      }
    >
      <ClayList>
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <ClayListRow
              key={opt.value}
              title={opt.label}
              // Nodo (non stringa) per lasciar andare a capo la descrizione.
              subtitle={<Text style={s.desc}>{opt.desc}</Text>}
              onPress={() => setSelected(opt.value)}
              chevron={false}
              trailing={active ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : <View style={s.checkSlot} />}
              testID={`availability-mode-${opt.value}`}
            />
          );
        })}
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  desc: { flex: 1, fontSize: 13.5, lineHeight: 18, color: CLAY.ink3 },
  checkSlot: { width: 20 },
});
