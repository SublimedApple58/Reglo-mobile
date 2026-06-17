import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { swapStore } from '../../../src/stores/swapStore';
import type { AutoscuolaAppointmentWithRelations } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function SwapLessonScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(swapStore.subscribe, swapStore.get);
  const [search, setSearch] = useState('');

  const candidates = data?.candidates ?? [];

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? candidates.filter((a) =>
          `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.toLowerCase().includes(q),
        )
      : candidates;
    const groups: Array<{ title: string; data: AutoscuolaAppointmentWithRelations[] }> = [];
    let key = '';
    let bucket: AutoscuolaAppointmentWithRelations[] = [];
    for (const appt of filtered) {
      const k = new Date(appt.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
      if (k !== key) {
        if (bucket.length) groups.push({ title: key, data: bucket });
        key = k;
        bucket = [appt];
      } else {
        bucket.push(appt);
      }
    }
    if (bucket.length) groups.push({ title: key, data: bucket });
    return groups;
  }, [candidates, search]);

  const confirmSwap = (appt: AutoscuolaAppointmentWithRelations) => {
    if (!data) return;
    const targetName = `${appt.student?.firstName ?? ''} ${appt.student?.lastName ?? ''}`.trim() || 'Allievo';
    Alert.alert(
      'Conferma scambio',
      `Scambiare ${data.sourceName} con ${targetName}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Scambia',
          onPress: async () => {
            const ok = await data.onSwap(appt);
            if (ok) router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <SheetScaffold keyboardAware contentContainerStyle={{ gap: 14 }}>
      <View style={s.headerBlock}>
        <Text style={s.title}>Scambia con…</Text>
        <Text style={s.subtitle}>Scegli una guida con cui scambiare.</Text>
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          placeholder="Cerca allievo…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={s.searchInput}
          autoCorrect={false}
        />
        {search ? (
          <Pressable hitSlop={8} onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </Pressable>
        ) : null}
      </View>

      {grouped.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="swap-horizontal-outline" size={32} color="#CBD5E1" />
          <Text style={s.emptyText}>Nessuna guida disponibile per lo scambio</Text>
        </View>
      ) : (
        grouped.map((section) => (
          <View key={section.title} style={{ gap: 8 }}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.groupCard}>
              {section.data.map((appt, idx) => {
                const start = new Date(appt.startsAt);
                const end = appt.endsAt ? new Date(appt.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
                return (
                  <View key={appt.id}>
                    {idx > 0 ? <View style={s.divider} /> : null}
                    <Pressable onPress={() => confirmSwap(appt)} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{(appt.student?.firstName ?? '?').slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={s.rowBody}>
                        <Text style={s.rowName} numberOfLines={1}>
                          {appt.student?.firstName ?? ''} {appt.student?.lastName ?? ''}
                        </Text>
                        {data?.vehiclesEnabled && appt.vehicle?.name ? (
                          <Text style={s.rowSub} numberOfLines={1}>{appt.vehicle.name}</Text>
                        ) : null}
                      </View>
                      <Text style={s.rowTime}>{hhmm(start)} – {hhmm(end)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 14 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, height: 46, borderRadius: 14, backgroundColor: '#F3F4F6',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E', padding: 0 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#94A3B8', textTransform: 'capitalize' },
  groupCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
    shadowColor: '#1A1A2E', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, minHeight: 64 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECECEC', marginLeft: 62 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  rowSub: { fontSize: 13, color: '#94A3B8' },
  rowTime: { fontSize: 14, fontWeight: '600', color: '#475569' },
});
