import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { examStudentsStore } from '../../../src/stores/examStudentsStore';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const NAVY = '#1A1A2E';
const INK = '#1E293B';
const MUTED = '#94A3B8';
const MUTED2 = '#64748B';
const N100 = '#E9EBF2';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const normalize = (v: string) => v.trim().toLowerCase();

export default function SelectExamStudentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  if (!data) return <View style={s.root} />;

  const toggle = (value: string) =>
    setDraft((prev) => (prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value]));

  const apply = () => {
    data.onConfirm(draft);
    router.back();
  };

  return (
    <View style={[s.root, { paddingTop: 14 }]}>
      <View style={s.topbar}>
        {Platform.OS === 'android' ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
            <Ionicons name="arrow-back" size={22} color={NAVY} />
          </Pressable>
        ) : null}
        <Text style={s.title} numberOfLines={1}>Allievi all&apos;esame</Text>
        {Platform.OS !== 'android' ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        ) : null}
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={19} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca allievo..."
          returnKeyType="search"
          placeholderTextColor={MUTED}
          style={s.searchInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {draft.length > 0 ? (
        <Pressable onPress={() => setDraft([])} hitSlop={8} style={({ pressed }) => [s.clearAll, pressed && { opacity: 0.6 }]}>
          <Text style={s.clearAllTxt}>Deseleziona tutti</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text style={s.empty}>{query ? 'Nessun allievo trovato.' : 'Nessun allievo disponibile.'}</Text>
        ) : (
          filtered.map((o, idx) => {
            const selected = draft.includes(o.value);
            return (
              <View key={o.value}>
                {idx > 0 ? <View style={s.divider} /> : null}
                <Pressable onPress={() => toggle(o.value)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
                  <View style={[s.avatar, selected && { backgroundColor: NAVY }]}>
                    <Text style={[s.avatarTxt, selected && { color: '#fff' }]}>{initialsOf(o.label)}</Text>
                  </View>
                  <View style={s.body}>
                    <Text style={s.name} numberOfLines={1}>{o.label}</Text>
                    {o.subtitle ? (
                      <View style={[s.badge, o.isMyCluster && s.badgeMine]}>
                        <Text style={[s.badgeTxt, o.isMyCluster && s.badgeTxtMine]} numberOfLines={1}>{o.subtitle}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[s.checkbox, selected && s.checkboxOn]}>
                    {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable onPress={apply} style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
          <GradientCTABackground radius={27} />
          <Text style={s.ctaText}>{draft.length === 0 ? 'Conferma' : `Conferma selezione (${draft.length})`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 10, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.lg, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#ECECEC', backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, fontSize: 16, color: INK, padding: 0 },

  clearAll: { alignSelf: 'flex-end', marginHorizontal: spacing.lg, marginBottom: 4, paddingVertical: 4 },
  clearAllTxt: { fontSize: 13, fontWeight: '500', color: MUTED2, textDecorationLine: 'underline' },

  empty: { fontSize: 14, color: MUTED, textAlign: 'center', paddingVertical: 32 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginLeft: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 64 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: N100, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '600', color: NAVY },
  body: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: INK },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#F1F5F9' },
  badgeMine: { backgroundColor: N100 },
  badgeTxt: { fontSize: 11, fontWeight: '500', color: MUTED2 },
  badgeTxtMine: { color: NAVY },
  checkbox: {
    width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: NAVY, borderColor: NAVY },

  footer: {
    paddingHorizontal: spacing.lg, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cta: {
    height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
