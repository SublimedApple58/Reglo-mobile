import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SkeletonBlock } from '../components/Skeleton';
import { ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { DailyAvailabilityOverride, TimeRange } from '../types/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { publishDayStore } from '../stores/publishDayStore';
import { availabilityExceptionStore } from '../stores/availabilityExceptionStore';
import { availabilityCache } from '../services/availabilityCache';
import { colors } from '../theme';

// The one Fluent 3D accent on this screen (decision: keep a single one in the header).
const FLUENT_CALENDAR = require('../../assets/icons/fluent-calendar.png');

const HAIRLINE = '#ECECEC';

// Render order Lun→Dom; values follow the backend convention 0=Sun..6=Sat.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITALIAN_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const DEFAULT_RANGE: TimeRange = { startMinutes: 540, endMinutes: 1080 };

type Schedule = Record<number, TimeRange[]>;

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
};

export const DefaultAvailabilityEditor = ({ instructorId, weeks, onToast }: Props) => {
  const router = useRouter();

  // ── Orari settimanali (per-weekday base) ──
  const [schedule, setSchedule] = useState<Schedule>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string>(''); // key of last-saved schedule; '' until loaded

  // ── Eccezioni (overrides) ──
  const [overrides, setOverrides] = useState<DailyAvailabilityOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);

  const loadBase = useCallback(async () => {
    const cached = await availabilityCache.getBase(instructorId);
    if (cached?.scheduleByDay) {
      setSchedule(cached.scheduleByDay);
      savedRef.current = keyOf(cached.scheduleByDay);
      setLoading(false);
    }
    try {
      const res = await regloApi.getDefaultAvailability({ ownerType: 'instructor', ownerId: instructorId });
      if (res) {
        setSchedule(res.scheduleByDay);
        savedRef.current = keyOf(res.scheduleByDay);
        availabilityCache.setBase(instructorId, { scheduleByDay: res.scheduleByDay });
      } else if (!cached) {
        // New instructor: suggest Lun–Ven 09:00–18:00 (reads as dirty → prompts a save).
        const suggested: Schedule = {};
        [1, 2, 3, 4, 5].forEach((d) => { suggested[d] = [{ ...DEFAULT_RANGE }]; });
        setSchedule(suggested);
        savedRef.current = keyOf({});
      }
    } catch {
      if (!cached) onToast('Errore caricando gli orari', 'danger');
    } finally {
      setLoading(false);
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
    setSaving(true);
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

      await regloApi.createAvailabilitySlots({
        ownerType: 'instructor',
        ownerId: instructorId,
        startsAt: sd.toISOString(),
        endsAt: ed.toISOString(),
        weeks,
        scheduleByDay,
      });
      availabilityCache.setBase(instructorId, { scheduleByDay });
      savedRef.current = keyOf(scheduleByDay);
      onToast('Orari salvati', 'success');
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

  const isDirty = !loading && savedRef.current !== '' && savedRef.current !== keyOf(schedule);

  return (
    <View>
      {/* ── Orari settimanali ─────────────────────────── */}
      <View style={styles.head}>
        <Image source={FLUENT_CALENDAR} style={styles.headIcon} />
        <Text style={styles.headTitle}>Orari settimanali</Text>
      </View>

      {loading ? (
        <View style={styles.list}>
          {ORDER.map((d, i) => (
            <View key={d} style={[styles.row, i > 0 && styles.rowBorder]}>
              <SkeletonBlock width={90} height={16} radius={8} />
              <SkeletonBlock width={84} height={26} radius={999} />
            </View>
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={styles.list}>
            {ORDER.map((day, i) => {
              const ranges = schedule[day] ?? [];
              const off = ranges.length === 0;
              return (
                <Pressable
                  key={day}
                  onPress={() => openDaySheet(day)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.55 }]}
                >
                  <Text style={[styles.dayName, off && styles.dayNameOff]}>{DAY_FULL[day]}</Text>
                  <View style={styles.rowRight}>
                    {off ? (
                      <Text style={styles.offText}>Non disponibile</Text>
                    ) : (
                      <View style={styles.chips}>
                        {ranges.map((r, idx) => (
                          <View key={idx} style={styles.timeChip}>
                            <Text style={styles.timeChipText}>
                              {fmtMin(r.startMinutes)}–{fmtMin(r.endMinutes)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={17} color="#C7C7CC" />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {isDirty && (
            <Animated.View entering={FadeIn.duration(220)}>
              <Pressable
                onPress={saving ? undefined : handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, saving && styles.ctaDisabled]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Salva orari</Text>}
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* ── Eccezioni ─────────────────────────────────── */}
      <View style={styles.exHead}>
        <Text style={styles.exTitle}>Eccezioni</Text>
      </View>

      {overridesLoading ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
              <SkeletonBlock width={110} height={15} radius={8} />
              <SkeletonBlock width={84} height={24} radius={999} />
            </View>
          ))}
        </View>
      ) : upcomingOverrides.length > 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.list}>
          {upcomingOverrides.map((o, i) => {
            const absent = o.ranges.length === 0;
            return (
              <Pressable
                key={o.id}
                onPress={() => openExceptionSheet(o)}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.55 }]}
              >
                <Text style={styles.exDate} numberOfLines={1}>{formatExceptionDate(o.date)}</Text>
                <View style={styles.rowRight}>
                  {absent ? (
                    <Text style={styles.offText}>Assente</Text>
                  ) : (
                    <View style={styles.chips}>
                      {o.ranges.map((r, idx) => (
                        <View key={idx} style={styles.timeChip}>
                          <Text style={styles.timeChipText}>
                            {fmtMin(r.startMinutes)}–{fmtMin(r.endMinutes)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={17} color="#C7C7CC" />
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Nessuna eccezione in programma.</Text>
        </Animated.View>
      )}

      <Pressable
        onPress={() => openExceptionSheet()}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="add" size={18} color="#1A1A2E" />
        <Text style={styles.addText}>Aggiungi eccezione</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  /* Header — single Fluent accent + confident title */
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 6 },
  headIcon: { width: 26, height: 26, resizeMode: 'contain' },
  headTitle: { fontSize: 21, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },

  /* Flat list — full-bleed hairline dividers, lots of air */
  list: { marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 17, minHeight: 56,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: HAIRLINE },
  dayName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  dayNameOff: { color: '#9AA1AC' },

  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, justifyContent: 'flex-end' },
  offText: { fontSize: 14, fontWeight: '500', color: '#9AA1AC' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  timeChip: {
    backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 1,
  },
  timeChipText: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },

  /* Save CTA */
  cta: {
    backgroundColor: '#1A1A2E', minHeight: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },

  /* Eccezioni */
  exHead: { marginTop: 38, marginBottom: 2 },
  exTitle: { fontSize: 21, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  exDate: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },

  /* Empty — flat */
  emptyWrap: { paddingVertical: 26 },
  emptyText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  /* Add exception — Airbnb outline button (white + thin border, pill) */
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 26,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCDFE4', marginTop: 14,
  },
  addText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
});
