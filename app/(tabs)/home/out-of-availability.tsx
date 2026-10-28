import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { outOfAvailStore } from '../../../src/stores/outOfAvailStore';
import { regloApi } from '../../../src/services/regloApi';
import type { OutOfAvailabilityAppointment } from '../../../src/types/regloApi';
import { groupOutOfAvailability, type OobGroup } from '../../../src/utils/outOfAvailability';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySurface } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

const scopeLabel = (scope: ('instructor' | 'vehicle')[]) =>
  scope.length > 1 ? 'Entrambi' : scope.includes('instructor') ? 'Istruttore' : 'Veicolo';

/**
 * Guide fuori disponibilità — REG-639 clay: il form sheet unico. Una card clay
 * per guida (o guida di gruppo), il motivo in testo semplice (niente chip),
 * «Cancella» secondaria e «Mantieni» nera.
 */
export default function OutOfAvailabilityScreen() {
  const router = useRouter();
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

  if (!data) return <View style={s.empty} />;

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
    <FormSheet title="Guide fuori disponibilità" testID="out-of-availability-sheet">
      {groups.length === 0 ? (
        <Text style={s.none}>Nessuna guida fuori disponibilità.</Text>
      ) : (
        <View style={s.cards}>
          {groups.map((group) => {
            const apt = group.rep;
            const rowPending = pending?.key === group.key;
            const anyPending = pending !== null;
            const isGroup = group.isGroupLesson;
            const canOpen = isGroup && !!group.groupLessonId && !!data.onOpenGroupLesson;
            const meta = [apt.instructorName, apt.vehicleName].filter(Boolean).join(' · ');
            return (
              <ClaySurface
                key={group.key}
                onPress={canOpen ? () => { if (!anyPending && group.groupLessonId) data.onOpenGroupLesson?.(group.groupLessonId); } : undefined}
                accessibilityLabel={canOpen ? 'Apri guida di gruppo' : undefined}
                style={rowPending ? s.dim : undefined}
              >
                <Text style={s.name} numberOfLines={1}>
                  {isGroup ? `Guida di gruppo · ${group.count} alliev${group.count === 1 ? 'o' : 'i'}` : apt.studentName}
                </Text>
                <Text style={s.time}>{fmtDay(apt.startsAt)} {'·'} {fmtTime(apt.startsAt)} – {fmtTime(apt.endsAt)}</Text>
                {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
                <Text style={s.meta}>Fuori disponibilità: {scopeLabel(apt.outOfAvailabilityFor).toLowerCase()}</Text>
                <View style={s.actions}>
                  <ClayButton
                    title="Cancella"
                    variant="secondary"
                    compact
                    style={s.action}
                    loading={rowPending && pending?.action === 'cancel'}
                    disabled={anyPending}
                    onPress={() => runAction(group, 'cancel')}
                  />
                  <ClayButton
                    title="Mantieni"
                    compact
                    style={s.action}
                    loading={rowPending && pending?.action === 'approve'}
                    disabled={anyPending}
                    onPress={() => runAction(group, 'approve')}
                  />
                </View>
              </ClaySurface>
            );
          })}
        </View>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  none: { fontSize: 15, color: CLAY.ink3, textAlign: 'center', paddingVertical: 40 },
  cards: { gap: 14 },
  dim: { opacity: 0.6 },
  name: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  time: { fontSize: 15, color: CLAY.ink2, marginTop: 4 },
  meta: { fontSize: 13.5, color: CLAY.ink3, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: { flex: 1, alignSelf: 'auto' },
});
