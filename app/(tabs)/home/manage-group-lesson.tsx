import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';

import { groupLessonManageStore } from '../../../src/stores/groupLessonManageStore';
import { groupLessonParticipantsStore } from '../../../src/stores/groupLessonParticipantsStore';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClayStat } from '../../../src/components/clay';
import { formatDay, formatTime } from '../../../src/utils/date';
import { transmissionLabel, isMotoLicenseCategory } from '../../../src/utils/license';
import { asMotoLessonType, MOTO_LESSON_TYPE_LABELS } from '../../../src/utils/motoLessonType';
import type { GroupLesson } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';
import { coInstructorPickerStore } from '../../../src/stores/coInstructorPickerStore';

const DURATIONS: { value: string; label: string }[] = [
  { value: '60', label: '1 ora' },
  { value: '120', label: '2 ore' },
  { value: '180', label: '3 ore' },
  { value: '240', label: '4 ore' },
];

const durationOf = (startIso: string, endIso: string | null) => {
  if (!endIso) return 180;
  return Math.max(60, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
};

/**
 * Detail-row value: pulsing skeleton while the lesson detail loads, then the
 * real text fades in (instead of popping in abruptly).
 */
const RowValue = ({ text, loaded, width, lines = 1 }: { text: string; loaded: boolean; width: number; lines?: number }) =>
  loaded ? (
    <Animated.Text entering={FadeIn.duration(260)} style={s.rowValue} numberOfLines={lines}>
      {text}
    </Animated.Text>
  ) : (
    <SkeletonBlock width={width} height={13} radius={7} style={{ marginTop: 3, marginBottom: 2 }} />
  );

const pad = (n: number) => String(n).padStart(2, '0');
const toDateOnly = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function ManageGroupLessonScreen() {
  const router = useRouter();
  const seed = useSyncExternalStore(groupLessonManageStore.subscribe, groupLessonManageStore.get);

  const [lesson, setLesson] = useState<GroupLesson | null>(null);
  const [, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const groupLessonId = seed?.groupLessonId ?? null;

  const reload = useCallback(async () => {
    if (!groupLessonId) return;
    try {
      const res = await regloApi.getGroupLesson(groupLessonId);
      setLesson(res ?? null);
    } catch {
      // keep whatever is on screen
    } finally {
      setLoading(false);
    }
  }, [groupLessonId]);

  // Initial load.
  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // Re-load when returning from a stacked sheet (picker / roster) in case it changed something.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  // Tell the parent when this route is dismissed (popped), then clear the store.
  useEffect(() => {
    return () => {
      groupLessonManageStore.get()?.onClosed?.();
      groupLessonManageStore.clear();
      groupLessonParticipantsStore.clear();
    };
  }, []);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        seed?.onChanged?.();
        await reload();
        return true;
      } catch (e) {
        Alert.alert('Errore', e instanceof Error ? e.message : 'Operazione non riuscita.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload, seed],
  );

  if (!seed || !groupLessonId) {
    return <View style={s.empty} />;
  }

  const instructors = seed.instructors;
  const vehicles = seed.vehicles;
  const vehiclesEnabled = seed.vehiclesEnabled;
  const readOnly = seed.readOnly === true;

  const filled = lesson?.filledSeats ?? 0;
  const capacity = lesson?.capacity ?? 3;
  const openSeats = lesson?.openSeats ?? Math.max(0, capacity - filled);
  const durationMin = lesson ? durationOf(lesson.startsAt, lesson.endsAt) : 180;
  const vehicleName = lesson?.vehicleName ?? 'Nessun veicolo';
  // REG-585: se la guida e' condivisa si leggono tutti, non solo il primo.
  const isShared = (lesson?.coInstructors?.length ?? 0) > 0;
  // Stato vuoto esplicito: "Nessuno" da solo non dice che si puo' aggiungere.
  const coInstructorsValue = isShared
    ? (lesson?.coInstructors ?? []).map((c) => c.name).join(' + ')
    : 'Nessuno · tocca per aggiungere';

  // Moto group: the container has NO single vehicle (fleet + shared follow car).
  // Show/edit the moto fleet and the follow car instead of a single "Veicolo".
  const isMoto = lesson?.kind === 'moto';
  const fleet = lesson?.fleet ?? [];
  const fleetValue = fleet.length
    ? fleet.map((f) => f.name).join(', ')
    : 'Nessuna moto';
  const followCarName = lesson?.followVehicleName ?? 'Nessuna';
  // Picker pools, derived from the instructor-accessible vehicles in the seed.
  const motoVehicles = vehicles.filter((v) => isMotoLicenseCategory(v.licenseCategory));
  const followCars = vehicles.filter((v) => v.licenseCategory === 'B');
  // Standard group vehicle = a CAR (motos live in the moto flow only).
  const standardVehicles = vehicles.filter((v) => !isMotoLicenseCategory(v.licenseCategory));

  // REG-585: assegnare/togliere i colleghi anche dal telefono, stessa azione
  // dei chip nel dialogo web. `run` e' la stessa scorciatoia usata dalle altre
  // modifiche: chiama il BE e ricarica la guida.
  const openCoInstructorPicker = () => {
    if (!lesson) return;
    coInstructorPickerStore.set({
      mainInstructorId: lesson.instructorId ?? null,
      selectedIds: (lesson.coInstructors ?? []).map((c) => c.id),
      subtitle: 'Chi porta questa guida di gruppo insieme al principale.',
      // Volutamente NON passa da `run`: quello intercetta l'errore con un
      // Alert, e un Alert sopra il foglio di scelta e' sgradevole. Qui
      // l'eccezione deve risalire, cosi' la riga torna com'era e il messaggio
      // compare dentro il foglio.
      onToggle: async (nextIds) => {
        await regloApi.updateGroupLesson({ groupLessonId, coInstructorIds: nextIds });
        seed?.onChanged?.();
        await reload();
      },
    });
    router.push('/(tabs)/home/manage-co-instructors');
  };

  const openInstructorPicker = () => {
    if (!lesson) return;
    instructorPickerStore.set({
      currentInstructorId: lesson.instructorId ?? null,
      selectedInstructorId: lesson.instructorId ?? null,
      onSelect: (it) => {
        if (it.id === lesson.instructorId) return;
        run(() => regloApi.updateGroupLesson({ groupLessonId, instructorId: it.id }));
      },
    });
    router.push('/(tabs)/home/manage-lesson-instructor');
  };

  const openVehiclePicker = () => {
    if (!lesson) return;
    optionsPickerStore.set({
      title: 'Veicolo',
      multi: false,
      selected: lesson.vehicleId ? [lesson.vehicleId] : [],
      options: standardVehicles.map((v) => {
        const tx = transmissionLabel(v.transmission);
        const instructorName = v.assignedInstructorId
          ? instructors.find((i) => i.id === v.assignedInstructorId)?.name ?? null
          : null;
        const license = [v.licenseCategory, tx || null].filter(Boolean).join(' · ');
        const subtitle =
          [license || null, instructorName].filter(Boolean).join(' · ') || null;
        return {
          value: v.id,
          label: v.name,
          subtitle,
        };
      }),
      onConfirm: (values) => {
        const next = values[0] ?? null;
        if (next === lesson.vehicleId) return;
        run(() => regloApi.updateGroupLesson({ groupLessonId, vehicleId: next }));
      },
    });
    router.push(optionsPickerPath());
  };

  // Moto group: edit the moto fleet. Capacity follows the fleet size (mirror of
  // the create flow). The BE refuses dropping a moto already assigned to a
  // participant, and a capacity below the enrolled count.
  const openFleetPicker = () => {
    if (!lesson) return;
    optionsPickerStore.set({
      title: 'Moto della guida',
      multi: true,
      selected: fleet.map((f) => f.id),
      options: motoVehicles.map((v) => ({
        value: v.id,
        label: v.name,
        subtitle: [v.plate, v.licenseCategory].filter(Boolean).join(' · ') || null,
      })),
      onConfirm: (values) => {
        if (!values.length) {
          Alert.alert('Moto', 'Seleziona almeno una moto per la guida di gruppo.');
          return;
        }
        // La capienza è indipendente dalla flotta (i ragazzi possono alternarsi).
        run(() => regloApi.updateGroupLesson({ groupLessonId, vehicleIds: values }));
      },
    });
    router.push(optionsPickerPath());
  };

  // Moto group: edit the shared follow car (category B). "Nessuna" clears it.
  const openFollowCarPicker = () => {
    if (!lesson) return;
    optionsPickerStore.set({
      title: 'Auto al seguito',
      multi: false,
      selected: lesson.followVehicleId ? [lesson.followVehicleId] : ['__none__'],
      options: [
        { value: '__none__', label: 'Nessuna' },
        ...followCars.map((v) => ({
          value: v.id,
          label: v.name,
          subtitle: [v.plate, transmissionLabel(v.transmission) || null].filter(Boolean).join(' · ') || null,
        })),
      ],
      onConfirm: (values) => {
        const raw = values[0] ?? '__none__';
        const next = raw === '__none__' ? null : raw;
        if (next === (lesson.followVehicleId ?? null)) return;
        run(() => regloApi.updateGroupLesson({ groupLessonId, followVehicleId: next }));
      },
    });
    router.push(optionsPickerPath());
  };

  // Capienza libera (1–12) — auto-save come istruttore/veicolo; il BE rifiuta
  // se inferiore agli iscritti attuali (le opzioni sotto gli iscritti sono
  // marcate come non disponibili).
  const openCapacityPicker = () => {
    if (!lesson) return;
    optionsPickerStore.set({
      title: 'Capienza',
      multi: false,
      selected: [String(capacity)],
      options: Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        return {
          value: String(n),
          label: `${n} ${n === 1 ? 'allievo' : 'allievi'}`,
          subtitle: n < filled ? `Non disponibile: ${filled} iscritti` : null,
        };
      }),
      onConfirm: (values) => {
        const next = Number(values[0] ?? capacity);
        if (!next || next === capacity) return;
        run(() => regloApi.updateGroupLesson({ groupLessonId, capacity: next }));
      },
    });
    router.push(optionsPickerPath());
  };

  const openParticipants = () => {
    if (!lesson) return;
    groupLessonParticipantsStore.set({
      groupLessonId,
      lesson,
      // REG-636 — il titolare in sola lettura apre il roster solo per le moto.
      motoOnly: readOnly,
      onChanged: () => {
        seed.onChanged?.();
        reload();
      },
    });
    router.push('/(tabs)/home/manage-group-lesson-participants');
  };

  // Sposta: pick date → time → duration → updateGroupLesson (applies to all).
  const openSposta = () => {
    if (!lesson) return;
    dayPickerStore.set({
      selectedDate: toDateOnly(lesson.startsAt),
      markedDates: new Set(),
      monthsBack: 1,
      monthsCount: 12,
      allowPast: false,
      title: 'Sposta · data',
      onSelect: (dateStr) => {
        // After date, pick the time.
        const base = new Date(lesson.startsAt);
        timePickerStore.set({
          selectedTime: base,
          onConfirm: (timeDate) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const start = new Date(y, m - 1, d, timeDate.getHours(), timeDate.getMinutes(), 0, 0);
            // Then the duration.
            optionsPickerStore.set({
              title: 'Sposta · durata',
              multi: false,
              selected: [String(durationOf(lesson.startsAt, lesson.endsAt))],
              options: DURATIONS,
              onConfirm: (values) => {
                const mins = Number(values[0] ?? '180');
                const end = new Date(start.getTime() + mins * 60 * 1000);
                run(() =>
                  regloApi.updateGroupLesson({
                    groupLessonId,
                    startsAt: start.toISOString(),
                    endsAt: end.toISOString(),
                  }),
                );
              },
            });
            router.push(optionsPickerPath());
          },
        });
        router.push('/(tabs)/home/time-picker');
      },
    });
    router.push('/(tabs)/home/select-date');
  };

  const handleCancel = () => {
    Alert.alert(
      'Annulla guida di gruppo',
      'Tutti i partecipanti verranno avvisati e la guida rimossa. Procedere?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sì, annulla',
          style: 'destructive',
          onPress: async () => {
            const ok = await run(() => regloApi.cancelGroupLesson(groupLessonId));
            if (ok) router.back();
          },
        },
      ],
    );
  };

  // Le righe restano premibili (chevron fermo) ma non fanno nulla finché la
  // guida non è caricata o mentre un salvataggio è in corso.
  const guard = (fn: () => void) => () => {
    if (!lesson || busy) return;
    fn();
  };
  const motoType = asMotoLessonType(lesson?.motoLessonType);

  return (
    // IL form sheet (FORM_SHEET + FormSheet, REG-639 clay): righe di testo in
    // liste clay, posti come numeri, «Sposta» e «Annulla» in fondo.
    <FormSheet
      title={isMoto ? 'Guida di gruppo moto' : 'Guida di gruppo'}
      subtitle={
        lesson
          ? `${formatDay(lesson.startsAt)} · ${formatTime(lesson.startsAt)} · ${durationMin} min`
          : 'Caricamento…'
      }
      testID="manage-group-lesson-sheet"
      cta={
        readOnly ? undefined : (
          <View style={s.ctaCol}>
            <ClayButton
              title="Sposta"
              variant="secondary"
              onPress={openSposta}
              disabled={!lesson || busy}
              testID="group-lesson-move"
            />
            <Pressable
              onPress={handleCancel}
              disabled={!lesson || busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Annulla guida di gruppo"
              testID="group-lesson-cancel"
              style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.5 }, (!lesson || busy) && { opacity: 0.4 }]}
            >
              <Text style={s.cancelText}>Annulla guida di gruppo</Text>
            </Pressable>
          </View>
        )
      }
    >
      {/* Posti: due numeri al posto dell'anello colorato e della pillola. */}
      <View style={s.stats}>
        <ClayStat value={lesson ? `${filled}/${capacity}` : '–'} label="Iscritti" />
        <ClayStat value={lesson ? openSeats : '–'} label={openSeats === 1 ? 'Posto libero' : 'Posti liberi'} />
      </View>

      {/* Istruttore, veicoli, capienza. Read-only (titolare) = righe statiche. */}
      <ClayList style={s.block}>
        <ClayListRow
          title="Istruttore"
          subtitle={<RowValue text={lesson?.instructorName ?? 'Nessun istruttore'} loaded={!!lesson} width={150} />}
          onPress={readOnly ? undefined : guard(openInstructorPicker)}
          testID="group-lesson-instructor"
        />
        {/* REG-585: i colleghi, assegnabili anche dal telefono. In sola lettura
            la riga compare solo se ce ne sono. */}
        {!readOnly || isShared ? (
          <ClayListRow
            title="Altri istruttori"
            subtitle={<RowValue text={coInstructorsValue} loaded={!!lesson} width={120} lines={2} />}
            onPress={readOnly ? undefined : guard(openCoInstructorPicker)}
            testID="group-lesson-co-instructors"
          />
        ) : null}
        {/* MOTO group: moto fleet + shared follow car (no single vehicle). */}
        {vehiclesEnabled && isMoto ? (
          <ClayListRow
            title="Moto della guida"
            subtitle={<RowValue text={fleetValue} loaded={!!lesson} width={160} lines={2} />}
            onPress={readOnly ? undefined : guard(openFleetPicker)}
            testID="group-lesson-fleet"
          />
        ) : null}
        {vehiclesEnabled && isMoto ? (
          <ClayListRow
            title="Auto al seguito"
            subtitle={<RowValue text={followCarName} loaded={!!lesson} width={120} />}
            onPress={readOnly ? undefined : guard(openFollowCarPicker)}
            testID="group-lesson-follow-car"
          />
        ) : null}
        {/* Tipo guida moto (birilli/strada) — sola lettura: si sceglie in
            creazione (mirror della guida moto singola), si modifica dal web. */}
        {vehiclesEnabled && isMoto && motoType ? (
          <ClayListRow title="Tipo guida moto" subtitle={MOTO_LESSON_TYPE_LABELS[motoType]} />
        ) : null}
        {vehiclesEnabled && !isMoto ? (
          <ClayListRow
            title="Veicolo"
            subtitle={<RowValue text={vehicleName} loaded={!!lesson} width={110} />}
            onPress={readOnly ? undefined : guard(openVehiclePicker)}
            testID="group-lesson-vehicle"
          />
        ) : null}
        {/* Capienza. Moto: implicita (= numero di moto), riga nascosta. */}
        {isMoto ? null : (
          <ClayListRow
            title="Capienza"
            subtitle={<RowValue text={`${capacity} allievi`} loaded={!!lesson} width={90} />}
            onPress={readOnly ? undefined : guard(openCapacityPicker)}
            testID="group-lesson-capacity"
          />
        )}
        {/* Le note ora sono per-allievo: si scrivono dal roster partecipanti
            (ogni iscritto ha la sua nota, visibile all'allievo nella sua app). */}
      </ClayList>

      {/* Partecipanti → roster. Read-only = riga statica, tranne il gruppo moto
          (REG-636: il titolare apre il roster solo per scegliere le moto). */}
      <ClayList style={s.block}>
        <ClayListRow
          title="Partecipanti"
          subtitle={
            readOnly && isMoto
              ? `${filled} su ${capacity} iscritti · scegli le moto`
              : readOnly
                ? `${filled} su ${capacity} iscritti`
                : `${filled} su ${capacity} · gestisci iscritti`
          }
          onPress={
            readOnly && !isMoto
              ? undefined
              : openParticipants
          }
          testID="group-lesson-participants"
        />
      </ClayList>

      {busy ? (
        <View style={s.busy} pointerEvents="none">
          <ActivityIndicator color={CLAY.ink} />
        </View>
      ) : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  stats: { flexDirection: 'row', gap: 12 },
  block: { marginTop: 18 },
  rowValue: { fontSize: 13.5, color: CLAY.ink3, flexShrink: 1 },
  ctaCol: { gap: 10 },
  cancelBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  cancelText: { fontSize: 15.5, fontWeight: '500', color: '#C13515', letterSpacing: -0.2 },
  busy: { alignItems: 'center', paddingTop: 16 },
});
