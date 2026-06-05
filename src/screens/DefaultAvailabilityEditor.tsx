import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RangesEditor from '../components/RangesEditor';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { DailyAvailabilityOverride, TimeRange } from '../types/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { availabilityExceptionStore } from '../stores/availabilityExceptionStore';
import { availabilityCache } from '../services/availabilityCache';
import { colors, spacing } from '../theme';

const FLUENT_CALENDAR = require('../../assets/icons/fluent-calendar.png');
const FLUENT_CLOCK = require('../../assets/icons/fluent-clock.png');

// Display order Lun→Dom, but the value follows the backend convention 0=Sun..6=Sat.
const WEEK_DAYS: { label: string; value: number }[] = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'M', value: 3 },
  { label: 'G', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITALIAN_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatExceptionDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${ITALIAN_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS[m - 1]}`;
};

type Props = {
  instructorId: string;
  weeks: number;
  onToast: (text: string, tone?: ToastTone) => void;
};

export const DefaultAvailabilityEditor = ({ instructorId, weeks, onToast }: Props) => {
  const router = useRouter();

  // ── Settimana tipo (base weekly) ──
  const [baseDays, setBaseDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [baseRanges, setBaseRanges] = useState<TimeRange[]>([...DEFAULT_RANGES]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Eccezioni (overrides) ──
  const [overrides, setOverrides] = useState<DailyAvailabilityOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);

  const loadBase = useCallback(async () => {
    // Paint cached base instantly, then refresh.
    const cached = await availabilityCache.getBase(instructorId);
    if (cached) {
      setBaseDays(cached.daysOfWeek);
      setBaseRanges(cached.ranges.length ? cached.ranges : [...DEFAULT_RANGES]);
      setBaseLoading(false);
    }
    try {
      const res = await regloApi.getDefaultAvailability({ ownerType: 'instructor', ownerId: instructorId });
      if (res) {
        setBaseDays(res.daysOfWeek);
        setBaseRanges(res.ranges.length ? res.ranges : [...DEFAULT_RANGES]);
        availabilityCache.setBase(instructorId, { daysOfWeek: res.daysOfWeek, ranges: res.ranges });
      }
    } catch {
      if (!cached) onToast('Errore caricando la settimana tipo', 'danger');
    } finally {
      setBaseLoading(false);
    }
  }, [instructorId, onToast]);

  const loadOverrides = useCallback(async () => {
    try {
      const res = await regloApi.getDailyAvailabilityOverrides({ ownerType: 'instructor', ownerId: instructorId });
      setOverrides(res ?? []);
    } catch {
      // silent — list just stays empty
    } finally {
      setOverridesLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadBase();
    loadOverrides();
  }, [loadBase, loadOverrides]);

  // ── Time picker (shared route in role stack) ──
  const openTimePicker = useCallback(
    (current: Date, onPick: (d: Date) => void) => {
      timePickerStore.set({ selectedTime: current, onConfirm: onPick });
      router.push('/(tabs)/role/time-picker' as never);
    },
    [router],
  );

  const toggleBaseDay = (value: number) => {
    setBaseDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value].sort((a, b) => a - b),
    );
  };

  const handlePickBaseTime = (index: number, field: 'start' | 'end') => {
    const range = baseRanges[index];
    if (!range) return;
    const mins = field === 'start' ? range.startMinutes : range.endMinutes;
    const key = field === 'start' ? 'startMinutes' : 'endMinutes';
    openTimePicker(minutesToDate(mins), (d) => {
      const m = d.getHours() * 60 + d.getMinutes();
      setBaseRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: m } : r)));
    });
  };

  const handleSaveBase = async () => {
    if (!baseDays.length) {
      onToast('Seleziona almeno un giorno', 'danger');
      return;
    }
    for (let i = 0; i < baseRanges.length; i++) {
      if (baseRanges[i].endMinutes <= baseRanges[i].startMinutes) {
        onToast(`Orario non valido nella fascia ${i + 1}`, 'danger');
        return;
      }
    }
    setSaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const r1 = baseRanges[0];
      const startDate = new Date(anchor);
      startDate.setHours(Math.floor(r1.startMinutes / 60), r1.startMinutes % 60, 0, 0);
      const endDate = new Date(anchor);
      endDate.setHours(Math.floor(r1.endMinutes / 60), r1.endMinutes % 60, 0, 0);

      const payload: Parameters<typeof regloApi.createAvailabilitySlots>[0] = {
        ownerType: 'instructor',
        ownerId: instructorId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        daysOfWeek: baseDays,
        weeks,
        ranges: baseRanges,
      };
      if (baseRanges.length >= 2) {
        const r2 = baseRanges[1];
        const s2 = new Date(anchor);
        s2.setHours(Math.floor(r2.startMinutes / 60), r2.startMinutes % 60, 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(Math.floor(r2.endMinutes / 60), r2.endMinutes % 60, 0, 0);
        payload.startsAt2 = s2.toISOString();
        payload.endsAt2 = e2.toISOString();
      }

      await regloApi.createAvailabilitySlots(payload);
      availabilityCache.setBase(instructorId, { daysOfWeek: baseDays, ranges: baseRanges });
      onToast('Settimana tipo salvata', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore nel salvataggio', 'danger');
    } finally {
      setSaving(false);
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
      editIsAbsent: override ? override.ranges.length === 0 : undefined,
      openTimePicker,
      onSaved: () => loadOverrides(),
    });
    router.push('/(tabs)/role/availability-exception' as never);
  };

  return (
    <View style={styles.container}>
      {/* ── Settimana tipo ─────────────────────────────── */}
      <View style={styles.sectionHead}>
        <Image source={FLUENT_CALENDAR} style={styles.sectionIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Settimana tipo</Text>
          <Text style={styles.sectionSub}>I giorni e gli orari in cui lavori di solito.</Text>
        </View>
      </View>

      <View style={styles.card}>
        {baseLoading ? (
          <View style={{ gap: 18 }}>
            <View style={styles.daysRow}>
              {WEEK_DAYS.map((d, i) => (
                <SkeletonBlock key={i} width={36} height={44} radius={12} />
              ))}
            </View>
            <SkeletonBlock width="100%" height={56} radius={999} />
            <SkeletonBlock width="100%" height={50} radius={25} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: 16 }}>
            <View style={styles.daysRow}>
              {WEEK_DAYS.map((d, i) => {
                const active = baseDays.includes(d.value);
                return (
                  <Pressable
                    key={`${d.value}-${i}`}
                    onPress={() => toggleBaseDay(d.value)}
                    style={[styles.dayPill, active ? styles.dayPillActive : styles.dayPillInactive]}
                  >
                    <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <RangesEditor
              ranges={baseRanges}
              onChange={setBaseRanges}
              onPickTime={handlePickBaseTime}
              onAddRange={() => setBaseRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
              disabled={saving}
            />

            <Pressable
              onPress={saving ? undefined : handleSaveBase}
              disabled={saving}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, saving && styles.ctaDisabled]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Salva settimana tipo</Text>}
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* ── Eccezioni ──────────────────────────────────── */}
      <View style={[styles.sectionHead, { marginTop: 28 }]}>
        <Image source={FLUENT_CLOCK} style={styles.sectionIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Eccezioni</Text>
          <Text style={styles.sectionSub}>Giorni che cambiano rispetto alla settimana tipo.</Text>
        </View>
      </View>

      {overridesLoading ? (
        <View style={styles.card}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.exRow, i > 0 && styles.exRowBorder]}>
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width={140} height={14} radius={7} />
                <SkeletonBlock width={90} height={11} radius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : upcomingOverrides.length > 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
          {upcomingOverrides.map((o, i) => {
            const absent = o.ranges.length === 0;
            return (
              <Pressable
                key={o.id}
                onPress={() => openExceptionSheet(o)}
                style={({ pressed }) => [styles.exRow, i > 0 && styles.exRowBorder, pressed && { opacity: 0.55 }]}
              >
                <View style={[styles.exDot, { backgroundColor: absent ? '#F59E0B' : '#1A1A2E' }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.exDate}>{formatExceptionDate(o.date)}</Text>
                  <Text style={[styles.exSummary, absent && styles.exSummaryAbsent]} numberOfLines={1}>
                    {absent ? 'Assente' : o.ranges.map((r) => `${fmtMin(r.startMinutes)}–${fmtMin(r.endMinutes)}`).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
              </Pressable>
            );
          })}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyCard}>
          <Image source={FLUENT_CALENDAR} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Nessuna eccezione in programma.</Text>
        </Animated.View>
      )}

      <Pressable
        onPress={() => openExceptionSheet()}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="add" size={20} color="#1A1A2E" />
        <Text style={styles.addText}>Aggiungi eccezione</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 14 },

  /* Section header */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  sectionIcon: { width: 30, height: 30, resizeMode: 'contain' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },

  /* Cards */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEDF0',
  },

  /* Day pills */
  daysRow: { flexDirection: 'row', gap: 6 },
  dayPill: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayPillActive: { backgroundColor: '#1A1A2E' },
  dayPillInactive: { backgroundColor: '#F1F5F9' },
  dayPillText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  dayPillTextActive: { color: '#FFFFFF' },

  /* CTA */
  cta: {
    backgroundColor: '#1A1A2E', minHeight: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },

  /* Exception rows */
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  exRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  exDot: { width: 9, height: 9, borderRadius: 4.5 },
  exDate: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  exSummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  exSummaryAbsent: { color: '#B45309', fontWeight: '600' },

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 30, alignItems: 'center', gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
  },
  emptyIcon: { width: 46, height: 46, resizeMode: 'contain', opacity: 0.9 },
  emptyText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  /* Add exception */
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', marginTop: 2,
  },
  addText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
});
