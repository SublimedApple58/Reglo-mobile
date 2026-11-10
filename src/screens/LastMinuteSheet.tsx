/**
 * «Posti liberi a breve» — posti che l'allievo prenota da solo (anteprima
 * approvata mob-7). Rotta `/(tabs)/home/last-minute` (FORM_SHEET).
 *
 * Due modi, stesso foglio:
 * - finestra «ultimo minuto» (default): da oggi fino a
 *   `bookingPolicy.lastMinuteUntil` (il server filtra già la finestra sugli
 *   slot); aperto dalla push `available_slots` con `lastMinute: true` e dalla
 *   home;
 * - un giorno (`?date=YYYY-MM-DD`): push `available_slots` della prenotazione
 *   aperta («si sono liberati posti per giovedì»). Prende il posto del vecchio
 *   foglio a mano «Scegli un orario» dell'overlay.
 *
 * Elenco a spunta (una scelta), segmentato delle durate se più di una,
 * scheletro all'apertura, stato vuoto. Prenota con `createBookingRequest`
 * (`selectedStartsAt` + `locationId`, come la home); riuscita = «È tua, Luca!»
 * nel foglio stesso (niente BookingCelebration). Niente optimistic update.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClayEmpty, ClayList, ClaySegmented, CLAY_ROW_PRESSED, clayRowPadding, markClayRow } from '../components/clay';
import type { ClayRowPosition } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { useBookingOptions } from '../hooks/queries/useBookingOptions';
import { regloApi } from '../services/regloApi';
import { CLAY } from '../theme';
import { MORALE_ART } from '../theme/moraleArt';
import type { AutoscuolaStudent, AvailableSlot } from '../types/regloApi';
import { resolveStudentBookingPolicy } from '../utils/studentBookingPolicy';
import { slotKey, slotLocationMode, slotLocationParam } from '../utils/slotLocation';
import { SOFT_SWAP_IN } from '../utils/motion';
import {
  SuccessBody,
  SuccessCover,
  dayWithNumber,
  findLinkedStudent,
  firstNameOf,
  hm,
  localDateKey,
  longDate,
  useInvalidateAfterBooking,
  type SuccessInfo,
} from './bookingExceptionParts';

type Day = { key: string; label: string; slots: AvailableSlot[] };
type Phase = 'loading' | 'list' | 'empty' | 'error' | 'success';

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Giorni da chiedere: da oggi al giorno di `until` (massimo 8). */
function daysUntil(until: Date): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const last = new Date(until);
  last.setHours(12, 0, 0, 0);
  while (d.getTime() <= last.getTime() && out.length < 8) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out.length ? out : [new Date()];
}

