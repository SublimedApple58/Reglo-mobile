import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollableMonthsCalendar, CALENDAR_WEEKDAYS } from '../../../src/components/ScrollableMonthsCalendar';
import { SelectableChip } from '../../../src/components/SelectableChip';
import RangesEditor from '../../../src/components/RangesEditor';
import { availabilityExceptionStore } from '../../../src/stores/availabilityExceptionStore';
import { regloApi } from '../../../src/services/regloApi';
import { TimeRange } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const WEEK_DAYS: { label: string; value: number }[] = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];
const FLUENT_CAL = require('../../../assets/icons/fluent-spiral-cal.png');

const SEG_PAD = 5;
const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1); // iOS-like ease-in-out
const ANIM = { duration: 340, easing: EASE };

// Accordion body. The inner content is absolutely positioned so its full height is always
// measured (onLayout). The wrapper animates its height toward `open ? measured : 0` and its
// opacity, both via withTiming with the SAME easing — so open/close and any content-size
// change (e.g. showing the time ranges) glide on one coordinated curve. No jank.
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const measured = useSharedValue(0);
  const wrapStyle = useAnimatedStyle(() => ({
    height: withTiming(open ? measured.value : 0, ANIM),
    opacity: withTiming(open ? 1 : 0, { duration: 220, easing: EASE }),
  }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, wrapStyle]}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) measured.value = h;
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.value = withTiming(open ? 1 : 0, { duration: 280, easing: EASE });
  }, [open, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={18} color="#9AA1AC" />
    </Animated.View>
  );
}

