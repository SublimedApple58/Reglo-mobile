import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollableMonthsCalendar, CALENDAR_WEEKDAYS } from '../../../src/components/ScrollableMonthsCalendar';
import RangesEditor from '../../../src/components/RangesEditor';
import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayIconButton,
  ClayList,
  ClayListRow,
  ClaySection,
  ClaySegmented,
  ClaySurface,
} from '../../../src/components/clay';
import { availabilityExceptionStore } from '../../../src/stores/availabilityExceptionStore';
import { regloApi } from '../../../src/services/regloApi';
import { TimeRange } from '../../../src/types/regloApi';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

const WEEK_DAYS: { label: string; value: number }[] = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];

const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const ITALIAN_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITALIAN_MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const formatShort = (dateStr: string): string => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${ITALIAN_DAYS_SHORT[date.getDay()]} ${d} ${ITALIAN_MONTHS_SHORT[m - 1]}`;
};

const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

/**
 * Eccezione alla disponibilità (giorno libero o orari speciali) — REG-639
 * clay: form sheet unico che scorre da sé (niente scroll interna, niente
 * footer fisso). Una volta / Ricorrente = segmentato; il calendario si apre
 * sotto la riga «Giorno» e si richiude alla scelta; Non disponibile / Orari
 * diversi = segmentato; CTA e «Rimuovi» in fondo.
 */
export default function AvailabilityExceptionScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(availabilityExceptionStore.subscribe, availabilityExceptionStore.get);

  const editing = !!data?.editDate;

  const [mode, setMode] = useState<'once' | 'recurring'>('once');
  const [date, setDate] = useState<string | null>(data?.editDate ?? null);
  const [weekday, setWeekday] = useState(1);
  const [weeks, setWeeks] = useState(4);
  const [absent, setAbsent] = useState<boolean>(data?.editIsAbsent ?? false);
  const [ranges, setRanges] = useState<TimeRange[]>(
    // Ignore sentinel [{0,0}] (unavailable) ranges → seed a sensible default so
    // switching to "Disponibile" doesn't show 00:00–00:00.
    data?.editRanges && data.editRanges.some((r) => r.endMinutes > r.startMinutes)
      ? data.editRanges
      : [...DEFAULT_RANGES],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Calendario aperto finché non c'è una data (nuova eccezione «una volta»).
  const [calendarOpen, setCalendarOpen] = useState(!editing);

  const markedSet = useMemo(() => new Set(data?.markedDates ?? []), [data?.markedDates]);

  if (!data) return <View style={s.empty} />;

  const handlePickTime = (index: number, field: 'start' | 'end') => {
    const range = ranges[index];
    if (!range) return;
    const mins = field === 'start' ? range.startMinutes : range.endMinutes;
    const key = field === 'start' ? 'startMinutes' : 'endMinutes';
    data.openTimePicker(minutesToDate(mins), (d) => {
      const m = d.getHours() * 60 + d.getMinutes();
      setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: m } : r)));
    });
  };

  const validate = (): boolean => {
    if (mode === 'once' && !date) {
      setError('Seleziona una data.');
      return false;
    }
    if (!absent) {
      for (let i = 0; i < ranges.length; i++) {
        if (ranges[i].endMinutes <= ranges[i].startMinutes) {
          setError(`Orario non valido nella fascia ${i + 1}.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    setError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payloadRanges = absent ? [] : ranges;
      if (mode === 'once' && date) {
        await regloApi.setDailyAvailabilityOverride({
          ownerType: 'instructor',
          ownerId: data.instructorId,
          date,
          ranges: payloadRanges,
        });
      } else {
        await regloApi.setRecurringAvailabilityOverride({
          ownerType: 'instructor',
          ownerId: data.instructorId,
          dayOfWeek: weekday,
          ranges: payloadRanges,
          weeksAhead: weeks,
        });
      }
      data.onSaved();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!data.editDate) return;
    setError(null);
    setSaving(true);
    try {
      await regloApi.deleteDailyAvailabilityOverride({
        ownerType: 'instructor',
        ownerId: data.instructorId,
        date: data.editDate,
      });
      data.onSaved();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella rimozione.');
      setSaving(false);
    }
  };

  const whenComplete = mode === 'once' ? !!date : true;
  const weeksLabel = `${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}`;

  const cta = (
    <View style={s.ctaCol}>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <ClayButton
        title="Salva eccezione"
        onPress={handleSave}
        loading={saving}
        disabled={!whenComplete}
        testID="availability-exception-save"
      />
      {editing ? (
        <Pressable
          onPress={saving ? undefined : handleDelete}
          disabled={saving}
          style={({ pressed }) => [s.deleteBtn, pressed && s.pressed]}
          accessibilityRole="button"
          testID="availability-exception-delete"
        >
          <Text style={s.deleteText}>Rimuovi eccezione</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <FormSheet
      title={editing ? 'Modifica eccezione' : 'Nuova eccezione'}
      subtitle={editing && data.editDate ? formatShort(data.editDate) : 'Un giorno libero o con orari diversi.'}
      testID="availability-exception-sheet"
      cta={cta}
    >
      {/* ── Quando (solo per una nuova eccezione: in modifica la data è fissa) ── */}
      {!editing ? (
        <>
          <ClaySegmented
            options={[
              { value: 'once', label: 'Una volta' },
              { value: 'recurring', label: 'Ricorrente' },
            ]}
            value={mode}
            onChange={(v) => { setMode(v); setError(null); }}
            testID="availability-exception-mode"
          />

          {mode === 'once' ? (
            <Animated.View key="once" entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
              <ClaySection title="Quando">
                <ClayList>
                  <ClayListRow
                    title="Giorno"
                    subtitle={date ? formatShort(date) : 'Seleziona una data'}
                    onPress={() => setCalendarOpen((o) => !o)}
                    chevron={!calendarOpen}
                    testID="availability-exception-day"
                  />
                </ClayList>
                {calendarOpen ? (
                  <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
                    <ClaySurface style={s.calendar}>
                      <View style={s.calWeekRow}>
                        {CALENDAR_WEEKDAYS.map((w, i) => (
                          <Text key={`cwd-${i}`} style={s.calWeekLabel}>{w}</Text>
                        ))}
                      </View>
                      <ScrollableMonthsCalendar
                        selectedDate={date}
                        onSelectDate={(d) => { setDate(d); setError(null); setCalendarOpen(false); }}
                        markedDates={markedSet}
                        monthsCount={12}
                        hideWeekHeader
                      />
                    </ClaySurface>
                  </Animated.View>
                ) : null}
              </ClaySection>
            </Animated.View>
          ) : (
            <Animated.View key="recurring" entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
              <ClaySection title="Giorno della settimana">
                <View style={s.weekRow}>
                  {WEEK_DAYS.map((d) => {
                    const selected = weekday === d.value;
                    return (
                      <Pressable
                        key={d.value}
                        onPress={() => setWeekday(d.value)}
                        style={s.weekCell}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={d.label}
                      >
                        <View style={[s.weekDay, selected && s.weekDayOn]}>
                          <Text style={[s.weekDayTx, selected && s.weekDayTxOn]}>{d.label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ClaySection>
              <ClaySection title="Per quante settimane">
                <ClayList>
                  <ClayListRow
                    title={weeksLabel}
                    trailing={
                      <View style={s.stepper}>
                        <ClayIconButton
                          icon={<Ionicons name="remove" size={20} color={CLAY.ink} />}
                          onPress={() => setWeeks((w) => Math.max(1, w - 1))}
                          style={weeks <= 1 && s.stepOff}
                          accessibilityLabel="Una settimana in meno"
                        />
                        <ClayIconButton
                          icon="add"
                          onPress={() => setWeeks((w) => Math.min(52, w + 1))}
                          style={weeks >= 52 && s.stepOff}
                          accessibilityLabel="Una settimana in più"
                        />
                      </View>
                    }
                  />
                </ClayList>
              </ClaySection>
            </Animated.View>
          )}
        </>
      ) : null}

      {/* ── Disponibilità ── */}
      <ClaySection title="Disponibilità" style={editing && s.firstSection}>
        <ClaySegmented
          options={[
            { value: 'absent', label: 'Non disponibile' },
            { value: 'hours', label: 'Orari diversi' },
          ]}
          value={absent ? 'absent' : 'hours'}
          onChange={(v) => setAbsent(v === 'absent')}
          testID="availability-exception-availability"
        />
        {!absent ? (
          <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.ranges}>
            <RangesEditor
              ranges={ranges}
              onChange={setRanges}
              onPickTime={handlePickTime}
              onAddRange={() => setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
              disabled={saving}
            />
          </Animated.View>
        ) : (
          <Animated.Text entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.note}>
            Giorno chiuso, nessuna guida.
          </Animated.Text>
        )}
      </ClaySection>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  firstSection: { marginTop: 4 },

  /* Calendario sotto la riga «Giorno» */
  calendar: { marginTop: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  calWeekRow: { flexDirection: 'row', paddingBottom: 8 },
  calWeekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '500', color: CLAY.ink4 },

  /* Giorno della settimana: cerchi, scelto = clay nero (come le ore del time picker) */
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 50 },
  weekDay: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  weekDayOn: { backgroundColor: CLAY.ink, ...CLAY_SHADOW.ink },
  weekDayTx: { fontSize: 15, fontWeight: '400', color: CLAY.ink2 },
  weekDayTxOn: { color: '#FFFFFF', fontWeight: '600' },

  stepper: { flexDirection: 'row', gap: 10 },
  stepOff: { opacity: 0.4 },

  ranges: { marginTop: 14 },
  note: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },

  ctaCol: { gap: 10 },
  error: { fontSize: 13.5, fontWeight: '500', color: '#C13515', textAlign: 'center' },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontSize: 15.5, fontWeight: '600', color: '#C13515' },
  pressed: { opacity: 0.6 },
});
