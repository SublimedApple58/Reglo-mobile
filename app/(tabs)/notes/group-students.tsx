import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { groupStudentsStore, type GroupStudent } from '../../../src/stores/groupStudentsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const AVATAR_BG = ['#E9EBF2', '#DBEAFE', '#DCFCE7', '#EDE9FE', '#FFEDD5', '#E0F2FE', '#FEE2E2', '#F1F5F9'];
const AVATAR_FG = ['#0D0D16', '#1D4ED8', '#15803D', '#6D28D9', '#C2410C', '#0369A1', '#B91C1C', '#475569'];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const avatarColors = (id: string) => { const i = hashStr(id) % AVATAR_BG.length; return { bg: AVATAR_BG[i], fg: AVATAR_FG[i] }; };
const initials = (f: string, l: string) => `${(f[0] ?? '')}${(l[0] ?? '')}`.toUpperCase() || '?';

export default function GroupStudentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(groupStudentsStore.subscribe, groupStudentsStore.get);

  const [selected, setSelected] = useState<string[]>(data?.assignedIds ?? []);
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    const all = data?.allStudents ?? [];
    const q = search.toLowerCase().trim();
    const filtered = q ? all.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) : all;
    return [...filtered].sort((a, b) => {
      const aSel = selected.includes(a.id) ? 0 : 1;
      const bSel = selected.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [data, search, selected]);

  if (!data) return <View style={s.root} />;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirm = () => {
    const onConfirm = data.onConfirm;
    router.back();
    setTimeout(() => onConfirm(selected), 200);
  };

  const renderItem = ({ item }: { item: GroupStudent }) => {
    const isSel = selected.includes(item.id);
    const assignedToOther = !isSel && item.assignedInstructorId;
    const { bg, fg } = avatarColors(item.id);
    const licenseTag = item.licenseCategory
      ? `${item.licenseCategory}${item.transmission === 'automatic' ? ' autom.' : ''}`
      : null;
    return (
      <Pressable onPress={() => toggle(item.id)} style={({ pressed }) => [s.row, isSel && s.rowSel, pressed && { opacity: 0.7 }]}>
        <View style={[s.avatar, { backgroundColor: bg }]}>
          <Text style={[s.avatarText, { color: fg }]}>{initials(item.firstName, item.lastName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
          {assignedToOther ? (
            <View style={s.subRow}>
              <View style={s.subDot} />
              <Text style={s.sub} numberOfLines={1}>Nel gruppo di un altro istruttore</Text>
            </View>
          ) : null}
        </View>
        {licenseTag ? (
          <View style={s.licTag}>
            <Text style={s.licTagText}>{licenseTag}</Text>
          </View>
        ) : null}
        {isSel ? (
          <Animated.View entering={FadeIn.duration(180)} style={s.check}>
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          </Animated.View>
        ) : (
          <View style={s.checkDot} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      {/* Top bar — close (matches all page sheets) */}
      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'close'} size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      {/* Title */}
      <View style={s.titleBlock}>
        <Text style={s.title}>Allievi del gruppo</Text>
        <Text style={s.titleSub}>Seleziona chi fa parte del tuo gruppo.</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={s.searchInput}
          placeholder="Cerca allievo..."
          returnKeyType="search"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </Pressable>
        ) : null}
      </View>

      {/* Meta row: count + clear */}
      <View style={s.metaRow}>
        <Text style={s.metaCount}>
          {selected.length === 0 ? 'Nessuno selezionato' : `${selected.length} selezionat${selected.length === 1 ? 'o' : 'i'}`}
        </Text>
        {selected.length > 0 ? (
          <Pressable onPress={() => setSelected([])} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={s.clearText}>Deseleziona tutti</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
            <Ionicons name="people-outline" size={30} color="#CBD5E1" />
            <Text style={s.emptyText}>{search ? 'Nessun allievo trovato.' : 'Nessun allievo in autoscuola.'}</Text>
          </Animated.View>
        }
      />

      {/* Footer CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable onPress={confirm} style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
          <GradientCTABackground radius={27} />
          <Text style={s.ctaText}>
            {selected.length === 0 ? 'Conferma' : `Conferma · ${selected.length}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },

  /* Top bar + title */
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16, paddingBottom: 6, marginRight: -4 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  titleSub: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 3 },

  /* Search */
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#1A1A2E', padding: 0 },

  /* Meta */
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  metaCount: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  clearText: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },

  /* Row */
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16,
  },
  rowSel: { backgroundColor: '#F4F5F7' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F59E0B' },
  sub: { fontSize: 12, color: '#94A3B8', flexShrink: 1 },

  /* Pursued-license tag (e.g. "A2", "B autom.") */
  licTag: {
    borderRadius: 999, borderWidth: 1, borderColor: '#E5E8EC', backgroundColor: '#FFFFFF',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  licTagText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },

  check: {
    width: 26, height: 26, borderRadius: 999,
    backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center',
  },
  checkDot: {
    width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, borderColor: '#E5E8EC', backgroundColor: 'transparent',
  },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: '#64748B' },

  /* Footer */
  footer: { paddingTop: 12 },
  cta: {
    height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
