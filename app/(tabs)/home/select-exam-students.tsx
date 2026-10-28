import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { examStudentsStore } from '../../../src/stores/examStudentsStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClaySearchField } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

const normalize = (v: string) => v.trim().toLowerCase();
/** Righe mostrate al massimo: oltre, si chiede di scrivere per cercare. */
const MAX_ROWS = 80;

/**
 * Scelta multipla degli allievi (esame, guida di gruppo) — REG-639 clay: il
 * form sheet unico che scorre da sé, ricerca clay sopra, righe con la spunta
 * nera a destra. Lo stato (pronto, patente, gruppo) è testo nel sottotitolo,
 * niente pillole. Le righe sono un `.map` dentro il foglio (niente lista
 * interna), limitate alle prime MAX_ROWS corrispondenze.
 */
export default function SelectExamStudentsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(examStudentsStore.subscribe, examStudentsStore.get);

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(data?.selectedIds ?? []);

  const options = data?.options ?? [];

  // Search + sort: selected first, then my cluster, then alphabetical.
  const filtered = useMemo(() => {
    const needle = normalize(query);
    const list = needle
      ? options.filter((o) => normalize(`${o.label} ${o.subtitle ?? ''}`).includes(needle))
      : options;
    const draftSet = new Set(draft);
    return [...list].sort((a, b) => {
      const aSel = draftSet.has(a.value) ? 0 : 1;
      const bSel = draftSet.has(b.value) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      const aMine = a.isMyCluster ? 0 : 1;
      const bMine = b.isMyCluster ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return a.label.localeCompare(b.label);
    });
  }, [options, query, draft]);

  if (!data) return <View style={s.empty} />;

  const toggle = (value: string) =>
    setDraft((prev) => (prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value]));

  const apply = () => {
    data.onConfirm(draft);
    router.back();
  };

  const shown = filtered.slice(0, MAX_ROWS);
  const hidden = filtered.length - shown.length;

  return (
    <FormSheet
      title="Allievi all'esame"
      subtitle={draft.length > 0 ? `${draft.length} ${draft.length === 1 ? 'selezionato' : 'selezionati'}` : undefined}
      testID="select-exam-students-sheet"
      cta={
        <ClayButton
          title={draft.length === 0 ? 'Conferma' : `Conferma selezione (${draft.length})`}
          onPress={apply}
          testID="select-exam-students-confirm"
        />
      }
    >
      <ClaySearchField value={query} onChangeText={setQuery} placeholder="Cerca allievo..." />

      {draft.length > 0 ? (
        <Pressable
          onPress={() => setDraft([])}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [s.clearAll, pressed && { opacity: 0.55 }]}
        >
          <Text style={s.clearAllTxt}>Deseleziona tutti</Text>
        </Pressable>
      ) : null}

      {filtered.length === 0 ? (
        <Text style={s.none}>{query ? 'Nessun allievo trovato.' : 'Nessun allievo disponibile.'}</Text>
      ) : (
        <ClayList style={s.list}>
          {shown.map((o) => {
            const selected = draft.includes(o.value);
            const meta = [o.examReady ? "Pronto per l'esame" : null, o.license ? `Patente ${o.license}` : null, o.subtitle]
              .filter(Boolean)
              .join(' · ');
            return (
              <ClayListRow
                key={o.value}
                leading={<Avatar userId={o.value} name={o.label} size={42} />}
                title={o.label}
                subtitle={meta || undefined}
                onPress={() => toggle(o.value)}
                chevron={false}
                trailing={
                  <View style={s.check}>
                    {selected ? <Ionicons name="checkmark" size={22} color={CLAY.ink} /> : null}
                  </View>
                }
              />
            );
          })}
        </ClayList>
      )}

      {hidden > 0 ? <Text style={s.more}>Altri {hidden} allievi: scrivi per cercare.</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  clearAll: { alignSelf: 'flex-end', marginTop: 12, paddingVertical: 2, paddingHorizontal: 2 },
  clearAllTxt: { fontSize: 15, fontWeight: '500', color: CLAY.ink },
  list: { marginTop: 14 },
  none: { fontSize: 15, color: CLAY.ink3, textAlign: 'center', paddingVertical: 32 },
  check: { width: 24, alignItems: 'center' },
  more: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4, textAlign: 'center' },
});
