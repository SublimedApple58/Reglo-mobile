import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { groupLessonParticipantsStore } from '../../../src/stores/groupLessonParticipantsStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { notesEditorStore } from '../../../src/stores/notesEditorStore';
import { regloApi } from '../../../src/services/regloApi';
import type { GroupLesson } from '../../../src/types/regloApi';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClaySection } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';
import { LICENSE_CATEGORY_LABELS } from '../../../src/utils/license';
import {
  describeMotoSwap,
  firstStudentName,
  motoChoicesForSeat,
  MOTO_CHANGE_MESSAGES,
  planMotoChange,
  shortStudentName,
  type MotoFleetVehicle,
  type MotoSeat,
} from '../../../src/utils/groupMoto';

// REG-636 — valore del picker per «A rotazione» (nessuna moto fissa).
const ROTATION = '__rotation__';

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
  // REG-636 — appointmentId of the seat whose moto is being saved.
  const [motoBusyId, setMotoBusyId] = useState<string | null>(null);
  const groupLessonId = seed?.groupLessonId ?? null;
  const motoOnly = seed?.motoOnly === true;
  const busy = !!removingId || adding || inviting || !!outcomeBusy || allPresentBusy || !!motoBusyId;

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

  // REG-636 — save a participant's moto (spinner on the chip, then refetch).
  const saveMoto = useCallback(
    (appointmentId: string, vehicleId: string | null, swapWithAppointmentId: string | null) => {
      if (!groupLessonId) return;
      setMotoBusyId(appointmentId);
      regloApi
        .setGroupLessonParticipantMoto(groupLessonId, { appointmentId, vehicleId, swapWithAppointmentId })
        .then(() => {
          seed?.onChanged?.();
          return refreshLocal();
        })
        .catch((e) => Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile cambiare la moto.'))
        .finally(() => setMotoBusyId(null));
    },
    [groupLessonId, seed, refreshLocal],
  );

  if (!seed || !groupLessonId || !lesson) {
    return <View style={s.empty} />;
  }

  const filled = lesson.filledSeats;
  const capacity = lesson.capacity;
  const openSeats = lesson.openSeats;
  const isMoto = lesson.kind === 'moto';
  const hasPending = lesson.participants.some((p) => p.attendance === 'pending');

  // REG-636 — fleet + seats as the shared planner sees them.
  const motoFleet: MotoFleetVehicle[] = lesson.fleet ?? [];
  const motoSeats: MotoSeat[] = lesson.participants.map((p) => ({
    appointmentId: p.appointmentId,
    vehicleId: p.vehicleId ?? null,
    license: { licenseCategory: p.studentLicenseCategory ?? null, transmission: p.studentTransmission ?? null },
  }));
  const nameOf = (appointmentId: string | null) =>
    lesson.participants.find((p) => p.appointmentId === appointmentId)?.studentName ?? 'Allievo';

  const openMotoPicker = (p: GroupLesson['participants'][number]) => {
    if (busy) return;
    const seat = motoSeats.find((x) => x.appointmentId === p.appointmentId);
    const { choices, incompatibleVehicleIds } = motoChoicesForSeat({
      fleet: motoFleet,
      seats: motoSeats,
      appointmentId: p.appointmentId,
    });
    const studentFirst = firstStudentName(p.studentName);
    const motoLabel = (m: MotoFleetVehicle) => `${m.name}${m.licenseCategory ? ` · ${m.licenseCategory}` : ''}`;
    const incompatible = incompatibleVehicleIds
      .map((id) => motoFleet.find((m) => m.id === id))
      .filter((m): m is MotoFleetVehicle => Boolean(m));
    const footnote = !incompatible.length
      ? null
      : incompatible.length === 1
        ? `La ${incompatible[0].name}${incompatible[0].licenseCategory ? ` (${incompatible[0].licenseCategory})` : ''} non compare: ${studentFirst} non può guidarla.`
        : `${incompatible.length} moto della guida non compaiono: ${studentFirst} non può guidarle.`;

    optionsPickerStore.set({
      title: `Moto di ${studentFirst}`,
      hint: seat?.license.licenseCategory
        ? `Solo le moto di questa guida adatte alla patente ${seat.license.licenseCategory}.`
        : 'Solo le moto di questa guida.',
      multi: false,
      selected: [p.vehicleId ?? ROTATION],
      options: [
        ...choices.map((c) => {
          const moto = motoFleet.find((m) => m.id === c.vehicleId)!;
          const holder = nameOf(c.holderAppointmentId);
          return {
            value: c.vehicleId,
            label: motoLabel(moto),
            subtitle:
              c.state === 'current'
                ? `Assegnata a ${studentFirst}`
                : c.state === 'free'
                  ? 'Libera'
                  : `Con ${shortStudentName(holder)} · scambio`,
            subtitleTone: c.state === 'free' ? ('success' as const) : c.state === 'taken' ? ('accent' as const) : null,
            trailingInitials: c.state === 'taken' ? initialsOf(holder) : null,
          };
        }),
        { value: ROTATION, label: 'A rotazione', subtitle: 'Nessuna moto fissa, si alterna' },
      ],
      footnote,
      onConfirm: (values) => {
        const picked = values[0];
        if (!picked) return;
        const vehicleId = picked === ROTATION ? null : picked;
        const plan = planMotoChange({ fleet: motoFleet, seats: motoSeats, appointmentId: p.appointmentId, vehicleId });
        if (!plan.ok) {
          Alert.alert('Errore', MOTO_CHANGE_MESSAGES[plan.reason]);
          return;
        }
        if (plan.kind === 'noop') return;
        if (plan.kind !== 'swap' || !vehicleId) {
          saveMoto(p.appointmentId, vehicleId, null);
          return;
        }
        const other = lesson.participants.find((o) => o.appointmentId === plan.otherAppointmentId);
        const pickedMoto = motoFleet.find((m) => m.id === vehicleId);
        if (!other || !pickedMoto) return;
        const copy = describeMotoSwap({
          plan,
          moverName: studentFirst,
          otherName: firstStudentName(other.studentName),
          pickedMoto,
          fleet: motoFleet,
          otherLicenseCategory: other.studentLicenseCategory ?? null,
        });
        // The picker form sheet is still dismissing: present the native Alert
        // once it's gone, else iOS attaches it to a disappearing controller.
        setTimeout(() => {
          Alert.alert(copy.title, copy.message, [
            { text: 'Annulla', style: 'cancel' },
            {
              text: copy.confirmLabel,
              style: 'default',
              isPreferred: true,
              onPress: () => saveMoto(p.appointmentId, vehicleId, plan.otherAppointmentId),
            },
          ]);
        }, 450);
      },
    });
    router.push(optionsPickerPath());
  };

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
        options: list.map((e) => ({ value: e.id, label: e.name ?? 'Allievo', leadingInitials: initialsOf(e.name ?? null), leadingUserId: e.id })),
        // Oltre le 8 voci il foglio mostra da solo la ricerca (REG-617): qui
        // si cercano persone, quindi il vuoto lo dice con le loro parole.
        emptyLabel: 'Nessun allievo trovato',
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
      .then((res) => {
        // REG-617 — dire A QUANTI e' l'unica conferma che si vede: gli invii
        // partono dopo la risposta, quindi qui non c'e' piu' niente da
        // attendere e senza un messaggio il bottone sembrerebbe non aver
        // fatto nulla. Alert e non toast: questo e' un form sheet, e un toast
        // ancorato alla safe area della finestra resterebbe a mezz'aria.
        const n = res?.invitedCount ?? 0;
        Alert.alert(
          'Invito inviato',
          n
            ? `Invito inviato a ${n} ${n === 1 ? 'allievo' : 'allievi'}.`
            : "Invito aperto, ma non c'è nessun allievo idoneo da avvisare.",
        );
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

  // REG-423 — open the student's detail card, same navigation the instructor
  // already uses from a single lesson (manage-lesson.tsx → student-detail).
  const openStudentDetail = (p: GroupLesson['participants'][number]) => {
    if (busy) return;
    router.push({
      pathname: '/(tabs)/home/student-detail',
      params: { studentId: p.studentId, name: p.studentName ?? 'Allievo' },
    } as never);
  };

  const showMarkAll = !motoOnly && lesson.participants.length > 1 && hasPending;
  const showAddRow = !motoOnly && openSeats > 0 && !adding;
  const hasRows = lesson.participants.length > 0 || adding || showAddRow;

  return (
    // IL form sheet (FORM_SHEET + FormSheet, REG-639 clay): il roster è una
    // lista clay; presenza = segmentato nero, moto e note in testo semplice.
    <FormSheet
      title="Partecipanti"
      subtitle={`${filled} su ${capacity} posti occupati`}
      testID="group-participants-sheet"
      cta={
        !motoOnly && openSeats > 0 ? (
          <ClayButton
            title="Invita allievi idonei"
            variant="secondary"
            onPress={handleInvite}
            disabled={busy}
            loading={inviting}
            testID="group-participants-invite"
          />
        ) : undefined
      }
    >
      <ClaySection
        title="Iscritti"
        style={s.sec}
        action={
          showMarkAll ? (
            <Pressable
              onPress={markAllPresent}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              testID="group-participants-all-present"
              style={({ pressed }) => pressed && { opacity: 0.5 }}
            >
              {allPresentBusy ? (
                <ActivityIndicator size="small" color={CLAY.ink} />
              ) : (
                <Text style={s.textAction}>Segna tutti presenti</Text>
              )}
            </Pressable>
          ) : undefined
        }
      >
        {lesson.participants.length === 0 && !adding ? (
          <Text style={s.emptyText}>Nessun iscritto. Aggiungi un allievo o invia gli inviti.</Text>
        ) : null}

        {hasRows ? (
          <ClayList>
            {lesson.participants.map((p) => {
              const meta = participantMeta(isMoto, p.licenseCategory, p.vehicleName);
              const note = p.notes?.trim() || null;
              return (
                <ParticipantRow
                  key={p.appointmentId}
                  dimmed={removingId === p.studentId}
                  avatar={<Avatar userId={p.studentId} name={p.studentName ?? 'Allievo'} size={40} />}
                  name={
                    /* REG-423 — il NOME apre la scheda dell'allievo (chevron, come
                       la guida singola). La riga sotto apre la nota. */
                    <Pressable
                      onPress={() => openStudentDetail(p)}
                      disabled={busy || motoOnly}
                      style={({ pressed }) => [s.nameRow, pressed && { opacity: 0.5 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Apri la scheda di ${p.studentName ?? 'allievo'}`}
                    >
                      <Text style={s.name} numberOfLines={1}>{p.studentName ?? 'Allievo'}</Text>
                      {motoOnly ? null : <Ionicons name="chevron-forward" size={15} color={CLAY.chevron} />}
                    </Pressable>
                  }
                  details={
                    isMoto ? (
                      <>
                        {/* REG-636 — la moto si cambia toccandola (apre il picker):
                            testo semplice con la freccina, niente chip. */}
                        <Pressable
                          onPress={() => openMotoPicker(p)}
                          disabled={busy}
                          testID={`moto-chip-${p.appointmentId}`}
                          hitSlop={6}
                          style={({ pressed }) => [s.motoLine, pressed && { opacity: 0.5 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Moto di ${p.studentName ?? 'allievo'}: ${p.vehicleName ?? 'a rotazione'}. Cambia moto`}
                        >
                          <Text style={s.motoText} numberOfLines={1}>
                            {p.vehicleId ? p.vehicleName ?? 'Moto' : 'A rotazione'}
                            {p.vehicleId && p.licenseCategory ? <Text style={s.motoCat}> · {p.licenseCategory}</Text> : null}
                          </Text>
                          {motoBusyId === p.appointmentId ? (
                            <ActivityIndicator size="small" color={CLAY.ink} style={s.motoSpin} />
                          ) : (
                            <Ionicons name="chevron-down" size={13} color={CLAY.ink3} />
                          )}
                        </Pressable>
                        {!motoOnly && note ? (
                          <Pressable
                            onPress={() => openNote(p)}
                            disabled={busy}
                            style={({ pressed }) => pressed && { opacity: 0.5 }}
                            accessibilityLabel="Modifica nota allievo"
                          >
                            <Text style={s.notePreview} numberOfLines={1}>{note}</Text>
                          </Pressable>
                        ) : null}
                      </>
                    ) : meta || note ? (
                      <Pressable
                        onPress={() => openNote(p)}
                        disabled={busy}
                        style={({ pressed }) => [s.detailsCol, pressed && { opacity: 0.5 }]}
                        accessibilityLabel={note ? 'Modifica nota allievo' : 'Aggiungi nota allievo'}
                      >
                        {meta ? <Text style={s.metaLine} numberOfLines={1}>{meta}</Text> : null}
                        {note ? <Text style={s.notePreview} numberOfLines={1}>{note}</Text> : null}
                      </Pressable>
                    ) : null
                  }
                  actions={
                    motoOnly ? null : (
                      <>
                        <Pressable
                          onPress={() => openNote(p)}
                          disabled={busy}
                          hitSlop={6}
                          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.4 }]}
                          accessibilityLabel={note ? 'Modifica nota allievo' : 'Aggiungi nota allievo'}
                        >
                          <Ionicons name={note ? 'create' : 'create-outline'} size={19} color={CLAY.ink3} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemove(p.studentId, p.studentName)}
                          disabled={busy}
                          hitSlop={6}
                          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.4 }]}
                          accessibilityLabel="Rimuovi allievo"
                        >
                          <Ionicons name="close" size={18} color={CLAY.ink3} />
                        </Pressable>
                      </>
                    )
                  }
                  attendance={
                    /* Presenza: nero = scelta, nessuna voce scelta = da confermare.
                       Correggibile sempre. */
                    motoOnly ? null : (
                      <AttendanceSwitch
                        value={p.attendance === 'pending' ? null : p.attendance}
                        busy={outcomeBusy?.startsWith(`${p.appointmentId}:`) ? (outcomeBusy.split(':')[1] as 'present' | 'absent') : null}
                        disabled={busy}
                        onPick={(o) => setOutcome(p.appointmentId, o)}
                      />
                    )
                  }
                />
              );
            })}

            {/* Pending add — riga segnaposto con spinner */}
            {adding ? (
              <ClayListRow
                title="Aggiunta in corso…"
                dimmed
                trailing={<ActivityIndicator size="small" color={CLAY.ink} />}
              />
            ) : null}

            {showAddRow ? (
              <ClayListRow
                title="Aggiungi allievo"
                subtitle="Seleziona un allievo idoneo"
                onPress={() => void openAddPicker()}
                testID="group-participants-add"
              />
            ) : null}
          </ClayList>
        ) : null}
      </ClaySection>

      {!motoOnly ? (
        openSeats > 0 ? (
          // L'articolo cambia col numero: "Apri 1 posto libero", "Apri i 2 posti liberi".
          <Text style={s.inviteNote}>
            {openSeats === 1
              ? 'Apri 1 posto libero agli allievi idonei'
              : `Apri i ${openSeats} posti liberi agli allievi idonei`}
          </Text>
        ) : (
          <Text style={s.inviteNote}>Posti esauriti.</Text>
        )
      ) : null}
    </FormSheet>
  );
}

