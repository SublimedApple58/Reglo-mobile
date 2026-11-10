import React, { memo, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingFlowStore, type BookingFlowState } from '../../../src/stores/bookingFlowStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayIconButton,
  ClayList,
  ClaySection,
  ClaySegmented,
  CLAY_ROW_PRESSED,
  clayRowPadding,
  markClayRow,
  type ClayRowPosition,
} from '../../../src/components/clay';
import { CALENDAR_WEEKDAYS } from '../../../src/components/ScrollableMonthsCalendar';
import { useSession } from '../../../src/context/SessionContext';
import { useBookingOptions } from '../../../src/hooks/queries/useBookingOptions';
import { resolveStudentBookingPolicy } from '../../../src/utils/studentBookingPolicy';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';

/**
 * «Prenota una guida» (allievo) — clay (anteprima approvata mob-8a, 10/11/2026):
 * IL form sheet, righe Giorno / Tipo / Istruttore con valore e chevron (Tipo e
 * Istruttore aprono il picker condiviso con le spunte), Durata col segmentato,
 * CTA nera «Cerca orari» con lo spinner. Stato e callback restano nel
 * `bookingFlowStore` (li semina `AllievoHomeScreen`).
 */

const formatLessonType = (value: string | null | undefined) => {
  const map: Record<string, string> = {
    manovre: 'Manovre', urbano: 'Urbano', extraurbano: 'Extraurbano',
    notturna: 'Notturna', autostrada: 'Autostrada', guida: 'Guida',
  };
  return map[(value ?? '').trim().toLowerCase()] ?? value ?? 'Guida';
};

