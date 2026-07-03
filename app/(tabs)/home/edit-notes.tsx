import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { notesEditorStore } from '../../../src/stores/notesEditorStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

/**
 * Generic notes editor form sheet (fitToContents). Seeded via notesEditorStore.
 */
export default function EditNotesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(notesEditorStore.subscribe, notesEditorStore.get);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

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
    return <View style={s.root} />;
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
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <SheetScaffold
        keyboardAware
        style={{ gap: 20 }}
        contentContainerStyle={{ gap: 20 }}
        footer={(
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.9 }, saving && { opacity: 0.7 }]}
          >
            <GradientCTABackground radius={27} />
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.saveText}>Salva</Text>}
          </Pressable>
        )}
      >
        <View style={s.headerBlock}>
          <Text style={s.title}>{data.title}</Text>
          {data.subtitle ? <Text style={s.subtitle}>{data.subtitle}</Text> : null}
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={data.placeholder ?? 'Aggiungi note operative o osservazioni.'}
          placeholderTextColor={colors.textMuted}
          multiline
          style={s.notes}
          editable={!saving}
          autoFocus
        />
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  notes: {
    minHeight: 130, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: '#1A1A2E', backgroundColor: '#F7F7F8',
    textAlignVertical: 'top', fontSize: 15, lineHeight: 22,
  },

  saveBtn: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
