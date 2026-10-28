import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayButton, ClayList, ClayListRow, ClaySection, ClaySurface } from '../components/clay';
import { ToastTone } from '../components/ToastNotice';
import { DailyAvailabilityOverride, TimeRange } from '../types/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { publishDayStore } from '../stores/publishDayStore';
import { availabilityExceptionStore } from '../stores/availabilityExceptionStore';
import { useSession } from '../context/SessionContext';
import { useDefaultAvailability } from '../hooks/queries/useDefaultAvailability';
import { useDailyOverrides } from '../hooks/queries/useDailyOverrides';
import { useSaveAvailability } from '../hooks/mutations/useSaveAvailability';
import { queryKeys } from '../hooks/queries/queryKeys';
import { CLAY } from '../theme/clay';
import { softEnter, SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../utils/motion';

// Render order Lun→Dom; values follow the backend convention 0=Sun..6=Sat.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITALIAN_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const DEFAULT_RANGE: TimeRange = { startMinutes: 540, endMinutes: 1080 };

type Schedule = Record<number, TimeRange[]>;

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
/** Fasce come testo: «08:00–13:00 · 14:00–19:00». */
const rangesText = (ranges: TimeRange[]) =>
  ranges.map((r) => `${fmtMin(r.startMinutes)}–${fmtMin(r.endMinutes)}`).join(' · ');
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatExceptionDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${SHORT_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS[m - 1]}`;
};

// Stable key over the active days only, so toggled-off (empty) days don't count.
const keyOf = (s: Schedule): string =>
  JSON.stringify(
    Object.keys(s)
      .map(Number)
      .filter((d) => (s[d]?.length ?? 0) > 0)
      .sort((a, b) => a - b)
      .map((d) => [d, s[d].map((r) => [r.startMinutes, r.endMinutes])]),
  );

type Props = {
  instructorId: string;
  weeks: number;
  onToast: (text: string, tone?: ToastTone) => void;
  /** Testata della card in rilievo (titolo + riga), sopra la striscia della settimana. */
  intro?: React.ReactNode;
};

export const DefaultAvailabilityEditor = ({ instructorId, weeks, onToast, intro }: Props) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();

  // ── Orari settimanali (per-weekday base) — editable local copy seeded from the
  // (cached, persisted) query; edits stay local until "Salva orari". ──
  const [schedule, setSchedule] = useState<Schedule>({});
  const [loading, setLoading] = useState(true);
  const savedRef = useRef<string>(''); // key of last-saved schedule; '' until loaded
  const scheduleRef = useRef<Schedule>(schedule);
  scheduleRef.current = schedule;

  const baseQuery = useDefaultAvailability(instructorId);
  const overridesQuery = useDailyOverrides(instructorId);
  const saveMutation = useSaveAvailability();
  const saving = saveMutation.isPending;

  // ── Eccezioni (overrides) — straight off the query (cache-first, persisted) ──
  const overrides: DailyAvailabilityOverride[] = overridesQuery.data ?? [];
  const overridesLoading = overridesQuery.isLoading && !overridesQuery.data;

  // Seed the editable schedule from the query, unless the user has unsaved edits.
  useEffect(() => {
    if (baseQuery.isError && baseQuery.data === undefined) {
      if (savedRef.current === '') onToast('Errore caricando gli orari', 'danger');
      setLoading(false);
      return;
    }
    if (baseQuery.data === undefined) return; // still loading, no cache yet
    const dirty = savedRef.current !== '' && savedRef.current !== keyOf(scheduleRef.current);
    if (dirty) { setLoading(false); return; } // don't clobber the user's edits
    const res = baseQuery.data;
    if (res) {
      setSchedule(res.scheduleByDay);
      savedRef.current = keyOf(res.scheduleByDay);
    } else if (savedRef.current === '') {
      // New instructor: suggest Lun–Ven 09:00–18:00 (reads as dirty → prompts a save).
      const suggested: Schedule = {};
      [1, 2, 3, 4, 5].forEach((d) => { suggested[d] = [{ ...DEFAULT_RANGE }]; });
      setSchedule(suggested);
      savedRef.current = keyOf({});
    }
    setLoading(false);
  }, [baseQuery.data, baseQuery.isError, onToast]);

  // ── Time picker (shared route in role stack) ──
  const openTimePicker = useCallback(
    (current: Date, onPick: (d: Date) => void) => {
      timePickerStore.set({ selectedTime: current, onConfirm: onPick });
      router.push('/(tabs)/role/time-picker' as never);
    },
    [router],
  );

  // ── Per-day editor (reuses the publish-day formSheet) ──
  const openDaySheet = (day: number) => {
    const ranges = schedule[day] ?? [];
    publishDayStore.set({
      dayLabel: DAY_FULL[day],
      available: ranges.length > 0,
      ranges: ranges.length ? ranges : [{ ...DEFAULT_RANGE }],
      openTimePicker,
      onSave: (available, newRanges) => {
        setSchedule((prev) => ({ ...prev, [day]: available ? newRanges : [] }));
      },
    });
    router.push('/(tabs)/role/publish-day' as never);
  };

  const handleSave = async () => {
    const active = ORDER.filter((d) => (schedule[d]?.length ?? 0) > 0);
    if (!active.length) {
      onToast('Aggiungi orari ad almeno un giorno', 'danger');
      return;
    }
    for (const d of active) {
      for (const r of schedule[d]) {
        if (r.endMinutes <= r.startMinutes) {
          onToast(`Orario non valido (${DAY_FULL[d]})`, 'danger');
          return;
        }
      }
    }
    try {
      const scheduleByDay: Schedule = {};
      active.forEach((d) => { scheduleByDay[d] = schedule[d]; });

      // Representative day → flat startsAt/endsAt the backend still expects.
      const rep = schedule[active[0]][0];
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const sd = new Date(anchor);
      sd.setHours(Math.floor(rep.startMinutes / 60), rep.startMinutes % 60, 0, 0);
      const ed = new Date(anchor);
      ed.setHours(Math.floor(rep.endMinutes / 60), rep.endMinutes % 60, 0, 0);

      await saveMutation.mutateAsync({
        ownerType: 'instructor',
        ownerId: instructorId,
        startsAt: sd.toISOString(),
        endsAt: ed.toISOString(),
        weeks,
        scheduleByDay,
      });
      // Mark this as the saved baseline; the mutation invalidates
      // ['default-availability'] so the query refetches the canonical value.
      savedRef.current = keyOf(scheduleByDay);
      onToast('Orari salvati', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nel salvataggio', 'danger');
    }
  };

  // ── Exceptions list (upcoming, sorted) ──
  const upcomingOverrides = useMemo(() => {
    const t = todayStr();
    return overrides
      .filter((o) => o.date.slice(0, 10) >= t)
      .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));
  }, [overrides]);

  const markedDates = useMemo(() => overrides.map((o) => o.date.slice(0, 10)), [overrides]);

  const openExceptionSheet = (override?: DailyAvailabilityOverride) => {
    availabilityExceptionStore.set({
      instructorId,
      markedDates,
      editDate: override ? override.date.slice(0, 10) : undefined,
      editRanges: override ? override.ranges : undefined,
      // A sentinel [{0,0}] override (web "giorno non disponibile") = absent too.
      editIsAbsent: override ? !override.ranges.some((r) => r.endMinutes > r.startMinutes) : undefined,
      openTimePicker,
      onSaved: () => queryClient.invalidateQueries({ queryKey: queryKeys.dailyOverrides(activeCompanyId, instructorId) }),
    });
    router.push('/(tabs)/role/availability-exception' as never);
  };

  const isDirty = !loading && savedRef.current !== '' && savedRef.current !== keyOf(schedule);

  return (
    <View>
      {/* ── Card in rilievo: titolo + la settimana a colpo d'occhio (D · Mix) ── */}
      <ClaySurface style={st.card} radius={26}>
        {intro}
        <WeekStrip schedule={loading ? null : schedule} onPressDay={openDaySheet} />
      </ClaySurface>

      {/* ── Orari settimanali ─────────────────────────── */}
      <ClaySection
        style={st.firstSection}
        footnote="Valgono ogni settimana. Tocca un giorno per cambiarne gli orari."
      >
        {loading ? (
          <ClayList>
            {ORDER.map((d) => (
              <SkeletonRow key={d} width={140} />
            ))}
          </ClayList>
        ) : (
          <Animated.View entering={softEnter()}>
            <ClayList>
              {ORDER.map((day) => {
                const ranges = schedule[day] ?? [];
                return (
                  <ClayListRow
                    key={day}
                    title={DAY_FULL[day]}
                    subtitle={ranges.length ? rangesText(ranges) : 'Non disponibile'}
                    onPress={() => openDaySheet(day)}
                    testID={`availability-day-${day}`}
                  />
                );
              })}
            </ClayList>
          </Animated.View>
        )}
      </ClaySection>

      {isDirty ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={st.save}>
          <ClayButton title="Salva orari" onPress={handleSave} loading={saving} testID="availability-save" />
        </Animated.View>
      ) : null}

      {/* ── Eccezioni ─────────────────────────────────── */}
      <ClaySection
        title="Eccezioni"
        style={st.section}
        footnote={
          !overridesLoading && upcomingOverrides.length === 0
            ? 'Nessuna eccezione in programma. Aggiungi un giorno libero o con orari diversi.'
            : undefined
        }
      >
        {overridesLoading ? (
          <ClayList>
            {[0, 1].map((i) => (
              <SkeletonRow key={i} width={110} />
            ))}
          </ClayList>
        ) : upcomingOverrides.length > 0 ? (
          <Animated.View entering={softEnter()}>
            <ClayList>
              {upcomingOverrides.map((o) => {
                // Unavailable day = no positive-length range. The web saves a "giorno
                // non disponibile" as a sentinel [{0,0}] range, so length===0 isn't
                // enough — treat any all-zero-duration override as absent.
                const absent = !o.ranges.some((r) => r.endMinutes > r.startMinutes);
                return (
                  <ClayListRow
                    key={o.id}
                    title={formatExceptionDate(o.date)}
                    subtitle={absent ? 'Assente' : rangesText(o.ranges)}
                    onPress={() => openExceptionSheet(o)}
                  />
                );
              })}
            </ClayList>
          </Animated.View>
        ) : null}
      </ClaySection>

      <ClayButton
        title="Aggiungi eccezione"
        variant="secondary"
        onPress={() => openExceptionSheet()}
        style={st.add}
        testID="availability-add-exception"
      />
    </View>
  );
};

/**
 * La settimana a colpo d'occhio (direzione «D · Mix», REG-639): una colonna
 * per giorno, le fasce in nero sulla stessa scala oraria. Tocco = orari del giorno.
 */
const WeekStrip = ({ schedule, onPressDay }: { schedule: Schedule | null; onPressDay: (day: number) => void }) => {
  const all = schedule ? ORDER.flatMap((d) => schedule[d] ?? []) : [];
  const from = all.length ? Math.floor(Math.min(...all.map((r) => r.startMinutes)) / 60) * 60 : 8 * 60;
  const to = all.length ? Math.ceil(Math.max(...all.map((r) => r.endMinutes)) / 60) * 60 : 20 * 60;
  const span = Math.max(to - from, 60);
  return (
    <View style={st.strip}>
      {ORDER.map((day) => (
        <Pressable
          key={day}
          style={st.stripCol}
          onPress={() => onPressDay(day)}
          disabled={!schedule}
          accessibilityRole="button"
          accessibilityLabel={`${DAY_FULL[day]}, cambia orari`}
        >
          <Text style={st.stripDay}>{SHORT_DAYS[day].toLowerCase()}</Text>
          <View style={st.stripTrack}>
            {(schedule?.[day] ?? []).map((r, i) => (
              <View
                key={i}
                style={[
                  st.stripFill,
                  {
                    top: `${((r.startMinutes - from) / span) * 100}%`,
                    height: `${((r.endMinutes - r.startMinutes) / span) * 100}%`,
                  },
                ]}
              />
            ))}
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const st = StyleSheet.create({
  card: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 18 },
  strip: { flexDirection: 'row', marginTop: 16 },
  stripCol: { flex: 1, alignItems: 'center' },
  stripDay: { fontSize: 12.5, fontWeight: '500', color: CLAY.ink3 },
  stripTrack: { marginTop: 8, width: 30, height: 112, borderRadius: 11, backgroundColor: 'rgba(17,17,17,0.045)', overflow: 'hidden' },
  stripFill: { position: 'absolute', left: 0, right: 0, borderRadius: 8, backgroundColor: CLAY.ink },
  firstSection: { marginTop: 18 },
  section: { marginTop: 34 },
  save: { marginTop: 18 },
  add: { marginTop: 16 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18, minHeight: 62, justifyContent: 'center' },
  skDivider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: CLAY.hairline },
  skSub: { marginTop: 7 },
});

/** Riga scheletro dentro una `ClayList` (stesse misure di `ClayListRow`). */
const SkeletonRow = ({ width, divider }: { width: number; divider?: boolean }) => (
  <View style={st.skRow}>
    {divider ? <View style={st.skDivider} /> : null}
    <SkeletonBlock width={96} height={15} radius={7} />
    <SkeletonBlock width={width} height={12} radius={6} style={st.skSub} />
  </View>
);
