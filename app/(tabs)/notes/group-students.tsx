import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayButton, ClaySearchField } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import { groupStudentsStore } from '../../../src/stores/groupStudentsStore';

/**
 * «Allievi del gruppo» (modalità autonoma). REG-639 (Tiziano 28/10): form sheet
 * alto quanto il contenuto come tutti i fogli; con tanti allievi scorre il
 * foglio stesso. Clay: volti, selezione nera, niente pillole né pallini.
 */
export default function GroupStudentsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(groupStudentsStore.subscribe, groupStudentsStore.get);

  const [selected, setSelected] = useState<string[]>(data?.assignedIds ?? []);
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    const all = data?.allStudents ?? [];
    const q = search.toLowerCase().trim();
    const filtered = q ? all.filter((st) => `${st.firstName} ${st.lastName}`.toLowerCase().includes(q)) : all;
    return [...filtered].sort((a, b) => {
      const aSel = selected.includes(a.id) ? 0 : 1;
      const bSel = selected.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [data, search, selected]);

  if (!data) return <View style={s.empty} />;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirm = () => {
    const onConfirm = data.onConfirm;
    router.back();
    setTimeout(() => onConfirm(selected), 200);
  };

  return (
    <FormSheet
      title="Allievi del gruppo"
      subtitle={selected.length === 0 ? 'Scegli chi guida con te' : `${selected.length} nel tuo gruppo`}
      testID="group-students-sheet"
      cta={
        <ClayButton
          title={selected.length === 0 ? 'Conferma' : `Conferma · ${selected.length}`}
          onPress={confirm}
          testID="group-students-confirm"
        />
      }
    >
      <ClaySearchField
        placeholder="Cerca un allievo"
        returnKeyType="search"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={s.search}
      />
      {selected.length > 0 ? (
        <Pressable onPress={() => setSelected([])} hitSlop={8} style={({ pressed }) => [s.clear, pressed && { opacity: 0.6 }]}>
          <Text style={s.clearText}>Deseleziona tutti</Text>
        </Pressable>
      ) : null}

      {sorted.length === 0 ? (
        <Animated.Text entering={FadeIn.duration(200)} style={s.emptyText}>
          {search ? 'Nessun allievo con questo nome.' : 'Ancora nessun allievo in autoscuola.'}
        </Animated.Text>
      ) : (
        <View style={s.rows}>
          {sorted.map((item) => {
            const isSel = selected.includes(item.id);
            const assignedToOther = !isSel && !!item.assignedInstructorId;
            const license = item.licenseCategory
              ? `Patente ${item.licenseCategory}${item.transmission === 'automatic' ? ' automatica' : ''}`
              : null;
            const sub = [license, assignedToOther ? 'nel gruppo di un altro istruttore' : null].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [s.row, isSel && s.rowOn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
              >
                <Avatar userId={item.id} name={`${item.firstName} ${item.lastName}`} size={42} />
                <View style={s.body}>
                  <Text style={s.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                  {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
                </View>
                <View style={[s.mark, isSel && s.markOn]}>
                  {isSel ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  search: { marginBottom: 6 },
  clear: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
  rows: { gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 64,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: '#F7F7F7', borderWidth: 1.5, borderColor: 'transparent',
  },
  rowOn: { backgroundColor: '#F4F4F4', borderColor: CLAY.ink },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  sub: { fontSize: 13, color: CLAY.ink3, marginTop: 2 },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#D4D4D4', alignItems: 'center', justifyContent: 'center' },
  markOn: { borderWidth: 0, backgroundColor: CLAY.ink },
  emptyText: { fontSize: 14.5, color: CLAY.ink3, textAlign: 'center', paddingVertical: 34 },
});