const WEEKDAYS_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS_LONG = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
/** «Giovedì 13 novembre» */
const formatLongDay = (d: Date) => `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;

/** Oltre queste voci la durata passa dal segmentato a una riga con il picker. */
const MAX_SEGMENTS = 4;
const ALL_INSTRUCTORS = '__all__';

// YYYY-MM-DD (matches the backend date-availability map keys).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Recompute the visible instructor list from the live date. A missing
// `instructorsByDate` entry on a LOADED date means no instructor is available
// that day; a date not yet in `availabilityDates` means "still loading" → all.
const computeVisibleInstructors = (s: BookingFlowState) => {
  if (!s.canSelectInstructor || !s.instructors.length) return s.instructors;
  const key = ymd(s.preferredDate);
  if (!(key in s.availabilityDates)) return s.instructors;
  const ids = s.instructorsByDate[key] ?? [];
  return s.instructors.filter((i) => ids.includes(i.id));
};

const FADE = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);

export default function BookingFlowScreen() {
  const router = useRouter();
  const live = useSyncExternalStore(bookingFlowStore.subscribe, bookingFlowStore.get);
  // Alla chiusura il genitore svuota lo store mentre il foglio sta ancora
  // scendendo: si continua a mostrare l'ultimo stato (niente foglio vuoto).
  const lastRef = useRef(live);
  if (live) lastRef.current = live;
  const data = live ?? lastRef.current;

  // Prenotazione «solo eccezioni» con l'ultimo minuto: il server filtra già gli
  // orari, qui lo si dice soltanto (stessa cache di React Query della home).
  const { user } = useSession();
  const bookingOptions = useBookingOptions(user?.id ?? null);
  const policy = resolveStudentBookingPolicy(bookingOptions.data);
  const lastMinuteOnly = !!policy && !policy.hold && policy.mode === 'exceptions' && policy.exceptions.lastMinute;
  const lastMinuteUntil = lastMinuteOnly && policy?.lastMinuteUntil ? new Date(policy.lastMinuteUntil) : null;

  // Don't clear store on unmount — booking-slots reads from it.
  // Store is cleared by onClose callback when navigating back to home.

  // If the selected instructor is no longer available on the chosen date, fall
  // back to "Tutti" so the search isn't filtered by an unavailable instructor.
  useEffect(() => {
    const d = bookingFlowStore.get();
    if (!d || !d.canSelectInstructor || d.isLockedToInstructor || !d.selectedInstructorId) return;
    const visibleIds = computeVisibleInstructors(d).map((i) => i.id);
    if (visibleIds.length && !visibleIds.includes(d.selectedInstructorId)) {
      bookingFlowStore.set({ selectedInstructorId: null });
    }
  }, [
    data?.preferredDate,
    data?.instructors,
    data?.instructorsByDate,
    data?.availabilityDates,
    data?.selectedInstructorId,
    data?.canSelectInstructor,
    data?.isLockedToInstructor,
  ]);

  if (!data) return <View style={s.empty} />;

  const {
    preferredDate, durationMinutes, selectedLessonTypes, selectedInstructorId,
    loading, searchError,
    availableDurations, availableLessonTypes, canSelectLessonType, canSelectInstructor,
    isLockedToInstructor, assignedInstructorName,
    calendarOpen, unavailableDatesSet,
    onSearchSlots, onClose,
  } = data;

  // Reactive to the in-sheet date — NOT the value seeded when the sheet opened.
  const visibleInstructors = computeVisibleInstructors(data);

  // Recompute availability from current preferredDate + unavailableDatesSet
  const dateKey = `${preferredDate.getFullYear()}-${preferredDate.getMonth()}-${preferredDate.getDate()}`;
  const isDateAvailable = !unavailableDatesSet.has(dateKey);

  const handleClose = () => { router.back(); onClose(); };

  // ── Tipo: scelta multipla (almeno uno) nel picker condiviso ──
  const allTypesSelected =
    availableLessonTypes.length > 1 && availableLessonTypes.every((t) => selectedLessonTypes.includes(t));
  const typeValue = allTypesSelected
    ? 'Qualsiasi'
    : selectedLessonTypes.map(formatLessonType).join(', ') || 'Qualsiasi';
  const openTypes = () => {
    optionsPickerStore.set({
      title: 'Tipo di guida',
      hint: 'Puoi sceglierne più di uno.',
      options: availableLessonTypes.map((lt) => ({ value: lt, label: formatLessonType(lt) })),
      selected: selectedLessonTypes,
      multi: true,
      onConfirm: (values) => {
        if (values.length) bookingFlowStore.set({ selectedLessonTypes: values });
      },
    });
    router.push(optionsPickerPath());
  };

  // ── Istruttore: scelta singola, «Qualsiasi» se più di uno ──
  const showInstructorPicker = !isLockedToInstructor && canSelectInstructor && visibleInstructors.length > 0;
  const selectedInstructor = visibleInstructors.find((i) => i.id === selectedInstructorId) ?? null;
  const instructorValue = selectedInstructor?.name
    ?? (visibleInstructors.length === 1 ? visibleInstructors[0].name : 'Qualsiasi');
  const openInstructors = () => {
    optionsPickerStore.set({
      title: 'Istruttore',
      hint: visibleInstructors.length < 10
        ? 'Solo gli istruttori disponibili per questo giorno.'
        : 'Se non scegli, vedrai gli orari di tutti gli istruttori.',
      options: [
        ...(visibleInstructors.length > 1 ? [{ value: ALL_INSTRUCTORS, label: 'Qualsiasi' }] : []),
        ...visibleInstructors.map((i) => ({ value: i.id, label: i.name })),
      ],
      selected: [selectedInstructorId ?? ALL_INSTRUCTORS],
      multi: false,
      onConfirm: ([value]) => {
        bookingFlowStore.set({ selectedInstructorId: !value || value === ALL_INSTRUCTORS ? null : value });
      },
    });
    router.push(optionsPickerPath());
  };

  // ── Durata: segmentato (2–4 voci), riga con picker oltre, testo se una sola ──
  const durationLabel = (d: number) => `${d} min`;
  const durationSegmented = availableDurations.length > 1 && availableDurations.length <= MAX_SEGMENTS;
  const openDurations = () => {
    optionsPickerStore.set({
      title: 'Durata',
      options: availableDurations.map((d) => ({ value: String(d), label: durationLabel(d) })),
      selected: [String(durationMinutes)],
      multi: false,
      onConfirm: ([value]) => {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) bookingFlowStore.set({ durationMinutes: n });
      },
    });
    router.push(optionsPickerPath());
  };

  const notice = !isDateAvailable
    ? 'Nessuna disponibilità per il giorno scelto. Prova un altro giorno.'
    : searchError && !loading
      ? searchError
      : null;

  const subtitle = lastMinuteOnly
    ? `Puoi prenotare tu solo le guide entro ${policy!.exceptions.lastMinuteHours} ore`
    : 'Scegli giorno e durata';

  return (
    <>
      <FormSheet
        title="Prenota una guida"
        subtitle={subtitle}
        testID="booking-flow-sheet"
        onClose={handleClose}
        closeOnGesture
        busy={loading}
        cta={
          <ClayButton
            title="Cerca orari"
            onPress={onSearchSlots}
            loading={loading}
            disabled={!isDateAvailable}
            testID="booking-flow-search"
          />
        }
      >
        <ClayList>
          <KeyValueRow
            label="Giorno"
            value={formatLongDay(preferredDate)}
            strong
            onPress={() => bookingFlowStore.set({ calendarOpen: true })}
            testID="booking-flow-day"
          />
          {canSelectLessonType && availableLessonTypes.length > 1 ? (
            <KeyValueRow label="Tipo" value={typeValue} onPress={openTypes} testID="booking-flow-type" />
          ) : null}
          {isLockedToInstructor && assignedInstructorName ? (
            <KeyValueRow label="Istruttore" value={assignedInstructorName} testID="booking-flow-instructor" />
          ) : showInstructorPicker ? (
            <KeyValueRow
              label="Istruttore"
              value={instructorValue}
              onPress={visibleInstructors.length > 1 ? openInstructors : undefined}
              testID="booking-flow-instructor"
            />
          ) : null}
          {availableDurations.length === 1 ? (
            <KeyValueRow label="Durata" value={durationLabel(availableDurations[0])} />
          ) : !durationSegmented && availableDurations.length > 0 ? (
            <KeyValueRow
              label="Durata"
              value={durationLabel(durationMinutes)}
              onPress={openDurations}
              testID="booking-flow-duration"
            />
          ) : null}
        </ClayList>

        {durationSegmented ? (
          <ClaySection title="Durata" style={s.section}>
            <ClaySegmented
              options={availableDurations.map((d) => ({ value: d, label: durationLabel(d), testID: `booking-duration-${d}` }))}
              value={durationMinutes}
              onChange={(d) => bookingFlowStore.set({ durationMinutes: d })}
              testID="booking-flow-duration"
            />
          </ClaySection>
        ) : null}

        {notice ? (
          <Animated.Text key={notice} entering={FADE} style={s.notice} testID="booking-flow-notice">
            {notice}
          </Animated.Text>
        ) : null}
      </FormSheet>

      <BookingDayCalendar visible={calendarOpen} data={data} lastMinuteUntil={lastMinuteUntil} />
    </>
  );
}

/**
 * Riga chiave → valore dell'anteprima: etichetta grigia a sinistra, valore a
 * destra (nero se `strong`), chevron se si preme.
 */
const KeyValueRow = markClayRow(function KeyValueRow({
  label,
  value,
  strong,
  onPress,
  testID,
  divider,
  first,
  last,
}: ClayRowPosition & {
  label: string;
  value: string;
  strong?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const body = (
    <>
      {divider ? <View style={s.divider} /> : null}
      <Text style={s.kvLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.kvValue, strong && s.kvValueStrong]} numberOfLines={1}>{value}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} /> : null}
    </>
  );
  if (!onPress) {
    return <View style={[s.kvRow, clayRowPadding({ first, last }, KV_PAD)]} testID={testID}>{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.kvRow, clayRowPadding({ first, last }, KV_PAD), pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      testID={testID}
    >
      {body}
    </Pressable>
  );
});

/**
 * Scelta del giorno. Resta un modale proprio (e non la rotta condivisa
 * `select-date`) perché qui i giorni fuori finestra o senza disponibilità
 * sono spenti, cosa che il calendario condiviso non sa fare. Clay come il
 * form sheet: testata con titolo + X tonda, niente maniglia, giorno scelto =
 * cerchio nero.
 */
const BookingDayCalendar = memo(function BookingDayCalendar({
  visible,
  data,
  lastMinuteUntil,
}: {
  visible: boolean;
  data: BookingFlowState;
  lastMinuteUntil: Date | null;
}) {
  const insets = useSafeAreaInsets();
  const { calendarMonths, preferredDate, bookingMaxDate, bookedDatesSet, unavailableDatesSet } = data;
  const close = () => bookingFlowStore.set({ calendarOpen: false });

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, [visible]);
  // Con l'ultimo minuto la finestra finisce prima del limite di prenotazione.
  const maxDate = lastMinuteUntil && lastMinuteUntil < bookingMaxDate ? lastMinuteUntil : bookingMaxDate;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View style={[s.calRoot, Platform.OS === 'android' && { paddingTop: insets.top + 18 }]} testID="booking-day-sheet">
        <View style={s.calHead}>
          <View style={s.calTitles}>
            <Text style={s.calTitle}>Scegli il giorno</Text>
            <Text style={s.calSubtitle}>{formatLongDay(preferredDate)}</Text>
          </View>
          <ClayIconButton icon="close" onPress={close} accessibilityLabel="Chiudi" testID="sheet-close" />
        </View>
        <View style={s.weekRow}>
          {CALENDAR_WEEKDAYS.map((w, i) => (
            <Text key={`wd-${i}`} style={s.weekLabel}>{w}</Text>
          ))}
        </View>
        <ScrollView
          style={s.calScroll}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 18) + 22 }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          {calendarMonths.map((mo) => (
            <View key={`${mo.year}-${mo.month}`} style={s.month}>
              <Text style={s.monthLabel}>{mo.label}</Text>
              <View style={s.grid}>
                {mo.cells.map((date, idx) => {
                  const inMonth = date.getMonth() === mo.month && date.getFullYear() === mo.year;
                  if (!inMonth) return <View key={`e-${mo.month}-${idx}`} style={s.cell} />;
                  const isToday = date.getTime() === today.getTime();
                  const isSel =
                    date.getFullYear() === preferredDate.getFullYear() &&
                    date.getMonth() === preferredDate.getMonth() &&
                    date.getDate() === preferredDate.getDate();
                  const inRange = date >= today && date <= maxDate;
                  const dk = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                  const tappable = inRange && !unavailableDatesSet.has(dk);
                  const hasBooking = bookedDatesSet.has(dk) && !isSel;
                  return (
                    <Pressable
                      key={`c-${mo.month}-${idx}`}
                      style={s.cell}
                      disabled={!tappable}
                      onPress={() => bookingFlowStore.set({ preferredDate: date, calendarOpen: false, searchError: null })}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !tappable, selected: isSel }}
                    >
                      <View style={[s.dayCircle, isSel && s.dayCircleSel, !isSel && isToday && s.dayCircleToday]}>
                        <Text style={[s.dayText, !tappable && s.dayTextOff, isSel && s.dayTextSel]}>{date.getDate()}</Text>
                      </View>
                      {hasBooking ? <View style={s.dot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});

const KV_PAD = 16;
const CELL = 44;
const CIRCLE = 40;

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  section: { marginTop: 24 },
  notice: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: CLAY.ink, marginTop: 18, paddingHorizontal: 4 },
  // Righe chiave → valore
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, minHeight: 56 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  kvLabel: { fontSize: 16.5, fontWeight: '400', color: CLAY.ink3, letterSpacing: -0.25 },
  kvValue: { flex: 1, textAlign: 'right', fontSize: 16.5, fontWeight: '400', color: CLAY.ink3, letterSpacing: -0.25 },
  kvValueStrong: { color: CLAY.ink, fontWeight: '500' },
  // Calendario
  calRoot: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 26 },
  calHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 22, paddingBottom: 14 },
  calTitles: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 40 },
  calTitle: { fontSize: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, lineHeight: 28 },
  calSubtitle: { fontSize: 15, fontWeight: '400', color: CLAY.ink3, marginTop: 3, lineHeight: 20 },
  weekRow: {
    flexDirection: 'row',
    marginHorizontal: 22,
    paddingBottom: 6,
    // §0.7: 0.5 pt (hairlineWidth a y frazionaria può sparire).
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(17,17,17,0.12)',
  },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: CLAY.ink3 },
  calScroll: { flex: 1 },
  month: { marginTop: 18 },
  monthLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: CLAY.ink2, letterSpacing: -0.2, marginBottom: 6, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%' as unknown as number, height: CELL, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: CLAY.ink, ...CLAY_SHADOW.ink },
  dayCircleToday: { borderWidth: 1.5, borderColor: CLAY.ink },
  dayText: { fontSize: 15, fontWeight: '400', color: CLAY.ink },
  dayTextOff: { color: '#D8D8D8' },
  dayTextSel: { color: '#FFFFFF', fontWeight: '600' },
  dot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: CLAY.ink4 },
});