const ITALIAN_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITALIAN_MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const formatShort = (dateStr: string): string => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${ITALIAN_DAYS_SHORT[date.getDay()]} ${d} ${ITALIAN_MONTHS_SHORT[m - 1]}`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

export default function AvailabilityExceptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Airbnb segmented control — sliding white pill.
  const [tabsW, setTabsW] = useState(0);
  const tabIdx = mode === 'once' ? 0 : 1;
  const pillW = tabsW ? (tabsW - SEG_PAD * 2) / 2 : 0;
  const pillX = useSharedValue(0);
  const pillReady = useRef(false);
  useEffect(() => {
    if (!pillW) return;
    const target = tabIdx * pillW;
    if (pillReady.current) {
      pillX.value = withTiming(target, { duration: 220 });
    } else {
      pillX.value = target; // place instantly on first layout
      pillReady.current = true;
    }
  }, [tabIdx, pillW, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  // Accordion: one card open at a time ('when' → 'avail'). New exception starts on
  // 'when'; editing starts on 'avail' (the date is fixed). Collapsed cards re-open on tap.
  const [openCard, setOpenCard] = useState<'when' | 'avail' | null>(editing ? 'avail' : 'when');
  const toggleCard = (card: 'when' | 'avail') => setOpenCard((prev) => (prev === card ? null : card));
  const openAvail = () => setOpenCard('avail');

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

  const whenComplete = mode === 'once' ? !!date : true;
  const selectedDayLabel = WEEK_DAYS.find((d) => d.value === weekday)?.label ?? '';
  const whenSummary =
    mode === 'once'
      ? date
        ? formatShort(date)
        : null
      : `Ogni ${selectedDayLabel} · ${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}`;
  const availSummary = absent
    ? 'Non disponibile'
    : ranges.length
      ? `${fmtMin(ranges[0].startMinutes)}–${fmtMin(ranges[0].endMinutes)}${ranges.length > 1 ? `  +${ranges.length - 1}` : ''}`
      : '—';
  const whenCardOpen = !editing && openCard === 'when';
  const availOpen = openCard === 'avail';

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

        {/* ── Card 1 · Quando ───────────────────────────────────── */}
        <View style={s.card}>
          <Pressable
            style={s.cardHeader}
            onPress={editing ? undefined : () => toggleCard('when')}
            disabled={editing}
          >
            <Text style={s.cardTitle}>Quando</Text>
            <View style={s.headerRight}>
              {!whenCardOpen && (
                <Text style={[s.headerSummary, !whenComplete && s.headerSummaryPlaceholder]} numberOfLines={1}>
                  {whenSummary ?? 'Seleziona una data'}
                </Text>
              )}
              {!editing && <Chevron open={whenCardOpen} />}
            </View>
          </Pressable>

          <Collapsible open={whenCardOpen}>
            <View style={s.cardBody}>
              {/* Mode tabs — Airbnb segmented control */}
              <View style={s.seg} onLayout={(e) => setTabsW(e.nativeEvent.layout.width)}>
                {pillW > 0 && <Animated.View style={[s.segPill, { width: pillW }, pillStyle]} />}
                <Pressable onPress={() => setMode('once')} style={s.segItem} hitSlop={6}>
                  <Text style={[s.segText, mode === 'once' && s.segTextActive]}>Una volta</Text>
                </Pressable>
                <Pressable onPress={() => setMode('recurring')} style={s.segItem} hitSlop={6}>
                  <Text style={[s.segText, mode === 'recurring' && s.segTextActive]}>Ricorrente</Text>
                </Pressable>
              </View>

              {mode === 'once' ? (
                <View>
                  <View style={s.calWeekRow}>
                    {CALENDAR_WEEKDAYS.map((w, i) => (
                      <Text key={`cwd-${i}`} style={s.calWeekLabel}>{w}</Text>
                    ))}
                  </View>
                  <ScrollView
                    style={s.calScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 6 }}
                  >
                    <ScrollableMonthsCalendar
                      selectedDate={date}
                      onSelectDate={(d) => { setDate(d); setError(null); openAvail(); }}
                      markedDates={markedSet}
                      monthsCount={12}
                      hideWeekHeader
                    />
                  </ScrollView>
                </View>
              ) : (
                <View style={{ gap: 22 }}>
                  <View>
                    <Text style={s.label}>Giorno della settimana</Text>
                    <View style={s.chipsRow}>
                      {WEEK_DAYS.map((d, i) => (
                        <SelectableChip
                          key={`${d.value}-${i}`}
                          label={d.label}
                          active={weekday === d.value}
                          onPress={() => setWeekday(d.value)}
                        />
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text style={s.label}>Per quante settimane</Text>
                    <View style={s.stepperPill}>
                      <Pressable
                        onPress={() => setWeeks((w) => Math.max(1, w - 1))}
                        disabled={weeks <= 1}
                        style={({ pressed }) => [s.stepBtn, weeks <= 1 && s.stepBtnDisabled, pressed && { opacity: 0.55 }]}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={22} color={weeks <= 1 ? '#C7C7CC' : '#1A1A2E'} />
                      </Pressable>
                      <Text style={s.stepValue}>
                        <Text style={s.stepValueNum}>{weeks}</Text>
                        <Text style={s.stepValueUnit}> {weeks === 1 ? 'settimana' : 'settimane'}</Text>
                      </Text>
                      <Pressable
                        onPress={() => setWeeks((w) => Math.min(52, w + 1))}
                        disabled={weeks >= 52}
                        style={({ pressed }) => [s.stepBtn, weeks >= 52 && s.stepBtnDisabled, pressed && { opacity: 0.55 }]}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={22} color={weeks >= 52 ? '#C7C7CC' : '#1A1A2E'} />
                      </Pressable>
                    </View>
                  </View>
                  <Pressable style={({ pressed }) => [s.continueBtn, pressed && { opacity: 0.6 }]} onPress={openAvail}>
                    <Text style={s.continueText}>Continua</Text>
                    <Ionicons name="chevron-forward" size={16} color="#1A1A2E" />
                  </Pressable>
                </View>
              )}
            </View>
          </Collapsible>
        </View>

        {/* ── Card 2 · Disponibilità ─────────────────────────────── */}
        <View style={s.card}>
          <Pressable style={s.cardHeader} onPress={() => toggleCard('avail')}>
            <Text style={s.cardTitle}>Disponibilità</Text>
            <View style={s.headerRight}>
              {!availOpen && <Text style={s.headerSummary} numberOfLines={1}>{availSummary}</Text>}
              <Chevron open={availOpen} />
            </View>
          </Pressable>

          <Collapsible open={availOpen}>
            <View style={s.cardBody}>
              <Pressable style={s.radioRow} onPress={() => setAbsent(true)} disabled={saving}>
                <View style={[s.radioOuter, absent && s.radioOuterActive]}>
                  {absent && <View style={s.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.radioTitle}>Non disponibile</Text>
                  <Text style={s.radioDesc}>Giorno chiuso, nessuna guida.</Text>
                </View>
              </Pressable>

              <Pressable style={s.radioRow} onPress={() => setAbsent(false)} disabled={saving}>
                <View style={[s.radioOuter, !absent && s.radioOuterActive]}>
                  {!absent && <View style={s.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.radioTitle}>Orari diversi</Text>
                  <Text style={s.radioDesc}>Imposta fasce orarie specifiche.</Text>
                </View>
              </Pressable>

              {!absent && (
                <View style={s.rangesWrap}>
                  <RangesEditor
                    ranges={ranges}
                    onChange={setRanges}
                    onPickTime={handlePickTime}
                    onAddRange={() => setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
                    disabled={saving}
                  />
                </View>
              )}
            </View>
          </Collapsible>
        </View>

      </ScrollView>

      {/* Fixed footer — CTA stays pinned, waits for the flow to complete */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable
          onPress={saving || !whenComplete ? undefined : handleSave}
          disabled={saving || !whenComplete}
          style={({ pressed }) => [
            s.cta,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            (saving || !whenComplete) && { opacity: 0.4 },
          ]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva eccezione</Text>}
        </Pressable>
        {editing && (
          <Pressable onPress={saving ? undefined : handleDelete} disabled={saving} style={s.deleteBtn}>
            <Text style={s.deleteText}>Rimuovi eccezione</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16, paddingBottom: 6, paddingHorizontal: spacing.lg, marginRight: -4 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 24, gap: 18 },
  headerIcon: { width: 48, height: 48, resizeMode: 'contain', marginBottom: -6 },
  title: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },

  /* Mode tabs (Airbnb segmented control) */
  seg: { flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: 999, padding: SEG_PAD, position: 'relative' },
  segPill: {
    position: 'absolute', top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  segItem: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segText: { fontSize: 15, fontWeight: '600', color: '#717171', letterSpacing: -0.2 },
  segTextActive: { color: '#1A1A2E', fontWeight: '700' },

  /* Accordion card */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18, paddingHorizontal: 18,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, marginLeft: 12 },
  headerSummary: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2, flexShrink: 1 },
  headerSummaryPlaceholder: { fontWeight: '400', color: '#B0B5BD' },
  cardBody: {
    paddingHorizontal: 18, paddingBottom: 18, paddingTop: 2, gap: 16,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },

  /* Calendar (inside the When card) */
  calWeekRow: {
    flexDirection: 'row', paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEE',
  },
  calWeekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9AA1AC' },
  calScroll: { maxHeight: 320 },

  /* Disponibilità radios */
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radioOuter: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#D4D7DC',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: '#1A1A2E' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A1A2E' },
  radioTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  radioDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rangesWrap: { marginTop: 2 },

  /* Continua (recurring → avail) */
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', paddingVertical: 13, borderRadius: 24,
    borderWidth: 1, borderColor: '#DCDFE4', backgroundColor: '#FFFFFF',
  },
  continueText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },

  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2, marginBottom: 11 },

  /* Round Airbnb chips (SelectableChip) */
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  /* Weeks stepper — grey track + white pill buttons (matches the segmented control) */
  stepperPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F1F3', borderRadius: 18, padding: 6,
  },
  stepBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  stepBtnDisabled: { backgroundColor: '#FAFAFB', shadowOpacity: 0 },
  stepValue: { flex: 1, textAlign: 'center' },
  stepValueNum: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  stepValueUnit: { fontSize: 15, fontWeight: '500', color: '#6B7280', letterSpacing: -0.2 },

  error: { fontSize: 13, fontWeight: '600', color: '#DC2626', textAlign: 'center', marginBottom: 10 },

  /* Fixed footer */
  footer: {
    paddingHorizontal: spacing.lg, paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6E8EC',
  },

  /* CTA */
  cta: {
    backgroundColor: '#1A1A2E', minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  deleteBtn: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
