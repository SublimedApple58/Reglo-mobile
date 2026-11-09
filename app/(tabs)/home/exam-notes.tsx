import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField } from '../../../src/components/clay';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { examNotesSheetStore } from '../../../src/stores/examNotesSheetStore';

/**
 * REG-640 — note generali dell'esame, modificabili riaprendolo. Form sheet
 * unico: un campo clay che cresce col testo e la CTA a capsula. Con testo
 * cambiato, chiudere chiede conferma (`dirty`).
 */
export default function ExamNotesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(examNotesSheetStore.subscribe, examNotesSheetStore.get);
  const { accessoryID, accessory } = useDoneAccessory();
  const [text, setText] = useState(data?.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { examNotesSheetStore.clear(); }, []);

  if (!data) return <View style={s.empty} />;

  const dirty = text.trim() !== data.notes.trim();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await data.onConfirm(text.trim() || null);
      router.back();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile salvare le note.');
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title="Note dell'esame"
      subtitle="Le vedono tutti gli istruttori dell'esame."
      onClose={() => router.back()}
      busy={saving}
      dirty={dirty && !saving}
      testID="exam-notes-sheet"
      cta={<ClayButton title="Salva" loading={saving} disabled={!dirty} onPress={save} testID="exam-notes-save" />}
    >
      <ClayField
        value={text}
        onChangeText={setText}
        placeholder="Es. sede, documenti necessari…"
        editable={!saving}
        multiline
        maxLength={2000}
        autoFocus={!data.notes}
        inputAccessoryViewID={accessoryID}
        testID="exam-notes-input"
      />
      {accessory}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
