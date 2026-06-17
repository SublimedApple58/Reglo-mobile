import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaInstructor } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ManageLessonInstructorScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorPickerStore.subscribe, instructorPickerStore.get);

  const [list, setList] = useState<AutoscuolaInstructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    regloApi
      .getInstructors()
      .then((items) => { if (!cancelled) setList(items ?? []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const active = list.filter((it) => it.status !== 'inactive');

  const pick = (it: AutoscuolaInstructor) => {
    data?.onSelect(it);
    router.back();
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Cambia istruttore</Text>
        <Text style={s.subtitle}>Scegli chi terrà questa guida.</Text>
      </View>

      <SheetScaffold>
        {loading && list.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator size="small" color="#1A1A2E" />
            <Text style={s.muted}>Carico gli istruttori…</Text>
          </View>
        ) : active.length === 0 ? (
          <View style={s.center}><Text style={s.muted}>Nessun istruttore disponibile.</Text></View>
        ) : (
          <View style={s.list}>
            {active.map((it, idx) => {
              const isCurrent = it.id === data?.currentInstructorId;
              const isSelected = it.id === data?.selectedInstructorId;
              return (
                <View key={it.id}>
                  {idx > 0 ? <View style={s.divider} /> : null}
                  <Pressable onPress={() => pick(it)} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
                    <View style={s.iconCol}>
                      <Ionicons name="person" size={22} color="#1A1A2E" />
                    </View>
                    <View style={s.body}>
                      <Text style={[s.name, isSelected && { fontWeight: '700' }]} numberOfLines={1}>{it.name}</Text>
                      {isCurrent ? <Text style={s.sub}>Istruttore attuale</Text> : null}
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#1A1A2E" /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  muted: { color: colors.textSecondary, fontSize: 13 },
  list: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 60 },
  iconCol: { width: 28, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  sub: { fontSize: 13, color: '#94A3B8' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginLeft: 40 },
});
