import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { groupLessonManageStore } from '../../../src/stores/groupLessonManageStore';
import { groupLessonParticipantsStore } from '../../../src/stores/groupLessonParticipantsStore';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { ProgressRing } from '../../../src/components/ProgressRing';
import { SkeletonBlock, SkeletonRing } from '../../../src/components/Skeleton';
import { formatDay, formatTime } from '../../../src/utils/date';
import { transmissionLabel, isMotoLicenseCategory } from '../../../src/utils/license';
import type { GroupLesson } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';

const TEAL_BADGE_BG = '#D1FAE5';
const TEAL_BADGE_FG = '#047857';
// Moto group: orange tint (same style), coherent with the agenda cards.
const MOTO_BADGE_BG = '#FFE7D1';
const MOTO_BADGE_FG = '#C2410C';

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
    <Animated.Text entering={FadeIn.duration(260)} style={s.detailValue} numberOfLines={lines}>
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
  const insets = useSafeAreaInsets();
  const seed = useSyncExternalStore(groupLessonManageStore.subscribe, groupLessonManageStore.get);

  const [lesson, setLesson] = useState<GroupLesson | null>(null);
  const [loading, setLoading] = useState(true);
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
    return <View style={s.sheet} />;
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
  const instructorName = lesson?.instructorName ?? 'Nessun istruttore';

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
      options: vehicles.map((v) => {
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
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
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
    router.push('/(tabs)/home/select-options');
  };

  const openParticipants = () => {
    if (!lesson) return;
    groupLessonParticipantsStore.set({
      groupLessonId,
      lesson,
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
            router.push('/(tabs)/home/select-options');
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

  const bottomPad = insets.bottom + (readOnly ? 24 : 86);

  return (
    <View style={s.sheet}>
      {/* Top action bar — X close */}
      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}>
          <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'close'} size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroOverline}>{readOnly ? 'Dettaglio guida di gruppo' : 'Gestisci guida di gruppo'}</Text>
          <Text style={s.heroName}>{isMoto ? 'Guida di gruppo moto' : 'Guida di gruppo'}</Text>
          {lesson ? (
            <Text style={s.heroMeta}>
              {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)} · {durationMin} min
              {vehiclesEnabled ? ` · ${isMoto ? `${fleet.length} ${fleet.length === 1 ? 'moto' : 'moto'}` : vehicleName}` : ''}
            </Text>
          ) : (
            <Text style={s.heroMeta}>Caricamento…</Text>
          )}
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={[s.statePill, { backgroundColor: isMoto ? MOTO_BADGE_BG : TEAL_BADGE_BG }]}>
              <Text style={[s.statePillText, { color: isMoto ? MOTO_BADGE_FG : TEAL_BADGE_FG }]}>
                {isMoto ? 'GRUPPO MOTO' : 'GRUPPO'} · {openSeats} {openSeats === 1 ? 'posto libero' : 'posti liberi'}
              </Text>
            </View>
          </View>
        </View>

        {/* Posti — teal seats ring centrale */}
        <View style={s.progressBlock}>
          {lesson ? (
            <ProgressRing
              size={132}
              stroke={13}
              progress={filled / Math.max(1, capacity)}
              gradient={isMoto ? ['#FB923C', '#EA580C'] : ['#14B8A6', '#0F766E']}
              innerColor={colors.background}
            >
              <Text style={s.ringCount}>
                {filled}
                <Text style={s.ringTotal}>/{capacity}</Text>
              </Text>
              <Text style={s.ringLabel}>POSTI</Text>
            </ProgressRing>
          ) : (
            <SkeletonRing size={132} stroke={13} />
          )}
        </View>

        {/* Istruttore + Veicolo — righe piatte. Read-only (titolare) = statiche. */}
        <View style={s.detailRows}>
          {readOnly ? (
            <View style={s.detailRow}>
              <View style={s.detailIcon}><Ionicons name="person-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Istruttore</Text>
                <RowValue text={instructorName} loaded={!!lesson} width={150} />
              </View>
            </View>
          ) : (
            <Pressable onPress={openInstructorPicker} disabled={!lesson || busy} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
              <View style={s.detailIcon}><Ionicons name="person-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Istruttore</Text>
                <RowValue text={instructorName} loaded={!!lesson} width={150} />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          )}
          {vehiclesEnabled && isMoto ? (
            /* MOTO group: moto fleet + shared follow car (no single vehicle). */
            <>
              <View style={s.rowDivider} />
              {readOnly ? (
                <View style={s.detailRow}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="motorbike" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Moto della guida</Text>
                    <RowValue text={fleetValue} loaded={!!lesson} width={160} lines={2} />
                  </View>
                </View>
              ) : (
                <Pressable onPress={openFleetPicker} disabled={!lesson || busy} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="motorbike" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Moto della guida</Text>
                    <RowValue text={fleetValue} loaded={!!lesson} width={160} lines={2} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              )}
              <View style={s.rowDivider} />
              {readOnly ? (
                <View style={s.detailRow}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="car-outline" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Auto al seguito</Text>
                    <RowValue text={followCarName} loaded={!!lesson} width={120} />
                  </View>
                </View>
              ) : (
                <Pressable onPress={openFollowCarPicker} disabled={!lesson || busy} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="car-outline" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Auto al seguito</Text>
                    <RowValue text={followCarName} loaded={!!lesson} width={120} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              )}
            </>
          ) : vehiclesEnabled ? (
            <>
              <View style={s.rowDivider} />
              {readOnly ? (
                <View style={s.detailRow}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="car-outline" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicolo</Text>
                    <RowValue text={vehicleName} loaded={!!lesson} width={110} />
                  </View>
                </View>
              ) : (
                <Pressable onPress={openVehiclePicker} disabled={!lesson || busy} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="car-outline" size={24} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicolo</Text>
                    <RowValue text={vehicleName} loaded={!!lesson} width={110} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              )}
            </>
          ) : null}
          {/* Capienza — 3 o 4 posti. Moto: implicita (= numero di moto), riga
              nascosta. Read-only: statica. */}
          {isMoto ? null : (
          <>
          <View style={s.rowDivider} />
          {readOnly ? (
            <View style={s.detailRow}>
              <View style={s.detailIcon}><Ionicons name="people-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Capienza</Text>
                <RowValue text={`${capacity} allievi`} loaded={!!lesson} width={90} />
              </View>
            </View>
          ) : (
            <Pressable onPress={openCapacityPicker} disabled={!lesson || busy} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
              <View style={s.detailIcon}><Ionicons name="people-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Capienza</Text>
                <RowValue text={`${capacity} allievi`} loaded={!!lesson} width={90} />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          )}
          </>
          )}
          {/* Le note ora sono per-allievo: si scrivono dal roster partecipanti
              (ogni iscritto ha la sua nota, visibile all'allievo nella sua app). */}
        </View>

        {/* Partecipanti — card 3D CTA → roster sheet. Read-only = card statica. */}
        {readOnly ? (
          <View style={s.cardCta}>
            <View style={s.cardIcon}><Ionicons name="people-outline" size={22} color="#1A1A2E" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardTitle}>Partecipanti</Text>
              <Text style={s.cardSub} numberOfLines={1}>{filled} su {capacity} iscritti</Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={openParticipants} disabled={!lesson} style={({ pressed }) => [s.cardCta, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}>
            <View style={s.cardIcon}><Ionicons name="people-outline" size={22} color="#1A1A2E" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardTitle}>Partecipanti</Text>
              <Text style={s.cardSub} numberOfLines={1}>{filled} su {capacity} · gestisci iscritti</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7CBD1" />
          </Pressable>
        )}
      </ScrollView>

      {/* Floating bottom toolbar — Sposta · cestino (nascosta in read-only) */}
      {!readOnly && (
        <View style={[s.floatWrap, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <Pressable onPress={openSposta} disabled={!lesson || busy} style={({ pressed }) => [s.spostaPill, pressed && { opacity: 0.85 }]}>
            <MaterialCommunityIcons name="calendar-arrow-right" size={19} color="#1A1A2E" />
            <Text style={s.spostaText}>Sposta</Text>
          </Pressable>
          <Pressable onPress={handleCancel} disabled={!lesson || busy} style={({ pressed }) => [s.trashCircle, pressed && { opacity: 0.85 }]} accessibilityLabel="Annulla guida di gruppo">
            <MaterialCommunityIcons name="trash-can-outline" size={21} color="#E5484D" />
          </Pressable>
        </View>
      )}

      {busy ? (
        <View style={s.busyOverlay} pointerEvents="none">
          <ActivityIndicator color="#1A1A2E" />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFEFF1', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 24 },

  // Hero
  hero: { gap: 4 },
  heroOverline: { fontSize: 13, fontWeight: '500', color: '#94A3B8', letterSpacing: 0.2 },
  heroName: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  heroMeta: { fontSize: 14, fontWeight: '400', color: '#717171', marginTop: 2 },
  statePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  statePillText: { fontSize: 12, fontWeight: '600' },

  // Posti ring centrale
  progressBlock: { alignItems: 'center', paddingVertical: 4 },
  ringCount: { fontSize: 34, fontWeight: '700', color: '#1A1A2E', letterSpacing: -1 },
  ringTotal: { fontSize: 18, fontWeight: '500', color: '#9CA3AF' },
  ringLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: '#94A3B8', marginTop: 4 },

  // Righe piatte istruttore/veicolo
  detailRows: { gap: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  detailIcon: { width: 28, alignItems: 'center' },
  detailBody: { flex: 1, gap: 1 },
  detailLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  detailValue: { fontSize: 14, fontWeight: '400', color: '#717171' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEBEB', marginLeft: 44 },

  // Card 3D CTA partecipanti
  cardCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
    shadowColor: '#1A1A2E', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  cardSub: { fontSize: 13, fontWeight: '400', color: '#717171' },

  // Floating bottom toolbar
  floatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  spostaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 50, paddingHorizontal: 22, borderRadius: 25, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  spostaText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  trashCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },

  busyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 60 },
});
