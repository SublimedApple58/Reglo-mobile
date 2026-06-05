import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MiniCalendar } from '../../../src/components/MiniCalendar';
import RangesEditor from '../../../src/components/RangesEditor';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { availabilityExceptionStore } from '../../../src/stores/availabilityExceptionStore';
import { regloApi } from '../../../src/services/regloApi';
import { TimeRange } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const WEEK_DAYS: { label: string; value: number }[] = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'M', value: 3 },
  { label: 'G', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];
const FLUENT_CAL = require('../../../assets/icons/fluent-spiral-cal.png');

const WEEKS_OPTIONS = [2, 4, 8, 12];
const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

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
    data?.editRanges && data.editRanges.length ? data.editRanges : [...DEFAULT_RANGES],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markedSet = useMemo(() => new Set(data?.markedDates ?? []), [data?.markedDates]);

  if (!data) return <View style={s.root} />;

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

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Image source={FLUENT_CAL} style={s.headerIcon} />
        <Text style={s.title}>{editing ? 'Modifica eccezione' : 'Nuova eccezione'}</Text>
        <Text style={s.subtitle}>
          {editing
            ? 'Aggiorna o rimuovi questa eccezione.'
            : 'Cambia i tuoi orari per un giorno specifico o per più settimane.'}
        </Text>

        {/* Mode segmented — hidden in edit mode (always a single date) */}
        {!editing && (
          <View style={s.segmented}>
            <Pressable
              onPress={() => setMode('once')}
              style={[s.segment, mode === 'once' && s.segmentActive]}
            >
              <Text style={[s.segmentText, mode === 'once' && s.segmentTextActive]}>Una volta</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('recurring')}
              style={[s.segment, mode === 'recurring' && s.segmentActive]}
            >
              <Text style={[s.segmentText, mode === 'recurring' && s.segmentTextActive]}>Ricorrente</Text>
            </Pressable>
          </View>
        )}

        {/* Date / weekday selector */}
        {mode === 'once' ? (
          editing ? (
            <View style={s.editedDateCard}>
              <Ionicons name="calendar-outline" size={20} color="#1A1A2E" />
              <Text style={s.editedDateText}>{date ? formatLong(date) : ''}</Text>
            </View>
          ) : (
            <View style={s.card}>
              <MiniCalendar
                selectedDate={date}
                onSelectDate={(d) => { setDate(d); setError(null); }}
                markedDates={markedSet}
                maxWeeks={52}
              />
            </View>
          )
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <Text style={s.label}>GIORNO DELLA SETTIMANA</Text>
              <View style={s.daysRow}>
                {WEEK_DAYS.map((d, i) => {
                  const active = weekday === d.value;
                  return (
                    <Pressable
                      key={`${d.value}-${i}`}
                      onPress={() => setWeekday(d.value)}
                      style={[s.dayPill, active ? s.dayPillActive : s.dayPillInactive]}
                    >
                      <Text style={[s.dayPillText, active && s.dayPillTextActive]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={s.label}>PER QUANTE SETTIMANE</Text>
              <View style={s.chipsRow}>
                {WEEKS_OPTIONS.map((w) => (
                  <SelectableChip key={w} label={`${w}`} active={weeks === w} onPress={() => setWeeks(w)} />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Absent toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Assente tutto il giorno</Text>
            <Text style={s.toggleDesc}>Nessuna disponibilità in questo giorno.</Text>
          </View>
          <ToggleSwitch value={absent} onValueChange={setAbsent} />
        </View>

        {/* Ranges */}
        {!absent && (
          <View>
            <Text style={s.label}>FASCE ORARIE</Text>
            <RangesEditor
              ranges={ranges}
              onChange={setRanges}
              onPickTime={handlePickTime}
              onAddRange={() => setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
              disabled={saving}
            />
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable
          onPress={saving ? undefined : handleSave}
          disabled={saving}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, saving && { opacity: 0.6 }]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva eccezione</Text>}
        </Pressable>

        {editing && (
          <Pressable onPress={saving ? undefined : handleDelete} disabled={saving} style={s.deleteBtn}>
            <Text style={s.deleteText}>Rimuovi eccezione</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITALIAN_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const formatLong = (dateStr: string): string => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${ITALIAN_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS[m - 1]}`;
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16, paddingBottom: 6, paddingHorizontal: spacing.lg, marginRight: -4 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 18 },
  headerIcon: { width: 48, height: 48, resizeMode: 'contain', marginBottom: -6 },
  title: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: -10, lineHeight: 19 },

  /* Segmented */
  segmented: {
    flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { color: '#1A1A2E' },

  /* Cards */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
  },
  editedDateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
  },
  editedDateText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', textTransform: 'capitalize' },

  label: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  /* Day pills */
  daysRow: { flexDirection: 'row', gap: 6 },
  dayPill: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayPillActive: { backgroundColor: '#1A1A2E' },
  dayPillInactive: { backgroundColor: '#F1F5F9' },
  dayPillText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  dayPillTextActive: { color: '#FFFFFF' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  /* Absent toggle — flat row */
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
  },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  toggleDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  error: { fontSize: 13, fontWeight: '600', color: '#DC2626', textAlign: 'center' },

  /* CTA */
  cta: {
    backgroundColor: '#1A1A2E', minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  deleteBtn: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