/**
 * Riga del roster dentro una `ClayList` (che le passa `divider`): volto, nome
 * (apre la scheda), dettagli (moto/patente/nota), comandi e, sotto, la presenza.
 */
function ParticipantRow({
  avatar,
  name,
  details,
  actions,
  attendance,
  dimmed,
  divider,
}: {
  avatar: React.ReactNode;
  name: React.ReactNode;
  details?: React.ReactNode;
  actions?: React.ReactNode;
  attendance?: React.ReactNode;
  dimmed?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[s.pRow, dimmed && { opacity: 0.4 }]}>
      {divider ? <View style={s.pDivider} /> : null}
      <View style={s.pTop}>
        {avatar}
        <View style={s.pMain}>
          {name}
          {details}
        </View>
        {actions}
      </View>
      {attendance ? <View style={s.pAttendance}>{attendance}</View> : null}
    </View>
  );
}

/**
 * Presente/Assente: binario incavato come `ClaySegmented`, ma con lo stato
 * «da confermare» (nessuna voce scelta) e la scelta che arriva solo dalla
 * risposta del BE (spinner sulla voce toccata, niente optimistic update).
 */
function AttendanceSwitch({
  value,
  busy,
  disabled,
  onPick,
}: {
  value: 'present' | 'absent' | null;
  busy: 'present' | 'absent' | null;
  disabled: boolean;
  onPick: (o: 'present' | 'absent') => void;
}) {
  const opts = [
    { v: 'present' as const, label: 'Presente', a11y: 'Segna presente' },
    { v: 'absent' as const, label: 'Assente', a11y: 'Segna assente' },
  ];
  return (
    <View style={[s.attTrack, CLAY_SHADOW.sink]}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={o.v}
            onPress={() => onPick(o.v)}
            disabled={disabled}
            style={({ pressed }) => [s.attItem, pressed && !on && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={o.a11y}
          >
            {on ? (
              <Animated.View
                entering={SOFT_SWAP_IN}
                exiting={SOFT_SWAP_OUT}
                style={[StyleSheet.absoluteFill, s.attThumb, CLAY_SHADOW.ink]}
              />
            ) : null}
            {busy === o.v ? (
              <ActivityIndicator size="small" color={on ? '#FFFFFF' : CLAY.ink3} />
            ) : (
              <Text style={[s.attTxt, on && s.attTxtOn]}>{o.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const ATT_H = 36;
const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  sec: { marginTop: 0 },
  textAction: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  emptyText: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 2, marginBottom: 14 },

  // Riga partecipante
  pRow: { paddingHorizontal: 18, paddingVertical: 12 },
  pDivider: { position: 'absolute', top: 0, left: 72, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  pTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  pMain: { flex: 1, minWidth: 0, gap: 3, paddingTop: 1 },
  pAttendance: { marginLeft: 54, marginTop: 10 },
  name: { flexShrink: 1, fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%' },
  detailsCol: { gap: 2 },
  metaLine: { fontSize: 13.5, color: CLAY.ink3 },
  // REG-636 — moto in testo semplice con freccina (apre il picker).
  motoLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, maxWidth: '100%' },
  motoText: { flexShrink: 1, fontSize: 13.5, fontWeight: '500', color: CLAY.ink2 },
  motoCat: { fontWeight: '400', color: CLAY.ink3 },
  motoSpin: { transform: [{ scale: 0.7 }] },
  notePreview: { fontSize: 13.5, color: CLAY.ink3 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Presenza
  attTrack: {
    flexDirection: 'row', alignSelf: 'flex-start', height: ATT_H, borderRadius: ATT_H / 2,
    backgroundColor: CLAY.surface, padding: 3,
  },
  attItem: { minWidth: 96, paddingHorizontal: 14, borderRadius: (ATT_H - 6) / 2, alignItems: 'center', justifyContent: 'center' },
  attThumb: { borderRadius: (ATT_H - 6) / 2, backgroundColor: CLAY.ink },
  attTxt: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.1 },
  attTxtOn: { color: '#FFFFFF', fontWeight: '600' },

  inviteNote: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 14, paddingHorizontal: 4 },
});
