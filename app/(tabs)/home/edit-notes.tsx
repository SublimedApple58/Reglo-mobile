import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { ClayButton, ClayField } from '../../../src/components/clay';
import { notesEditorStore } from '../../../src/stores/notesEditorStore';

/**
 * Editor di note generico: il form sheet unico (FORM_SHEET + FormSheet,
 * REG-639 clay). Seed via notesEditorStore.
 */
export default function EditNotesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(notesEditorStore.subscribe, notesEditorStore.get);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const { accessoryID, accessory } = useDoneAccessory();

  useEffect(() => {
    if (data) setText(data.initial);
  }, [data]);

  // Clear the seed when the sheet is dismissed.
  useEffect(() => {
    return () => {
      notesEditorStore.clear();
    };
  }, []);

  if (!data) {
    return <View style={s.empty} />;
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await data.onSave(text);
      if (ok) router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title={data.title}
      subtitle={data.subtitle || undefined}
      testID="edit-notes-sheet"
      cta={<ClayButton title="Salva" onPress={handleSave} loading={saving} testID="edit-notes-save" />}
    >
      <ClayField
        value={text}
        onChangeText={setText}
        placeholder={data.placeholder ?? 'Aggiungi note operative o osservazioni.'}
        multiline
        editable={!saving}
        autoFocus
        inputAccessoryViewID={accessoryID}
        accessibilityLabel={data.title}
        testID="edit-notes-input"
      />
      {accessory}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
