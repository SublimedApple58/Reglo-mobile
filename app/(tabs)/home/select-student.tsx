import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { studentPickerStore } from '../../../src/stores/studentPickerStore';
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

export default function SelectStudentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(studentPickerStore.subscribe, studentPickerStore.get);

  const [query, setQuery] = useState('');

  const options = data?.options ?? [];
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter((o) => normalize(`${o.label} ${o.subtitle ?? ''}`).includes(needle));
  }, [options, query]);

  if (!data) return <View style={s.root} />;

  const pick = (value: string) => {
    data.onSelect(value);
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
        <Text style={s.title} numberOfLines={1}>Seleziona allievo</Text>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text style={s.empty}>Nessun allievo trovato.</Text>
        ) : (
          filtered.map((o, idx) => {
            const selected = o.value === data.selectedId;
            return (
              <View key={o.value}>
                {idx > 0 ? <View style={s.divider} /> : null}
                <Pressable onPress={() => pick(o.value)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
                  <View style={[s.avatar, selected && { backgroundColor: NAVY }]}>
                    <Text style={[s.avatarTxt, selected && { color: '#fff' }]}>{initialsOf(o.label)}</Text>
                  </View>
                  <View style={s.body}>
                    <Text style={s.name} numberOfLines={1}>{o.label}</Text>
                    {o.subtitle ? <Text style={s.sub} numberOfLines={1}>{o.subtitle}</Text> : null}
                  </View>
                  {o.licenseCategory ? (
                    <View style={s.lic}><Text style={s.licTxt}>{o.licenseCategory}</Text></View>
                  ) : null}
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={NAVY} /> : null}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
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

  empty: { fontSize: 14, color: MUTED, textAlign: 'center', paddingVertical: 32 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginLeft: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 64 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: N100, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '600', color: NAVY },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: INK },
  sub: { fontSize: 13.5, color: MUTED2 },
  lic: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: N100, marginRight: 8 },
  licTxt: { fontSize: 12, fontWeight: '600', color: NAVY },
});
