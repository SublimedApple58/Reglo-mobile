import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayIconButton,
  ClayList,
  ClayListRow,
  ClaySection,
  ClaySegmented,
} from '../../../src/components/clay';
import RangesEditor from '../../../src/components/RangesEditor';
import { ScrollableMonthsCalendar } from '../../../src/components/ScrollableMonthsCalendar';
import { ownerInstructorSheetStore } from '../../../src/stores/ownerInstructorSheetStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { DailyAvailabilityOverride, TimeRange } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

// ─── Helpers (spostati da OwnerInstructorScreen, logica invariata) ───────────

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITALIAN_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
/** Righe dei giorni da lunedì a domenica (indici getDay()). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Detect ranges from contiguous sorted slots. Gaps >= 60 min create a new range. */
const detectRangesFromSlots = (
  slots: Array<{ startsAt: string; endsAt: string; status?: string }>,
): TimeRange[] => {
  const usable = slots
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (!usable.length) return [];
  const ranges: TimeRange[] = [];
  let rangeStart = new Date(usable[0].startsAt);
  let rangeEnd = new Date(usable[0].endsAt);
  for (let i = 1; i < usable.length; i++) {
    const slotStart = new Date(usable[i].startsAt);
    const slotEnd = new Date(usable[i].endsAt);
    const gap = slotStart.getTime() - rangeEnd.getTime();
    if (gap >= 60 * 60 * 1000) {
      ranges.push({
        startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
        endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
      });
      rangeStart = slotStart;
    }
    rangeEnd = slotEnd;
  }
  ranges.push({
    startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
    endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
  });
  return ranges;
};

/**
 * «Disponibilità di X» (Panoramica istruttori del titolare, REG-639 clay).
 * Form sheet unico, due modalità (ClaySegmented): Predefinito (giorni con
 * spunta + fasce) e Calendario (mese → giorno: il giorno scelto apre il suo
 * passo, con indietro, e torna al calendario dopo il salvataggio). L'orario
 * si sceglie col time-picker dello stesso stack (`role/` o `more/`).
 * Registrato in `role/` e in `more/` (che lo ri-esporta).
 */
