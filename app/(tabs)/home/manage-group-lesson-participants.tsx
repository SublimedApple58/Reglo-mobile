import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { groupLessonParticipantsStore } from '../../../src/stores/groupLessonParticipantsStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { notesEditorStore } from '../../../src/stores/notesEditorStore';
import { regloApi } from '../../../src/services/regloApi';
import type { GroupLesson } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { LICENSE_CATEGORY_LABELS } from '../../../src/utils/license';

// Patente che l'allievo sta facendo (categoria del veicolo assegnato) + — per i
// gruppi moto — la moto assegnata. Riga meta sotto il nome nel roster.
const participantMeta = (
  isMoto: boolean,
  licenseCategory?: string | null,
  vehicleName?: string | null,
): string | null => {
  const cat = licenseCategory
    ? LICENSE_CATEGORY_LABELS[licenseCategory as keyof typeof LICENSE_CATEGORY_LABELS] ?? licenseCategory
    : null;
  const license = cat ? `Patente ${cat}` : null;
  // Gruppo moto senza moto libera al momento dell'iscrizione → "a rotazione".
  return [license, isMoto ? vehicleName ?? 'Moto a rotazione' : null].filter(Boolean).join(' · ') || null;
};

const initialsOf = (name: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '–';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

// Keep the roster in the order it was first shown, so marking a presence never
// reshuffles the list (defensive even if the backend returns a different order).
// New participants (not seen before) go to the end, stably.
function keepOrder(
  prev: GroupLesson['participants'] | undefined,
  next: GroupLesson['participants'],
): GroupLesson['participants'] {
  if (!prev || prev.length === 0) return next;
  const order = new Map(prev.map((p, i) => [p.appointmentId, i]));
  const rank = (id: string) => (order.has(id) ? (order.get(id) as number) : Number.MAX_SAFE_INTEGER);
  return [...next].sort(
    (a, b) => rank(a.appointmentId) - rank(b.appointmentId) || a.appointmentId.localeCompare(b.appointmentId),
  );
}

export default function ManageGroupLessonParticipantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const seed = useSyncExternalStore(groupLessonParticipantsStore.subscribe, groupLessonParticipantsStore.get);

  // Local copy so this sheet can re-render after a mutation without depending on
  // the parent reloading first.
  const [lesson, setLesson] = useState<GroupLesson | null>(seed?.lesson ?? null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  // `${appointmentId}:${outcome}` of the seat whose presence is being saved.
  const [outcomeBusy, setOutcomeBusy] = useState<string | null>(null);
  const [allPresentBusy, setAllPresentBusy] = useState(false);
  const groupLessonId = seed?.groupLessonId ?? null;
  const busy = !!removingId || adding || inviting || !!outcomeBusy || allPresentBusy;

  useEffect(() => {
    const next = seed?.lesson;
    if (next) setLesson((prev) => ({ ...next, participants: keepOrder(prev?.participants, next.participants) }));
  }, [seed?.lesson]);

  const refreshLocal = useCallback(async () => {
    if (!groupLessonId) return;
    try {
      const res = await regloApi.getGroupLesson(groupLessonId);
      if (res) setLesson((prev) => ({ ...res, participants: keepOrder(prev?.participants, res.participants) }));
    } catch {
      // keep current
    }
  }, [groupLessonId]);

  const doRemove = useCallback(
    (studentId: string) => {
      if (!groupLessonId || !lesson || busy) return;
      // Optimistic: drop the row immediately so it feels instant.
      const prev = lesson;
      const nextParticipants = lesson.participants.filter((p) => p.studentId !== studentId);
      setLesson({
        ...lesson,
        participants: nextParticipants,
        filledSeats: nextParticipants.length,
        openSeats: Math.max(0, lesson.capacity - nextParticipants.length),
      });
      setRemovingId(studentId);
      regloApi
        .removeGroupLessonParticipant(groupLessonId, studentId)
        .then(() => {
          seed?.onChanged?.();
          return refreshLocal();
        })
        .catch((e) => {
          setLesson(prev); // rollback
          Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile rimuovere l’allievo.');
        })
        .finally(() => setRemovingId(null));
    },
    [groupLessonId, lesson, busy, seed, refreshLocal],
  );

  // Presence outcome (present/absent) — no optimistic update: spinner on the
  // tapped pill, then refetch. Correctable any time, incl. after the lesson.
  const setOutcome = useCallback(
    (appointmentId: string, outcome: 'present' | 'absent') => {
      if (!groupLessonId || busy) return;
      setOutcomeBusy(`${appointmentId}:${outcome}`);
      regloApi
        .setGroupLessonSeatOutcome(groupLessonId, appointmentId, outcome)
        .then(() => {
          seed?.onChanged?.();
          return refreshLocal();
        })
        .catch((e) => Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile aggiornare la presenza.'))
        .finally(() => setOutcomeBusy(null));
    },
    [groupLessonId, busy, seed, refreshLocal],
  );

  const markAllPresent = useCallback(() => {
    if (!groupLessonId || busy) return;
    setAllPresentBusy(true);
    regloApi
      .markGroupLessonAllPresent(groupLessonId)
      .then(() => {
        seed?.onChanged?.();
        return refreshLocal();
      })
      .catch((e) => Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile aggiornare le presenze.'))
      .finally(() => setAllPresentBusy(false));
  }, [groupLessonId, busy, seed, refreshLocal]);

  if (!seed || !groupLessonId || !lesson) {
    return <View style={s.root} />;
  }

  const filled = lesson.filledSeats;
  const capacity = lesson.capacity;
  const openSeats = lesson.openSeats;
  const isMoto = lesson.kind === 'moto';
  // Presence accent follows the group type: teal (auto) / orange (moto).
  const presentBg = isMoto ? '#C2410C' : '#0F766E';
  const hasPending = lesson.participants.some((p) => p.attendance === 'pending');

  const handleRemove = (studentId: string, name: string | null) => {
    Alert.alert(
      'Rimuovi allievo',
      `Rimuovere ${name ?? 'questo allievo'} dalla guida di gruppo? Il posto si libera; se sei oltre il limite di disdetta, la guida resta tra le cancellazioni tardive.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Rimuovi', style: 'destructive', onPress: () => doRemove(studentId) },
      ],
    );
  };

  const openAddPicker = async () => {
    if (busy) return;
    try {
      const eligible = await regloApi.getEligibleGroupLessonInvitees(groupLessonId);
      const list = eligible ?? [];
      if (list.length === 0) {
        Alert.alert('Nessun allievo idoneo', 'Non ci sono allievi idonei da aggiungere a questa guida.');
        return;
      }
      optionsPickerStore.set({
        title: 'Aggiungi allievo',
        multi: false,
        selected: [],
        options: list.map((e) => ({ value: e.id, label: e.name ?? 'Allievo', leadingInitials: initialsOf(e.name ?? null) })),
        onConfirm: (values) => {
          const studentId = values[0];
          if (!studentId) return;
          setAdding(true);
          regloApi
            .addGroupLessonParticipant(groupLessonId, studentId)
            .then(() => {
              seed?.onChanged?.();
              return refreshLocal();
            })
            .catch((e) => Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile aggiungere l’allievo.'))
            .finally(() => setAdding(false));
        },
      });
      router.push(optionsPickerPath());
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile caricare gli allievi idonei.');
    }
  };

  const handleInvite = () => {
    if (busy) return;
    setInviting(true);
    regloApi
      .inviteToGroupLesson(groupLessonId)
      .then(() => {
        seed?.onChanged?.();
        return refreshLocal();
      })
      .catch((e) => Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile inviare gli inviti.'))
      .finally(() => setInviting(false));
  };

  // Per-student note: the note lives on the participant's seat appointment, so
  // we reuse the standard appointment-details update. The student sees it in
  // their "Le mie note" section.
  const openNote = (p: GroupLesson['participants'][number]) => {
    if (busy) return;
    notesEditorStore.set({
      title: 'Nota allievo',
      subtitle: `Nota per ${p.studentName ?? 'questo allievo'} — la vedrà nella sua app.`,
      placeholder: 'Scrivi una nota per questo allievo…',
      initial: p.notes ?? '',
      onSave: async (text) => {
        try {
          await regloApi.updateAppointmentDetails(p.appointmentId, { notes: text.trim() });
          seed?.onChanged?.();
          await refreshLocal();
          return true;
        } catch (e) {
          Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile salvare la nota.');
          return false;
        }
      },
    });
    router.push('/(tabs)/home/edit-notes');
  };

  return (
    <View style={[s.root, Platform.OS === 'android' ? { flex: 1 } : { paddingBottom: insets.bottom + 16 }]}>
      {/* Top bar — title + X */}
      <View style={s.topBar}>
        <Text style={s.title}>Partecipanti</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        contentContainerStyle={s.scaffoldBody}
        footer={
          /* Invita allievi idonei — CTA a parte, card "easy" (non primary) */
          <View style={[s.footerWrap, { paddingBottom: insets.bottom + 16 }]}>
            {openSeats > 0 ? (
              <Pressable onPress={handleInvite} disabled={busy} style={({ pressed }) => [s.inviteCard, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}>
                <View style={s.inviteIcon}>
                  {inviting ? <ActivityIndicator size="small" color="#1A1A2E" /> : <Ionicons name="paper-plane-outline" size={20} color="#1A1A2E" />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.inviteTitle}>Invita allievi idonei</Text>
                  <Text style={s.inviteSub}>Apri i {openSeats} {openSeats === 1 ? 'posto libero' : 'posti liberi'} agli allievi idonei</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7CBD1" />
              </Pressable>
            ) : (
              <Text style={s.fullText}>Posti esauriti.</Text>
            )}
          </View>
        }
      >
        <View style={s.subRow}>
          <Text style={s.subtitle}>{filled} su {capacity} posti occupati</Text>
          {lesson.participants.length > 1 && hasPending ? (
            <Pressable onPress={markAllPresent} disabled={busy} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
              {allPresentBusy ? (
                <ActivityIndicator size="small" color={presentBg} />
              ) : (
                <Text style={[s.allPresent, { color: presentBg }]}>Segna tutti presenti</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Roster — FLAT rows on the background (no card) */}
        <View style={s.list}>
        {lesson.participants.length === 0 && !adding ? (
          <Text style={s.emptyText}>Nessun iscritto. Aggiungi un allievo o invia gli inviti.</Text>
        ) : (
          lesson.participants.map((p, idx) => (
            <View key={p.appointmentId} style={removingId === p.studentId ? { opacity: 0.4 } : undefined}>
              {idx > 0 ? <View style={s.divider} /> : null}
              <View style={s.row}>
                <View style={s.avatar}><Text style={s.avatarText}>{initialsOf(p.studentName)}</Text></View>
                <Pressable
                  onPress={() => openNote(p)}
                  disabled={busy}
                  style={({ pressed }) => [{ flex: 1, gap: 2 }, pressed && { opacity: 0.5 }]}
                  accessibilityLabel={p.notes?.trim() ? 'Modifica nota allievo' : 'Aggiungi nota allievo'}
                >
                  <Text style={[s.name, { flex: 0 }]} numberOfLines={1}>{p.studentName ?? 'Allievo'}</Text>
                  {participantMeta(isMoto, p.licenseCategory, p.vehicleName) ? (
                    <Text style={[s.metaLine, isMoto && s.metaLineMoto]} numberOfLines={1}>
                      {participantMeta(isMoto, p.licenseCategory, p.vehicleName)}
                    </Text>
                  ) : null}
                  {p.notes?.trim() ? (
                    <Text style={s.notePreview} numberOfLines={1}>{p.notes.trim()}</Text>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => openNote(p)}
                  disabled={busy}
                  hitSlop={6}
                  style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.4 }]}
                  accessibilityLabel={p.notes?.trim() ? 'Modifica nota allievo' : 'Aggiungi nota allievo'}
                >
                  <Ionicons name={p.notes?.trim() ? 'create' : 'create-outline'} size={19} color={p.notes?.trim() ? '#6B7280' : '#B0B4BD'} />
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(p.studentId, p.studentName)}
                  disabled={busy}
                  hitSlop={6}
                  style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.4 }]}
                  accessibilityLabel="Rimuovi allievo"
                >
                  <Ionicons name="close" size={18} color="#B0B4BD" />
                </Pressable>
              </View>
              {/* Presenza: tint (teal auto / arancio moto) = presente, grigio =
                  assente, nessuno selezionato = da confermare. Correggibile sempre. */}
              <View style={s.attWrap}>
                <Pressable
                  onPress={() => setOutcome(p.appointmentId, 'present')}
                  disabled={busy}
                  style={({ pressed }) => [s.attBtn, p.attendance === 'present' && { backgroundColor: presentBg }, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Segna presente"
                >
                  {outcomeBusy === `${p.appointmentId}:present` ? (
                    <ActivityIndicator size="small" color={p.attendance === 'present' ? '#fff' : '#6B7280'} />
                  ) : (
                    <Text style={[s.attTxt, p.attendance === 'present' && s.attTxtOn]}>Presente</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setOutcome(p.appointmentId, 'absent')}
                  disabled={busy}
                  style={({ pressed }) => [s.attBtn, p.attendance === 'absent' && { backgroundColor: '#52525B' }, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Segna assente"
                >
                  {outcomeBusy === `${p.appointmentId}:absent` ? (
                    <ActivityIndicator size="small" color={p.attendance === 'absent' ? '#fff' : '#6B7280'} />
                  ) : (
                    <Text style={[s.attTxt, p.attendance === 'absent' && s.attTxtOn]}>Assente</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* Pending add — placeholder row with spinner */}
        {adding ? (
          <>
            {lesson.participants.length > 0 ? <View style={s.divider} /> : null}
            <View style={s.row}>
              <View style={s.avatar}><ActivityIndicator size="small" color="#94A3B8" /></View>
              <Text style={[s.name, { color: '#94A3B8' }]}>Aggiunta in corso…</Text>
            </View>
          </>
        ) : null}

        {/* Aggiungi allievo — flat row */}
        {openSeats > 0 && !adding ? (
          <>
            {lesson.participants.length > 0 ? <View style={s.divider} /> : null}
            <Pressable onPress={openAddPicker} disabled={busy} style={({ pressed }) => [s.row, pressed && { opacity: 0.5 }]}>
              <View style={s.addIcon}><Ionicons name="add" size={20} color="#717171" /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={s.name}>Aggiungi allievo</Text>
                <Text style={s.rowSub}>Seleziona un allievo idoneo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          </>
        ) : null}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  scaffoldBody: { gap: 14 },
  footerWrap: { marginTop: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFEFF1', alignItems: 'center', justifyContent: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -8 },
  subtitle: { fontSize: 13, fontWeight: '400', color: '#94A3B8' },
  allPresent: { fontSize: 12.5, fontWeight: '600' },

  // Attendance segmented pill (second line, indented under the name)
  attWrap: { flexDirection: 'row', alignSelf: 'flex-start', marginLeft: 47, marginTop: -1, marginBottom: 8, backgroundColor: '#F1F2F6', borderRadius: 999, padding: 2 },
  attBtn: { minWidth: 92, paddingVertical: 6, paddingHorizontal: 15, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  attTxt: { fontSize: 12.5, fontWeight: '600', color: '#6B7280' },
  attTxtOn: { color: '#FFFFFF' },

  // Flat list (no card)
  list: { marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  addIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  rowSub: { fontSize: 13, fontWeight: '400', color: '#94A3B8' },
  metaLine: { fontSize: 12.5, fontWeight: '500', color: '#0F766E' },
  metaLineMoto: { color: '#C2410C' },
  notePreview: { fontSize: 13, fontWeight: '400', color: '#6B7280' },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E9EBF2', marginLeft: 47 },

  emptyText: { fontSize: 13, fontWeight: '400', color: '#94A3B8', paddingVertical: 8 },

  // Separate CTA — easy white card (not primary)
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
    shadowColor: '#1A1A2E', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    marginTop: 6,
  },
  inviteIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  inviteSub: { fontSize: 13, fontWeight: '400', color: '#94A3B8' },

  fullText: { fontSize: 13, fontWeight: '400', color: '#94A3B8', textAlign: 'center', paddingVertical: 4 },
});
