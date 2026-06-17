import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { outOfAvailStore } from '../../../src/stores/outOfAvailStore';
import { regloApi } from '../../../src/services/regloApi';
import type { OutOfAvailabilityAppointment } from '../../../src/types/regloApi';
import { groupOutOfAvailability, type OobGroup } from '../../../src/utils/outOfAvailability';
import { Button } from '../../../src/components/Button';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const N100 = '#E9EBF2';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

const scopeLabel = (scope: ('instructor' | 'vehicle')[]) =>
  scope.length > 1 ? 'Entrambi' : scope.includes('instructor') ? 'Istruttore' : 'Veicolo';

/* Native content-hugging formSheet — header + list of out-of-availability cards. */
export default function OutOfAvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(outOfAvailStore.subscribe, outOfAvailStore.get);

  const [items, setItems] = useState<OutOfAvailabilityAppointment[]>(data?.appointments ?? []);
  // A group lesson's participants are ONE entry, not N separate guide.
  const groups = useMemo(() => groupOutOfAvailability(items), [items]);
  // Track BOTH the group and which action is running, so the spinner shows on the
  // exact button the user pressed (not the sibling).
  const [pending, setPending] = useState<{ key: string; action: 'cancel' | 'approve' } | null>(null);

  useEffect(() => {
    if (data) setItems(data.appointments);
  }, [data]);

  if (!data) return <View style={s.root} />;

  const runAction = async (group: OobGroup, action: 'cancel' | 'approve') => {
    if (pending) return;
    setPending({ key: group.key, action });
    try {
      if (action === 'cancel' && group.isGroupLesson && group.groupLessonId) {
        // Cancel the whole group lesson in one shot (cancels every seat).
        await regloApi.cancelGroupLesson(group.groupLessonId);
      } else {
        // Apply to every seat (single lesson, or "Mantieni" on a group).
        for (const id of group.ids) {
          if (action === 'cancel') await regloApi.cancelAppointment(id);
          else await regloApi.approveAvailabilityOverride(id);
        }
      }
      const removed = new Set(group.ids);
      const next = items.filter((a) => !removed.has(a.id));
      setItems(next);
      data.onChanged();
      if (next.length === 0) router.back();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : "Errore durante l'operazione.");
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 14 }]}>
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>Guide fuori disponibilità</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      {groups.length === 0 ? (
        <Text style={s.empty}>Nessuna guida fuori disponibilità.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {groups.map((group) => {
            const apt = group.rep;
            const rowPending = pending?.key === group.key;
            const anyPending = pending !== null;
            const isGroup = group.isGroupLesson;
            const canOpen = isGroup && !!group.groupLessonId && !!data.onOpenGroupLesson;
            const inner = (
              <>
                <View style={s.cardHead}>
                  {isGroup ? <View style={s.glIcon}><Ionicons name="people" size={15} color="#0F766E" /></View> : null}
                  <Text style={s.studentName} numberOfLines={1}>{isGroup ? 'Guida di gruppo' : apt.studentName}</Text>
                  <View style={s.chip}><Text style={s.chipTxt}>{scopeLabel(apt.outOfAvailabilityFor)}</Text></View>
                </View>
                <Text style={s.time}>{fmtDay(apt.startsAt)} {'·'} {fmtTime(apt.startsAt)} – {fmtTime(apt.endsAt)}</Text>
                {isGroup ? <Text style={s.meta}>{group.count} alliev{group.count === 1 ? 'o' : 'i'}</Text> : null}
                {apt.instructorName ? <Text style={s.meta}>{apt.instructorName}</Text> : null}
                {apt.vehicleName ? <Text style={s.meta}>{apt.vehicleName}</Text> : null}
                <View style={s.actions}>
                  <View style={{ flex: 1 }}>
                    <Button label="Cancella" tone="danger" fullWidth loading={rowPending && pending?.action === 'cancel'} disabled={anyPending} onPress={() => runAction(group, 'cancel')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Mantieni" tone="primary" fullWidth loading={rowPending && pending?.action === 'approve'} disabled={anyPending} onPress={() => runAction(group, 'approve')} />
                  </View>
                </View>
              </>
            );
            return canOpen ? (
              <Pressable
                key={group.key}
                onPress={() => { if (!anyPending && group.groupLessonId) data.onOpenGroupLesson?.(group.groupLessonId); }}
                style={({ pressed }) => [s.card, s.groupCard, rowPending && { opacity: 0.6 }, pressed && { opacity: 0.97 }]}
              >
                {inner}
              </Pressable>
            ) : (
              <View key={group.key} style={[s.card, isGroup && s.groupCard, rowPending && { opacity: 0.6 }]}>
                {inner}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ELEV = {
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
} as const;

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '600', color: NAVY, letterSpacing: -0.4 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },

  empty: { fontSize: 14, color: MUTED, textAlign: 'center', paddingVertical: 40 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 4, ...ELEV },
  // Group lesson cards take the app's teal group-lesson accent.
  groupCard: { borderLeftWidth: 3, borderLeftColor: '#10B981' },
  glIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  studentName: { flex: 1, fontSize: 16, fontWeight: '600', color: NAVY },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: N100 },
  chipTxt: { fontSize: 11.5, fontWeight: '600', color: NAVY },
  time: { fontSize: 13.5, color: GREY, fontWeight: '500' },
  meta: { fontSize: 13, color: MUTED },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