export default function InstructorAvailabilitySheet() {
  const router = useRouter();
  const segments = useSegments();
  const stack = (segments as string[]).includes('more') ? 'more' : 'role';
  const data = useSyncExternalStore(ownerInstructorSheetStore.subscribe, ownerInstructorSheetStore.getAvailability);
  const instructorId = data?.instructorId ?? null;
  const availabilityWeeks = data?.availabilityWeeks ?? 4;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [availDays, setAvailDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availLoading, setAvailLoading] = useState(true);
  const [availSaving, setAvailSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'default' | 'calendar'>('default');
  const [defaultRanges, setDefaultRanges] = useState<TimeRange[]>([{ startMinutes: 480, endMinutes: 720 }]);
  const [overrides, setOverrides] = useState<DailyAvailabilityOverride[]>([]);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calRanges, setCalRanges] = useState<TimeRange[]>([]);
  const [calSaving, setCalSaving] = useState(false);

  useEffect(() => {
    return () => { ownerInstructorSheetStore.clearAvailability(); };
  }, []);

  // ─── Caricamento ─────────────────────────────────────────

  const loadInstructorAvailability = useCallback(async (id: string) => {
    setAvailLoading(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
      const responses = await Promise.all(
        dates.map((day) =>
          regloApi.getAvailabilitySlots({
            ownerType: 'instructor',
            ownerId: id,
            date: toDateString(day),
          }),
        ),
      );

      const activeDays: number[] = [];
      let mergedRanges: TimeRange[] = [];

      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const detected = detectRangesFromSlots(response);
        if (detected.length === 0) return;
        activeDays.push(dates[index].getDay());
        // Use the ranges from the first active day as the default template
        if (mergedRanges.length === 0) {
          mergedRanges = detected;
        }
      });

      if (activeDays.length) {
        setAvailDays(Array.from(new Set(activeDays)).sort());
        setDefaultRanges(mergedRanges);
      } else {
        setAvailDays([]);
        setDefaultRanges([{ startMinutes: 480, endMinutes: 720 }]);
      }
    } catch {
      setError('Errore caricando disponibilità istruttore');
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!instructorId) return;
    (async () => {
      await loadInstructorAvailability(instructorId);
      try {
        const res = await regloApi.getDailyAvailabilityOverrides({
          ownerType: 'instructor',
          ownerId: instructorId,
        });
        setOverrides(res ?? []);
      } catch {
        setOverrides([]);
      }
    })();
    // Una sola volta per istruttore (all'apertura del foglio).
  }, [instructorId, loadInstructorAvailability]);

  const busy = availSaving || calSaving;
  const close = useCallback(() => {
    if (busy) return;
    router.back();
  }, [busy, router]);

  const toggleAvailDay = (day: number) => {
    setAvailDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSwitchTab = useCallback((tab: 'default' | 'calendar') => {
    setActiveTab(tab);
    setError(null);
    setNotice(null);
  }, []);

  // ─── Orario: time-picker dello stesso stack ─────────────

  const openTimePicker = (tab: 'default' | 'calendar', rangeIndex: number, field: 'start' | 'end') => {
    const ranges = tab === 'default' ? defaultRanges : calRanges;
    const range = ranges[rangeIndex];
    const mins = range ? (field === 'start' ? range.startMinutes : range.endMinutes) : 9 * 60;
    timePickerStore.set({
      selectedTime: buildTime(Math.floor(mins / 60), mins % 60),
      onConfirm: (date) => {
        const minutes = date.getHours() * 60 + date.getMinutes();
        const key = field === 'start' ? 'startMinutes' : 'endMinutes';
        const apply = (prev: TimeRange[]) =>
          prev.map((r, i) => (i === rangeIndex ? { ...r, [key]: minutes } : r));
        if (tab === 'default') setDefaultRanges(apply);
        else setCalRanges(apply);
      },
    });
    router.push(`/(tabs)/${stack}/time-picker` as never);
  };

  // ─── Calendario ──────────────────────────────────────────

  const handleCalSelectDate = useCallback((dateStr: string) => {
    setNotice(null);
    setError(null);
    setCalSelectedDate(dateStr);
    const existing = overrides.find((o) => (typeof o.date === 'string' ? o.date.slice(0, 10) : '') === dateStr);
    if (existing) {
      setCalRanges(existing.ranges.map((r) => ({ ...r })));
    } else {
      setCalRanges(defaultRanges.map((r) => ({ ...r })));
    }
  }, [overrides, defaultRanges]);

  const handleCalSaveOverride = useCallback(async () => {
    if (!instructorId || !calSelectedDate) return;
    for (let i = 0; i < calRanges.length; i++) {
      if (calRanges[i].endMinutes <= calRanges[i].startMinutes) {
        setError(`Fascia ${i + 1}: orario non valido`);
        return;
      }
    }
    setCalSaving(true);
    try {
      await regloApi.setDailyAvailabilityOverride({
        ownerType: 'instructor',
        ownerId: instructorId,
        date: calSelectedDate,
        ranges: calRanges,
      });
      try {
        const res = await regloApi.getDailyAvailabilityOverrides({
          ownerType: 'instructor',
          ownerId: instructorId,
        });
        setOverrides(res ?? []);
      } catch { /* ignore */ }
      setError(null);
      setCalSelectedDate(null);
      setNotice('Override salvato');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando override');
    } finally {
      setCalSaving(false);
    }
  }, [instructorId, calSelectedDate, calRanges]);

  const handleCalResetOverride = useCallback(async () => {
    if (!instructorId || !calSelectedDate) return;
    setCalSaving(true);
    try {
      await regloApi.deleteDailyAvailabilityOverride({
        ownerType: 'instructor',
        ownerId: instructorId,
        date: calSelectedDate,
      });
      setOverrides((prev) => prev.filter((o) => (typeof o.date === 'string' ? o.date.slice(0, 10) : '') !== calSelectedDate));
      setCalRanges(defaultRanges.map((r) => ({ ...r })));
      setError(null);
      setCalSelectedDate(null);
      setNotice('Override rimosso');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimuovendo override');
    } finally {
      setCalSaving(false);
    }
  }, [instructorId, calSelectedDate, defaultRanges]);

  const overrideDates = useMemo(
    () => new Set(overrides.map((o) => typeof o.date === 'string' ? o.date.slice(0, 10) : '')),
    [overrides],
  );

  const calDateLabel = useMemo(() => {
    if (!calSelectedDate) return '';
    const [y, m, d] = calSelectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${ITALIAN_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS_SHORT[m - 1]}`;
  }, [calSelectedDate]);

  const hasCalOverride = calSelectedDate != null && overrideDates.has(calSelectedDate);

  // ─── Predefinito: salvataggio ────────────────────────────

  const handleSaveAvailability = useCallback(async () => {
    if (!instructorId) return;

    if (!availDays.length) {
      setError('Seleziona almeno un giorno');
      return;
    }
    if (!defaultRanges.length) {
      setError('Aggiungi almeno una fascia oraria');
      return;
    }
    for (let i = 0; i < defaultRanges.length; i++) {
      if (defaultRanges[i].endMinutes <= defaultRanges[i].startMinutes) {
        setError(`Fascia ${i + 1}: orario non valido`);
        return;
      }
    }

    setAvailSaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);

      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType: 'instructor',
          ownerId: instructorId,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks: availabilityWeeks,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) throw err;
      }

      const primary = defaultRanges[0];
      const startDate = new Date(anchor);
      startDate.setHours(Math.floor(primary.startMinutes / 60), primary.startMinutes % 60, 0, 0);
      const endDate = new Date(anchor);
      endDate.setHours(Math.floor(primary.endMinutes / 60), primary.endMinutes % 60, 0, 0);

      const secondRange: { startsAt2?: string; endsAt2?: string } = {};
      if (defaultRanges.length >= 2) {
        const r2 = defaultRanges[1];
        const s2 = new Date(anchor);
        s2.setHours(Math.floor(r2.startMinutes / 60), r2.startMinutes % 60, 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(Math.floor(r2.endMinutes / 60), r2.endMinutes % 60, 0, 0);
        secondRange.startsAt2 = s2.toISOString();
        secondRange.endsAt2 = e2.toISOString();
      }

      await regloApi.createAvailabilitySlots({
        ownerType: 'instructor',
        ownerId: instructorId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        ...secondRange,
        daysOfWeek: availDays,
        weeks: availabilityWeeks,
        ranges: defaultRanges,
      });

      setError(null);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando disponibilità');
    } finally {
      setAvailSaving(false);
    }
  }, [instructorId, availDays, defaultRanges, availabilityWeeks, router]);

  // ─── Render ──────────────────────────────────────────────

  const firstName = data?.instructorName.split(/\s+/)[0];
  const sheetTitle = firstName ? `Disponibilità di ${firstName}` : 'Disponibilità';
  const errorLine = error ? <Text style={s.error}>{error}</Text> : null;

  // Passo «giorno» del calendario: il giorno scelto, le sue fasce, salva/ripristina.
  const isDay = calSelectedDate != null && activeTab === 'calendar';

  const dayCta = (
    <View style={s.ctaCol}>
      <ClayButton
        title="Salva"
        onPress={handleCalSaveOverride}
        loading={calSaving}
        disabled={calSaving}
        testID="instructor-availability-day-save"
      />
      {hasCalOverride ? (
        <ClayButton
          title="Ripristina predefinito"
          variant="secondary"
          onPress={handleCalResetOverride}
          disabled={calSaving}
          testID="instructor-availability-day-reset"
        />
      ) : null}
    </View>
  );

  const defaultCta = (
    <ClayButton
      title="Salva disponibilità"
      onPress={handleSaveAvailability}
      loading={availSaving}
      disabled={availSaving}
      testID="instructor-availability-save"
    />
  );

  return (
    <FormSheet
      title={isDay ? calDateLabel : sheetTitle}
      subtitle={isDay ? (hasCalOverride ? `${sheetTitle} · Override attivo` : sheetTitle) : undefined}
      leading={
        isDay ? (
          <ClayIconButton
            icon="back"
            onPress={() => { if (!calSaving) { setCalSelectedDate(null); setError(null); } }}
            accessibilityLabel="Torna al calendario"
            testID="instructor-availability-day-back"
          />
        ) : undefined
      }
      contentKey={availLoading ? 'loading' : isDay ? 'day' : 'main'}
      onClose={close}
      testID="instructor-availability-sheet"
      cta={isDay ? dayCta : !availLoading && activeTab === 'default' ? defaultCta : undefined}
    >
      {availLoading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={CLAY.ink} />
          <Text style={s.loadingText}>Caricamento disponibilità...</Text>
        </View>
      ) : isDay ? (
        <>
          <RangesEditor
            ranges={calRanges}
            onChange={setCalRanges}
            onPickTime={(rangeIndex, field) => openTimePicker('calendar', rangeIndex, field)}
            onAddRange={() => {
              setCalRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
            }}
            disabled={calSaving}
          />
          {errorLine}
        </>
      ) : (
        <>
          <ClaySegmented
            options={[
              { value: 'default', label: 'Predefinito', testID: 'instructor-availability-tab-default' },
              { value: 'calendar', label: 'Calendario', testID: 'instructor-availability-tab-calendar' },
            ]}
            value={activeTab}
            onChange={handleSwitchTab}
          />

          <Animated.View key={activeTab} entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
            {activeTab === 'default' ? (
              <>
                <ClaySection title="Giorni" style={s.firstSection}>
                  <ClayList>
                    {WEEK_ORDER.map((day) => {
                      const on = availDays.includes(day);
                      return (
                        <ClayListRow
                          key={`day-${day}`}
                          title={ITALIAN_DAYS[day]}
                          onPress={() => toggleAvailDay(day)}
                          chevron={false}
                          trailing={on ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null}
                          testID={`instructor-availability-day-${day}`}
                        />
                      );
                    })}
                  </ClayList>
                </ClaySection>
                <ClaySection title="Fasce orarie">
                  <RangesEditor
                    ranges={defaultRanges}
                    onChange={setDefaultRanges}
                    onPickTime={(rangeIndex, field) => openTimePicker('default', rangeIndex, field)}
                    onAddRange={() => {
                      setDefaultRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                    }}
                    disabled={availSaving}
                  />
                </ClaySection>
              </>
            ) : (
              <View style={s.calendar}>
                <Text style={s.hint}>
                  {notice ?? 'Scegli un giorno per cambiare solo le sue fasce orarie.'}
                </Text>
                <ScrollableMonthsCalendar
                  selectedDate={calSelectedDate}
                  onSelectDate={handleCalSelectDate}
                  markedDates={overrideDates}
                  monthsCount={3}
                />
              </View>
            )}
          </Animated.View>
          {errorLine}
        </>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { fontSize: 15, color: CLAY.ink3 },
  firstSection: { marginTop: 22 },
  calendar: { marginTop: 18, gap: 12 },
  hint: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 2 },
  ctaCol: { gap: 10 },
  error: { fontSize: 14, lineHeight: 19, color: '#C13515', marginTop: 14, paddingHorizontal: 2 },
});