export default function LastMinuteSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; date?: string }>();
  const dayParam = str(params.date);
  const { user } = useSession();

  const [student, setStudent] = useState<AutoscuolaStudent | null>(null);
  const [studentId, setStudentId] = useState<string | null>(() => str(params.studentId) ?? null);
  const optionsQuery = useBookingOptions(studentId);
  const options = optionsQuery.data ?? null;
  const policy = useMemo(() => resolveStudentBookingPolicy(options), [options]);
  const durations = useMemo(() => {
    const list = options?.bookingSlotDurations?.length ? options.bookingSlotDurations : [60];
    return [...list].sort((a, b) => a - b);
  }, [options?.bookingSlotDurations]);
  const [duration, setDuration] = useState<number | null>(null);
  const activeDuration = duration ?? durations[0] ?? 60;

  const [phase, setPhase] = useState<Phase>('loading');
  const [days, setDays] = useState<Day[]>([]);
  const [selected, setSelected] = useState<AvailableSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const invalidateAfterBooking = useInvalidateAfterBooking();

  useEffect(() => {
    let alive = true;
    regloApi
      .getStudents()
      .then((list) => {
        if (!alive) return;
        const linked = findLinkedStudent(list, user);
        setStudent(linked);
        setStudentId((prev) => prev ?? linked?.id ?? null);
        if (!linked && !str(params.studentId)) setPhase('error');
      })
      .catch(() => {
        if (alive && !str(params.studentId)) setPhase('error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const hours = policy?.exceptions.lastMinuteHours ?? 24;
  const windowMode = !dayParam;

  // ── Caricamento degli slot ──
  const requestId = useRef(0);
  const load = useCallback(
    async (sid: string, minutes: number) => {
      const id = ++requestId.current;
      setNotice(null);
      try {
        const dates = dayParam
          ? [new Date(`${dayParam}T12:00:00`)]
          : daysUntil(policy?.lastMinuteUntil ? new Date(policy.lastMinuteUntil) : new Date(Date.now() + hours * 3_600_000));
        const results = await Promise.all(
          dates.map((d) =>
            regloApi.getAvailableSlots({ studentId: sid, date: localDateKey(d), durationMinutes: minutes }),
          ),
        );
        if (id !== requestId.current) return;
        const now = Date.now();
        const until = windowMode && policy?.lastMinuteUntil ? new Date(policy.lastMinuteUntil).getTime() : Infinity;
        const next: Day[] = dates
          .map((d, i) => ({
            key: localDateKey(d),
            label: dayWithNumber(d.toISOString()),
            slots: (results[i] ?? [])
              .filter((sl) => new Date(sl.startsAt).getTime() > now && new Date(sl.startsAt).getTime() <= until)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
          }))
          .filter((d) => d.slots.length);
        setDays(next);
        setSelected((prev) => {
          const all = next.flatMap((d) => d.slots);
          return (prev && all.find((sl) => slotKey(sl) === slotKey(prev))) ?? all[0] ?? null;
        });
        setPhase(next.length ? 'list' : 'empty');
      } catch {
        if (id !== requestId.current) return;
        setPhase('error');
      }
    },
    [dayParam, policy?.lastMinuteUntil, hours, windowMode],
  );

  // Aspetta le opzioni (durate, finestra) prima del primo giro.
  const optionsReady = !!options || optionsQuery.isError;
  useEffect(() => {
    if (!studentId || !optionsReady) return;
    void load(studentId, activeDuration);
  }, [studentId, optionsReady, activeDuration, load]);

  const changeDuration = useCallback((d: number) => {
    // Il cursore parte al tocco; l'elenco arriva dopo, in dissolvenza.
    React.startTransition(() => {
      setDuration(d);
      setPhase('loading');
    });
  }, []);

  // ── Prenota ──
  const book = useCallback(async () => {
    if (!studentId || !selected || booking) return;
    setBooking(true);
    setNotice(null);
    const slot = selected;
    try {
      const res = await regloApi.createBookingRequest({
        studentId,
        preferredDate: localDateKey(new Date(slot.startsAt)),
        durationMinutes: activeDuration,
        selectedStartsAt: slot.startsAt,
        ...slotLocationParam(slot),
      });
      if (!res.matched) {
        setNotice('Questo posto non c’è più. Ecco quelli rimasti.');
        await load(studentId, activeDuration);
        return;
      }
      const appt = res.appointment;
      let info: SuccessInfo = {
        firstName: student?.firstName ?? firstNameOf(user?.name),
        startsAt: appt.startsAt,
        endsAt: appt.endsAt ?? slot.endsAt,
        instructorName: null,
        vehicleName: null,
        vehicleColor: null,
        locationName: slot.locationName ?? null,
        licenseCategory: student?.licenseCategory ?? null,
      };
      try {
        const day = new Date(appt.startsAt);
        const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const list = await regloApi.getAppointments({
          studentId,
          from: from.toISOString(),
          to: new Date(from.getTime() + 86_400_000).toISOString(),
          limit: 50,
        });
        const created = list.find((a) => a.id === appt.id);
        if (created) {
          info = {
            ...info,
            instructorName: created.instructor?.name ?? null,
            vehicleName: created.vehicle?.name ?? null,
            vehicleColor: created.vehicle?.color ?? null,
            locationName: created.location?.name ?? info.locationName,
            licenseCategory: created.vehicle?.licenseCategory ?? info.licenseCategory,
          };
        }
      } catch {
        // il successo resta con i dati della risposta
      }
      await invalidateAfterBooking();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setSuccess(info);
      setPhase('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setNotice(msg && msg !== 'Request failed' ? msg : 'Non è andata. Controlla la connessione e riprova.');
    } finally {
      setBooking(false);
    }
  }, [studentId, selected, booking, activeDuration, load, student, user?.name, invalidateAfterBooking]);

  const locationMode = useMemo(() => slotLocationMode(days.flatMap((d) => d.slots)), [days]);
  const onSelect = useCallback((slot: AvailableSlot) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSelected(slot);
  }, []);
  const selectedKey = selected ? slotKey(selected) : null;

  // ── Testata ──
  const title = windowMode ? 'Posti liberi a breve' : 'Posti liberi';
  const subtitle =
    phase === 'success'
      ? undefined
      : windowMode
        ? `Nelle prossime ${hours} ore · li prenoti tu`
        : `${longDate(`${dayParam}T12:00:00`)}${locationMode.mode === 'single' ? ` · ${locationMode.name}` : ''}`;

  const segmented =
    durations.length > 1 && phase !== 'success' ? (
      <ClaySegmented
        options={durations.map((d) => ({ value: d, label: `${d} min` }))}
        value={activeDuration}
        onChange={changeDuration}
        style={s.seg}
        testID="last-minute-durations"
      />
    ) : null;

  const ctaLabel = selected
    ? `Prenota ${dayWithNumber(selected.startsAt).toLowerCase()} alle ${hm(selected.startsAt)}`
    : 'Prenota';

  let cta: React.ReactNode = null;
  if (phase === 'list' || phase === 'loading') {
    cta = (
      <ClayButton
        title={phase === 'loading' ? 'Prenota' : ctaLabel}
        onPress={book}
        loading={booking}
        disabled={phase !== 'list' || !selected}
        testID="last-minute-book"
      />
    );
  } else if (phase === 'success') {
    cta = <ClayButton title="Fatto" onPress={() => router.back()} testID="last-minute-done" />;
  } else if (phase === 'error') {
    cta = (
      <ClayButton
        title="Riprova"
        variant="secondary"
        onPress={() => {
          if (!studentId) return;
          setPhase('loading');
          void load(studentId, activeDuration);
        }}
      />
    );
  } else {
    cta = <ClayButton title="Chiudi" variant="secondary" onPress={() => router.back()} />;
  }

  // Le parti sopra l'elenco cambiano in dissolvenza (la lista non ha `contentKey`).
  const header = (
    <Animated.View key={phase === 'loading' || phase === 'list' ? 'list' : phase} entering={SOFT_SWAP_IN}>
      {segmented}
      {notice ? <Text style={s.notice}>{notice}</Text> : null}
      {phase === 'loading' ? <SlotsSkeleton /> : null}
      {phase === 'empty' ? (
        <View style={s.emptyWrap}>
          <ClayEmpty
            icon={MORALE_ART.espresso}
            title="Nessun posto libero"
            text={windowMode ? `Nelle prossime ${hours} ore è tutto pieno. Ti avvisiamo noi se si libera qualcosa.` : 'Per questo giorno i posti sono già finiti.'}
          />
        </View>
      ) : null}
      {phase === 'error' ? (
        <View>
          <Text style={s.stateTitle}>Posti non caricati</Text>
          <Text style={s.stateTx}>Controlla la connessione e riprova.</Text>
        </View>
      ) : null}
      {phase === 'success' && success ? <SuccessBody info={success} /> : null}
    </Animated.View>
  );

  return (
    <FormSheet
      title={
        phase === 'success' ? undefined : (
          <Animated.Text entering={SOFT_SWAP_IN} style={s.title} numberOfLines={2}>
            {title}
          </Animated.Text>
        )
      }
      subtitle={subtitle ? <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text> : undefined}
      leading={phase === 'success' && success ? <SuccessCover licenseCategory={success.licenseCategory} vehicleColor={success.vehicleColor} /> : undefined}
      contentKey={phase === 'success' ? 'success' : 'list'}
      busy={booking}
      cta={cta}
      testID="last-minute-sheet"
      list={{
        data: phase === 'list' ? days : [],
        keyExtractor: (d: Day) => d.key,
        extraData: `${selectedKey}|${locationMode.mode}`,
        initialNumToRender: 4,
        renderItem: ({ item }: { item: Day }) => (
          <DaySection
            day={item}
            selectedKey={selectedKey}
            showLocation={locationMode.mode === 'multi'}
            disabled={booking}
            onSelect={onSelect}
          />
        ),
      }}
    >
      {header}
    </FormSheet>
  );
}

const DaySection = memo(function DaySection({
  day,
  selectedKey,
  showLocation,
  disabled,
  onSelect,
}: {
  day: Day;
  selectedKey: string | null;
  showLocation: boolean;
  disabled: boolean;
  onSelect: (slot: AvailableSlot) => void;
}) {
  return (
    <Animated.View entering={SOFT_SWAP_IN}>
      <Text style={s.dayH}>{day.label}</Text>
      <ClayList>
        {day.slots.map((slot) => (
          <SlotRow
            key={slotKey(slot)}
            slot={slot}
            checked={slotKey(slot) === selectedKey}
            showLocation={showLocation}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </ClayList>
    </Animated.View>
  );
});

const SlotRow = markClayRow(
  memo(function SlotRow({
    slot,
    checked,
    showLocation,
    disabled,
    onSelect,
    divider,
    first,
    last,
  }: {
    slot: AvailableSlot;
    checked: boolean;
    showLocation: boolean;
    disabled: boolean;
    onSelect: (slot: AvailableSlot) => void;
  } & ClayRowPosition) {
    const minutes = Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000);
    // L'API degli slot non dice istruttore e veicolo: sotto l'orario il luogo
    // (con più luoghi) oppure la durata.
    const sub = showLocation && slot.locationName ? slot.locationName : `${minutes} min`;
    return (
      <Pressable
        onPress={() => onSelect(slot)}
        disabled={disabled}
        style={({ pressed }) => [s.row, clayRowPadding({ first, last }, 13), pressed && CLAY_ROW_PRESSED]}
        accessibilityRole="radio"
        accessibilityState={{ checked }}
        accessibilityLabel={`${hm(slot.startsAt)} – ${hm(slot.endsAt)}, ${sub}`}
        testID={`last-minute-slot-${slot.startsAt}`}
      >
        {divider ? <View style={s.divider} /> : null}
        <View style={s.rowMain}>
          <Text style={s.rowTitle}>{`${hm(slot.startsAt)} – ${hm(slot.endsAt)}`}</Text>
          <Text style={s.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        {checked ? <Ionicons name="checkmark" size={22} color={CLAY.ink} /> : null}
      </Pressable>
    );
  }),
);

function SlotsSkeleton() {
  return (
    <View testID="last-minute-skeleton">
      <SkeletonBlock width={60} height={14} radius={7} style={s.skDay} />
      <ClayList>
        {[0, 1].map((i) => (
          <View key={i} style={[s.row, clayRowPadding({ first: i === 0, last: i === 1 }, 13)]}>
            <View style={s.rowMain}>
              <SkeletonBlock width={120} height={16} radius={8} />
              <SkeletonBlock width={170} height={12} radius={6} style={{ marginTop: 7 }} />
            </View>
          </View>
        ))}
      </ClayList>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, lineHeight: 20 },
  seg: { marginBottom: 2 },
  notice: { fontSize: 14, lineHeight: 19, color: CLAY.ink2, marginTop: 14, textAlign: 'center' },
  dayH: { fontSize: 15, fontWeight: '600', color: CLAY.ink, marginTop: 18, marginBottom: 10, marginHorizontal: 4 },
  skDay: { marginTop: 20, marginBottom: 12, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 62 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25, fontVariant: ['tabular-nums'] },
  rowSub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 3 },
  emptyWrap: { paddingTop: 12 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginTop: 6 },
  stateTx: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
});
