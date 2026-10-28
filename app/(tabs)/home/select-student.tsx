import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { studentPickerStore } from '../../../src/stores/studentPickerStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayList, ClayListRow, ClaySearchField } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

const normalize = (v: string) => v.trim().toLowerCase();
/** Righe mostrate al massimo (le autoscuole hanno centinaia di allievi): oltre, si cerca. */
const MAX_ROWS = 80;

/**
 * Scelta di un allievo — REG-639 clay: il form sheet unico che scorre da sé,
 * ricerca clay sopra, righe clay (volto, nome, gruppo · patente in testo) con
 * la spunta nera sull'allievo già scelto. Le righe sono un `.map` dentro il
 * foglio (niente lista interna), limitate alle prime MAX_ROWS corrispondenze.
 * Tocco = sceglie e chiude.
 */
export default function SelectStudentScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(studentPickerStore.subscribe, studentPickerStore.get);

  const [query, setQuery] = useState('');

  const options = data?.options ?? [];
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter((o) => normalize(`${o.label} ${o.subtitle ?? ''}`).includes(needle));
  }, [options, query]);

  if (!data) return <View style={s.empty} />;

  const pick = (value: string) => {
    data.onSelect(value);
    router.back();
  };

  const shown = filtered.slice(0, MAX_ROWS);
  const hidden = filtered.length - shown.length;

  return (
    <FormSheet title="Seleziona allievo" testID="select-student-sheet">
      <ClaySearchField value={query} onChangeText={setQuery} placeholder="Cerca allievo..." />

      {filtered.length === 0 ? (
        <Text style={s.none}>Nessun allievo trovato.</Text>
      ) : (
        <ClayList style={s.list}>
          {shown.map((o) => {
            const selected = o.value === data.selectedId;
            const meta = [o.subtitle, o.licenseCategory ? `Patente ${o.licenseCategory}` : null].filter(Boolean).join(' · ');
            return (
              <ClayListRow
                key={o.value}
                leading={<Avatar userId={o.value} name={o.label} size={42} />}
                title={o.label}
                subtitle={meta || undefined}
                onPress={() => pick(o.value)}
                chevron={false}
                trailing={selected ? <Ionicons name="checkmark" size={22} color={CLAY.ink} /> : undefined}
              />
            );
          })}
        </ClayList>
      )}

      {hidden > 0 ? <Text style={s.more}>Altri {hidden} allievi. Scrivi per cercare.</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  list: { marginTop: 14 },
  none: { fontSize: 15, color: CLAY.ink3, textAlign: 'center', paddingVertical: 32 },
  more: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4, textAlign: 'center' },
});
