import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { manageLessonStore } from '../../../src/stores/manageLessonStore';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { StarRating } from '../../../src/components/StarRating';
import { LESSON_TYPE_OPTIONS, resolveInitialLessonTypes } from '../../../src/utils/lessonTypes';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { SheetScaffold } from '../../../src/components/SheetScaffold';

export default function ManageLessonDetailsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(manageLessonStore.subscribe, manageLessonStore.get);

  const lesson = data?.lesson ?? null;

  const [types, setTypes] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!lesson) return;
    setTypes(resolveInitialLessonTypes(lesson));
    setRating(lesson.rating ?? null);
    setNotes(lesson.notes ?? '');
  }, [lesson]);

  if (!data || !lesson) {
    return <View style={s.root} />;
  }

  const { showRating, isDetailsEditable, pendingAction, onSaveDetails } = data;
  const isPending = pendingAction !== null;
  const editable = isDetailsEditable && !isPending;

  const handleSave = async () => {
    if (!editable) return;
    const ok = await onSaveDetails({ lessonTypes: types, rating, notes });
    if (ok) router.back();
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
        contentContainerStyle={s.scaffoldBody}
        footer={
          <Pressable
            onPress={handleSave}
            disabled={!editable}
            style={({ pressed }) => [s.saveBtn, s.saveFooter, pressed && { opacity: 0.9 }, !editable && { opacity: 0.4 }]}
          >
            <GradientCTABackground radius={27} />
            {pendingAction === 'save_details' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.saveText}>Salva</Text>
            )}
          </Pressable>
        }
      >
      <View style={s.headerBlock}>
        <Text style={s.title}>Dettagli guida</Text>
        <Text style={s.subtitle}>Tipo, valutazione e note di questa guida.</Text>
      </View>

      {/* Tipo guida */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Tipo guida</Text>
        <View style={s.chipList}>
          {LESSON_TYPE_OPTIONS.map((option) => (
            <SelectableChip
              key={option.value}
              label={option.label}
              active={types.includes(option.value)}
              onPress={() => {
                if (!editable) return;
                setTypes((prev) => {
                  if (prev.includes(option.value)) {
                    const next = prev.filter((t) => t !== option.value);
                    return next.length ? next : [option.value];
                  }
                  return [...prev, option.value];
                });
              }}
            />
          ))}
        </View>
      </View>

      {/* Valutazione */}
      {showRating ? (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Valutazione</Text>
          <StarRating value={rating} onChange={editable ? setRating : () => {}} />
        </View>
      ) : null}

      {/* Note */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Note</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Aggiungi note operative o osservazioni."
          placeholderTextColor={colors.textMuted}
          multiline
          style={s.notes}
          editable={editable}
        />
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  scaffoldBody: { gap: 20 },
  saveFooter: { marginTop: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  section: { gap: 12 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notes: {
    minHeight: 110, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: '#1A1A2E', backgroundColor: '#F7F7F8',
    textAlignVertical: 'top', fontSize: 15, lineHeight: 22,
  },

  saveBtn: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: '#1A1A2E', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
