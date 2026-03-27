import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { MiniCalendar } from '../components/MiniCalendar';
import RangesEditor from '../components/RangesEditor';
import { regloApi } from '../services/regloApi';
import { AutoscuolaVehicle, AutoscuolaSettings, DailyAvailabilityOverride, TimeRange } from '../types/regloApi';
import { colors, radii, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const GAP_THRESHOLD = 30; // minutes gap to detect separate ranges

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

const formatDateLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${ITALIAN_DAYS[date.getDay()]} ${d} ${ITALIAN_MONTHS[date.getMonth()]}`;
};

type AvailabilityEditorProps = {
  title: string;
  ownerType: 'student' | 'instructor' | 'vehicle';
  ownerId: string | null;
  weeks: number;
  onToast?: (text: string, tone?: ToastTone) => void;
};

/** Animated accordion wrapper for calendar day detail */
const DayDetailAccordion = ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
  const height = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    height.value = withTiming(visible ? 1 : 0, { duration: 280 });
  }, [visible, height]);

  const animStyle = useAnimatedStyle(() => ({
    maxHeight: height.value * 400,
    opacity: height.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animStyle}>
      {children}
    </Animated.View>
  );
};

/** Detect N ranges from sorted availability slots by finding gaps >= GAP_THRESHOLD */
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
    const currStart = new Date(usable[i].startsAt);
    const currEnd = new Date(usable[i].endsAt);
    const gapMinutes = (currStart.getTime() - rangeEnd.getTime()) / 60000;

    if (gapMinutes >= GAP_THRESHOLD) {
      // Close current range, start new one
      ranges.push({
        startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
        endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
      });
      rangeStart = currStart;
    }
    rangeEnd = currEnd;
  }

  // Close final range
  ranges.push({
    startMinutes: rangeStart.getHours() * 60 + rangeStart.getMinutes(),
    endMinutes: rangeEnd.getHours() * 60 + rangeEnd.getMinutes(),
  });

  return ranges;
};

export const AvailabilityEditor = ({
  title,
  ownerType,
  ownerId,
  weeks,
  onToast,
}: AvailabilityEditorProps) => {
  // ── Tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0); // 0 = Predefinito, 1 = Calendario, 2 = Ricorrente

  // ── Tab 0: Default weekly availability ─────────────────────────
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ranges, setRanges] = useState<TimeRange[]>([{ startMinutes: 540, endMinutes: 1080 }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Tab 1: Calendar overrides ──────────────────────────────────
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [dailyOverrides, setDailyOverrides] = useState<DailyAvailabilityOverride[]>([]);
  const [overrideRanges, setOverrideRanges] = useState<TimeRange[]>([{ startMinutes: 540, endMinutes: 1080 }]);
  const [overrideSaving, setOverrideSaving] = useState(false);

  // ── Tab 2: Recurring overrides ─────────────────────────────────
  const [recurringDay, setRecurringDay] = useState<number>(1); // Monday default
  const [recurringAbsent, setRecurringAbsent] = useState(false);
  const [recurringRanges, setRecurringRanges] = useState<TimeRange[]>([{ startMinutes: 540, endMinutes: 1080 }]);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [recurringSaving, setRecurringSaving] = useState(false);

  // ── Time picker state (shared across tabs) ─────────────────────
  const [timePickerTarget, setTimePickerTarget] = useState<{
    tab: 0 | 1 | 2;
    rangeIndex: number;
    field: 'start' | 'end';
  } | null>(null);

  // ── Computed: marked dates for calendar dots ───────────────────
  const markedDates = useMemo(
    () => new Set(dailyOverrides.map((o) => o.date.slice(0, 10))),
    [dailyOverrides],
  );

  // ── Toggle day circle ──────────────────────────────────────────
  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort(),
    );
  };

  // ── Load default preset (Tab 1) ───────────────────────────────
  const loadPreset = useCallback(async () => {
    if (!ownerId) {
      setDays([]);
      setRanges([{ startMinutes: 540, endMinutes: 1080 }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await regloApi.getDefaultAvailability({ ownerType, ownerId });
      if (!result) {
        setDays([]);
        setRanges([{ startMinutes: 540, endMinutes: 1080 }]);
        return;
      }
      setDays(result.daysOfWeek);
      setRanges(result.ranges.length ? result.ranges : [{ startMinutes: 540, endMinutes: 1080 }]);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore caricando disponibilita', 'danger');
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerType, onToast]);

  // ── Load daily overrides (Tab 2) ──────────────────────────────
  const loadOverrides = useCallback(async () => {
    if (!ownerId || ownerType === 'student') return;
    try {
      const res = await regloApi.getDailyAvailabilityOverrides({
        ownerType: ownerType as 'instructor' | 'vehicle',
        ownerId,
      });
      setDailyOverrides(res ?? []);
    } catch {
      // silently ignore
    }
  }, [ownerId, ownerType]);

  useEffect(() => {
    loadPreset();
    loadOverrides();
  }, [loadPreset, loadOverrides]);

  // ── When selecting a calendar date, load override ranges ───────
  const handleSelectCalendarDate = useCallback(
    (dateStr: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (selectedCalendarDate === dateStr) {
        // Toggle off
        setSelectedCalendarDate(null);
        return;
      }
      setSelectedCalendarDate(dateStr);

      // Check if an override exists for this date
      const existing = dailyOverrides.find((o) => o.date.slice(0, 10) === dateStr);
      if (existing && existing.ranges.length) {
        setOverrideRanges(existing.ranges);
      } else {
        // Pre-fill from default ranges
        setOverrideRanges(ranges.length ? [...ranges.map((r) => ({ ...r }))] : [{ startMinutes: 540, endMinutes: 1080 }]);
      }
    },
    [selectedCalendarDate, dailyOverrides, ranges],
  );

  // ── Tab switch handler ─────────────────────────────────────────
  const switchTab = (tab: 0 | 1 | 2) => {
    if (tab === activeTab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    setSelectedCalendarDate(null);
    setTimePickerTarget(null);
  };

  // ── Save default availability (Tab 1) ──────────────────────────
  const handleSaveDefault = async () => {
    if (!ownerId) return;
    if (!days.length) {
      onToast?.('Seleziona almeno un giorno', 'danger');
      return;
    }
    // Validate ranges
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].endMinutes <= ranges[i].startMinutes) {
        onToast?.(`Orario non valido nella fascia ${i + 1}`, 'danger');
        return;
      }
    }
    setSaving(true);
    try {
      // Build the create payload with backwards compat
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const r1 = ranges[0];
      const startDate = new Date(anchor);
      startDate.setHours(Math.floor(r1.startMinutes / 60), r1.startMinutes % 60, 0, 0);
      const endDate = new Date(anchor);
      endDate.setHours(Math.floor(r1.endMinutes / 60), r1.endMinutes % 60, 0, 0);

      const payload: Parameters<typeof regloApi.createAvailabilitySlots>[0] = {
        ownerType,
        ownerId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        daysOfWeek: days,
        weeks,
        ranges,
      };

      // Backwards compat: if we have a second range, also send startsAt2/endsAt2
      if (ranges.length >= 2) {
        const r2 = ranges[1];
        const s2 = new Date(anchor);
        s2.setHours(Math.floor(r2.startMinutes / 60), r2.startMinutes % 60, 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(Math.floor(r2.endMinutes / 60), r2.endMinutes % 60, 0, 0);
        payload.startsAt2 = s2.toISOString();
        payload.endsAt2 = e2.toISOString();
      }

      await regloApi.createAvailabilitySlots(payload);
      onToast?.('Disponibilita salvata', 'success');
      await loadPreset();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore salvando disponibilita', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // ── Save override for a single day (Tab 2) ────────────────────
  const handleSaveOverride = async () => {
    if (!ownerId || !selectedCalendarDate || ownerType === 'student') return;
    for (let i = 0; i < overrideRanges.length; i++) {
      if (overrideRanges[i].endMinutes <= overrideRanges[i].startMinutes) {
        onToast?.(`Orario non valido nella fascia ${i + 1}`, 'danger');
        return;
      }
    }
    setOverrideSaving(true);
    try {
      await regloApi.setDailyAvailabilityOverride({
        ownerType: ownerType as 'instructor' | 'vehicle',
        ownerId,
        date: selectedCalendarDate,
        ranges: overrideRanges,
      });
      onToast?.('Override salvato', 'success');
      await loadOverrides();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore salvando override', 'danger');
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Delete override for a single day (Tab 2) ──────────────────
  const handleDeleteOverride = async () => {
    if (!ownerId || !selectedCalendarDate || ownerType === 'student') return;
    setOverrideSaving(true);
    try {
      await regloApi.deleteDailyAvailabilityOverride({
        ownerType: ownerType as 'instructor' | 'vehicle',
        ownerId,
        date: selectedCalendarDate,
      });
      onToast?.('Override rimosso', 'success');
      setSelectedCalendarDate(null);
      await loadOverrides();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore rimuovendo override', 'danger');
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Mark day as absent (empty ranges) ────────────────────────
  const handleMarkAbsent = async () => {
    if (!ownerId || !selectedCalendarDate || ownerType === 'student') return;
    setOverrideSaving(true);
    try {
      await regloApi.setDailyAvailabilityOverride({
        ownerType: ownerType as 'instructor' | 'vehicle',
        ownerId,
        date: selectedCalendarDate,
        ranges: [],
      });
      onToast?.('Giornata segnata come assente', 'success');
      await loadOverrides();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore', 'danger');
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Save recurring override (Tab 2) ─────────────────────────
  const handleSaveRecurring = async () => {
    if (!ownerId || ownerType === 'student') return;
    if (!recurringAbsent) {
      for (let i = 0; i < recurringRanges.length; i++) {
        if (recurringRanges[i].endMinutes <= recurringRanges[i].startMinutes) {
          onToast?.(`Orario non valido nella fascia ${i + 1}`, 'danger');
          return;
        }
      }
    }
    setRecurringSaving(true);
    try {
      await regloApi.setRecurringAvailabilityOverride({
        ownerType: ownerType as 'instructor' | 'vehicle',
        ownerId,
        dayOfWeek: recurringDay,
        ranges: recurringAbsent ? [] : recurringRanges,
        weeksAhead: recurringWeeks,
      });
      onToast?.(`Override ricorrente salvato per ${recurringWeeks} settimane`, 'success');
      await loadOverrides();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore salvando override ricorrente', 'danger');
    } finally {
      setRecurringSaving(false);
    }
  };

  // ── Time picker handlers ───────────────────────────────────────
  const handleOpenTimePicker = (tab: 0 | 1 | 2, rangeIndex: number, field: 'start' | 'end') => {
    setTimePickerTarget({ tab, rangeIndex, field });
  };

  const timePickerSelectedTime = useMemo(() => {
    if (!timePickerTarget) return buildTime(9, 0);
    const targetRanges = timePickerTarget.tab === 0 ? ranges : timePickerTarget.tab === 1 ? overrideRanges : recurringRanges;
    const range = targetRanges[timePickerTarget.rangeIndex];
    if (!range) return buildTime(9, 0);
    const mins = timePickerTarget.field === 'start' ? range.startMinutes : range.endMinutes;
    return buildTime(Math.floor(mins / 60), mins % 60);
  }, [timePickerTarget, ranges, overrideRanges, recurringRanges]);

  const handleTimePickerSelect = useCallback(
    (date: Date) => {
      if (!timePickerTarget) return;
      const minutes = date.getHours() * 60 + date.getMinutes();
      const key = timePickerTarget.field === 'start' ? 'startMinutes' : 'endMinutes';

      if (timePickerTarget.tab === 0) {
        setRanges((prev) =>
          prev.map((r, i) => (i === timePickerTarget.rangeIndex ? { ...r, [key]: minutes } : r)),
        );
      } else if (timePickerTarget.tab === 1) {
        setOverrideRanges((prev) =>
          prev.map((r, i) => (i === timePickerTarget.rangeIndex ? { ...r, [key]: minutes } : r)),
        );
      } else {
        setRecurringRanges((prev) =>
          prev.map((r, i) => (i === timePickerTarget.rangeIndex ? { ...r, [key]: minutes } : r)),
        );
      }

    },
    [timePickerTarget],
  );

  // ── Check if selected calendar date has an override ────────────
  const selectedDateHasOverride = useMemo(
    () => selectedCalendarDate != null && markedDates.has(selectedCalendarDate),
    [selectedCalendarDate, markedDates],
  );

  const selectedDateIsAbsent = useMemo(() => {
    if (!selectedCalendarDate) return false;
    const existing = dailyOverrides.find((o) => o.date.slice(0, 10) === selectedCalendarDate);
    return existing != null && existing.ranges.length === 0;
  }, [selectedCalendarDate, dailyOverrides]);

  return (
    <View style={styles.availabilityCard}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
        </View>
      ) : null}
      <View
        style={[styles.editorContent, loading && styles.editorContentLoading]}
        pointerEvents={loading ? 'none' : 'auto'}
      >
        {/* ── Segmented control pills ─────────────────────────── */}
        {ownerType !== 'student' && (
          <View style={styles.segmentedControl}>
            <Pressable
              onPress={() => switchTab(0)}
              style={[styles.segmentedPill, activeTab === 0 && styles.segmentedPillActive]}
            >
              <Text style={[styles.segmentedPillText, activeTab === 0 && styles.segmentedPillTextActive]}>
                Predefinito
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchTab(1)}
              style={[styles.segmentedPill, activeTab === 1 && styles.segmentedPillActive]}
            >
              <Text style={[styles.segmentedPillText, activeTab === 1 && styles.segmentedPillTextActive]}>
                Calendario
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchTab(2)}
              style={[styles.segmentedPill, activeTab === 2 && styles.segmentedPillActive]}
            >
              <Text style={[styles.segmentedPillText, activeTab === 2 && styles.segmentedPillTextActive]}>
                Ricorrente
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Tab 1: Predefinito (default weekly) ──────────────── */}
        {activeTab === 0 && (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={{ gap: 16 }}>
            <View>
              <Text style={styles.fieldLabel}>GIORNI LAVORATIVI</Text>
              <View style={styles.dayCircleRow}>
                {dayLetters.map((letter, index) => (
                  <Pressable
                    key={`day-${index}`}
                    onPress={() => toggleDay(index)}
                    style={[
                      styles.dayCircle,
                      days.includes(index) ? styles.dayCircleActive : styles.dayCircleInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCircleText,
                        days.includes(index) ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>FASCE ORARIE</Text>
              <RangesEditor
                ranges={ranges}
                onChange={setRanges}
                onPickTime={(index, field) => handleOpenTimePicker(0, index, field)}
                onAddRange={() => {
                  setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                }}
                disabled={saving}
              />
            </View>

            <Pressable
              onPress={handleSaveDefault}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveCta,
                pressed && styles.saveCtaPressed,
                saving && styles.saveCtaDisabled,
              ]}
            >
              <Text style={styles.saveCtaText}>
                {saving ? 'Salvataggio...' : 'Salva disponibilit\u00E0'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Tab 2: Calendario (per-day overrides) ────────────── */}
        {activeTab === 1 && (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)}>
            <MiniCalendar
              selectedDate={selectedCalendarDate}
              onSelectDate={handleSelectCalendarDate}
              markedDates={markedDates}
              maxWeeks={52}
            />

            <DayDetailAccordion visible={selectedCalendarDate !== null}>
              {selectedCalendarDate && (
                <View style={styles.dayDetailCard}>
                  <View style={styles.dayDetailHeader}>
                    <Text style={styles.dayDetailLabel}>
                      {formatDateLabel(selectedCalendarDate)}
                    </Text>
                    {selectedDateIsAbsent ? (
                      <View style={[styles.overrideBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.overrideBadgeText, { color: '#DC2626' }]}>Assente</Text>
                      </View>
                    ) : selectedDateHasOverride ? (
                      <View style={styles.overrideBadge}>
                        <Text style={styles.overrideBadgeText}>Override attivo</Text>
                      </View>
                    ) : null}
                  </View>

                  {!selectedDateIsAbsent && (
                    <>
                      <RangesEditor
                        ranges={overrideRanges}
                        onChange={setOverrideRanges}
                        onPickTime={(index, field) => handleOpenTimePicker(1, index, field)}
                        onAddRange={() => {
                          setOverrideRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                        }}
                        disabled={overrideSaving}
                      />

                      <Pressable
                        onPress={handleSaveOverride}
                        disabled={overrideSaving}
                        style={({ pressed }) => [
                          styles.saveCta,
                          { marginTop: 4 },
                          pressed && styles.saveCtaPressed,
                          overrideSaving && styles.saveCtaDisabled,
                        ]}
                      >
                        <Text style={styles.saveCtaText}>
                          {overrideSaving ? 'Salvataggio...' : 'Salva orario personalizzato'}
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {!selectedDateIsAbsent && (
                    <Pressable
                      onPress={handleMarkAbsent}
                      disabled={overrideSaving}
                      style={({ pressed }) => [
                        styles.absentCta,
                        pressed && { opacity: 0.7 },
                        overrideSaving && styles.saveCtaDisabled,
                      ]}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                      <Text style={styles.absentCtaText}>
                        {overrideSaving ? 'Salvataggio...' : 'Segna come assente'}
                      </Text>
                    </Pressable>
                  )}

                  {selectedDateHasOverride && (
                    <Pressable onPress={handleDeleteOverride} disabled={overrideSaving} style={styles.resetOverrideBtn}>
                      <Text style={styles.resetOverrideText}>Ripristina predefinito</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </DayDetailAccordion>
          </Animated.View>
        )}

        {/* ── Tab 2: Ricorrente (recurring overrides) ────────────── */}
        {activeTab === 2 && (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={{ gap: 16 }}>
            <View>
              <Text style={styles.fieldLabel}>GIORNO DELLA SETTIMANA</Text>
              <View style={styles.dayCircleRow}>
                {dayLetters.map((letter, index) => (
                  <Pressable
                    key={`rday-${index}`}
                    onPress={() => setRecurringDay(index)}
                    style={[
                      styles.dayCircle,
                      recurringDay === index ? styles.dayCircleActive : styles.dayCircleInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCircleText,
                        recurringDay === index ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setRecurringAbsent((prev) => !prev);
              }}
              style={styles.absentToggle}
            >
              <View style={[styles.absentToggleCheck, recurringAbsent && styles.absentToggleCheckActive]}>
                {recurringAbsent && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.absentToggleText}>Assente tutto il giorno</Text>
            </Pressable>

            {!recurringAbsent && (
              <View>
                <Text style={styles.fieldLabel}>FASCE ORARIE</Text>
                <RangesEditor
                  ranges={recurringRanges}
                  onChange={setRecurringRanges}
                  onPickTime={(index, field) => handleOpenTimePicker(2, index, field)}
                  onAddRange={() => {
                    setRecurringRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }]);
                  }}
                  disabled={recurringSaving}
                />
              </View>
            )}

            <View>
              <Text style={styles.fieldLabel}>PER QUANTE SETTIMANE</Text>
              <View style={styles.weeksRow}>
                {[2, 4, 8, 12].map((w) => (
                  <Pressable
                    key={`w-${w}`}
                    onPress={() => setRecurringWeeks(w)}
                    style={[
                      styles.weekPill,
                      recurringWeeks === w && styles.weekPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekPillText,
                        recurringWeeks === w && styles.weekPillTextActive,
                      ]}
                    >
                      {w}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleSaveRecurring}
              disabled={recurringSaving}
              style={({ pressed }) => [
                styles.saveCta,
                pressed && styles.saveCtaPressed,
                recurringSaving && styles.saveCtaDisabled,
              ]}
            >
              <Text style={styles.saveCtaText}>
                {recurringSaving
                  ? 'Salvataggio...'
                  : recurringAbsent
                    ? `Segna assente ogni ${ITALIAN_DAYS[recurringDay].toLowerCase()}`
                    : `Salva per ${recurringWeeks} settimane`}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* ── Shared time picker drawer ────────────────────────────── */}
      <TimePickerDrawer
        visible={timePickerTarget !== null}
        selectedTime={timePickerSelectedTime}
        onSelectTime={handleTimePickerSelect}
        onClose={() => setTimePickerTarget(null)}
      />
    </View>
  );
};

export const InstructorManageScreen = () => {
  const { instructorId } = useSession();
  const [mainTab, setMainTab] = useState<'availability' | 'vehicles'>('availability');
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [createVehicleDrawerOpen, setCreateVehicleDrawerOpen] = useState(false);
  const [vehicleCreating, setVehicleCreating] = useState(false);
  const [editVehicleDrawerOpen, setEditVehicleDrawerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AutoscuolaVehicle | null>(null);
  const [vehicleAvailabilityDays, setVehicleAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [vehicleAvailabilityStart, setVehicleAvailabilityStart] = useState(buildTime(9, 0));
  const [vehicleAvailabilityEnd, setVehicleAvailabilityEnd] = useState(buildTime(18, 0));
  const [vehicleAvailabilityLoading, setVehicleAvailabilityLoading] = useState(false);
  const [vehicleAvailabilitySaving, setVehicleAvailabilitySaving] = useState(false);
  const [vehicleStatusSaving, setVehicleStatusSaving] = useState(false);
  const [vehicleStartTimePickerOpen, setVehicleStartTimePickerOpen] = useState(false);
  const [vehicleEndTimePickerOpen, setVehicleEndTimePickerOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [vehicleResponse, settingsResponse] = await Promise.all([
        regloApi.getVehicles(),
        regloApi.getAutoscuolaSettings(),
      ]);
      setVehicles(vehicleResponse);
      setSettings(settingsResponse);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel caricamento',
        tone: 'danger',
      });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetVehicleForm = () => {
    setVehicleName('');
    setVehiclePlate('');
  };

  const openVehicleDrawer = () => {
    resetVehicleForm();
    setCreateVehicleDrawerOpen(true);
  };

  const closeVehicleDrawer = () => {
    if (vehicleCreating) return;
    setCreateVehicleDrawerOpen(false);
  };

  const handleCreateVehicle = async () => {
    setToast(null);
    if (!vehicleName.trim()) {
      setToast({ text: 'Nome veicolo richiesto', tone: 'danger' });
      return;
    }
    setVehicleCreating(true);
    try {
      const created = await regloApi.createVehicle({
        name: vehicleName.trim(),
        plate: vehiclePlate || undefined,
      });
      setToast({ text: 'Veicolo creato', tone: 'success' });
      setVehicles((prev) => [created, ...prev]);
      setCreateVehicleDrawerOpen(false);
      resetVehicleForm();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleCreating(false);
    }
  };

  const toggleVehicleDay = (day: number) => {
    setVehicleAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  const loadEditingVehicleAvailability = useCallback(async (vehicleId: string) => {
    setVehicleAvailabilityLoading(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
      const responses = await Promise.all(
        dates.map((day) =>
          regloApi.getAvailabilitySlots({
            ownerType: 'vehicle',
            ownerId: vehicleId,
            date: toDateString(day),
          })
        )
      );

      const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const usableSlots = response
          .filter((slot) => slot.status !== 'cancelled')
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        if (!usableSlots.length) return;
        const first = new Date(usableSlots[0].startsAt);
        const last = new Date(usableSlots[usableSlots.length - 1].endsAt);
        const startMin = first.getHours() * 60 + first.getMinutes();
        const endMin = last.getHours() * 60 + last.getMinutes();
        ranges.push({ dayIndex: dates[index].getDay(), startMin, endMin });
      });

      if (!ranges.length) {
        setVehicleAvailabilityDays([]);
        setVehicleAvailabilityStart(buildTime(9, 0));
        setVehicleAvailabilityEnd(buildTime(18, 0));
        return;
      }

      const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
      const minStart = Math.min(...ranges.map((item) => item.startMin));
      const maxEnd = Math.max(...ranges.map((item) => item.endMin));
      setVehicleAvailabilityDays(daySet);
      setVehicleAvailabilityStart(buildTime(Math.floor(minStart / 60), minStart % 60));
      setVehicleAvailabilityEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore caricando disponibilita veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleAvailabilityLoading(false);
    }
  }, []);

  const openEditVehicleDrawer = async (vehicle: AutoscuolaVehicle) => {
    setEditingVehicle(vehicle);
    setEditVehicleDrawerOpen(true);
    await loadEditingVehicleAvailability(vehicle.id);
  };

  const closeEditVehicleDrawer = () => {
    if (vehicleAvailabilitySaving || vehicleStatusSaving) return;
    setEditVehicleDrawerOpen(false);
    setEditingVehicle(null);
  };

  const handleToggleEditingVehicleStatus = async () => {
    if (!editingVehicle) return;
    setToast(null);
    setVehicleStatusSaving(true);
    try {
      if (editingVehicle.status === 'inactive') {
        const updated = await regloApi.updateVehicle(editingVehicle.id, { status: 'active' });
        setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditingVehicle(updated);
        setToast({ text: 'Veicolo attivato', tone: 'success' });
      } else {
        const updated = await regloApi.deleteVehicle(editingVehicle.id);
        setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditingVehicle(updated);
        setToast({ text: 'Veicolo disattivato', tone: 'success' });
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore aggiornando veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleStatusSaving(false);
    }
  };

  const handleSaveEditingVehicleAvailability = async () => {
    if (!editingVehicle) return;
    if (!vehicleAvailabilityDays.length) {
      setToast({ text: 'Seleziona almeno un giorno', tone: 'danger' });
      return;
    }
    if (vehicleAvailabilityEnd <= vehicleAvailabilityStart) {
      setToast({ text: 'Orario non valido', tone: 'danger' });
      return;
    }
    setToast(null);
    setVehicleAvailabilitySaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(vehicleAvailabilityStart.getHours(), vehicleAvailabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(vehicleAvailabilityEnd.getHours(), vehicleAvailabilityEnd.getMinutes(), 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);
      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType: 'vehicle',
          ownerId: editingVehicle.id,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks: settings?.availabilityWeeks ?? 4,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) {
          throw err;
        }
      }
      await regloApi.createAvailabilitySlots({
        ownerType: 'vehicle',
        ownerId: editingVehicle.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: vehicleAvailabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });
      setToast({ text: 'Disponibilita veicolo salvata', tone: 'success' });
      setEditVehicleDrawerOpen(false);
      setEditingVehicle(null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando disponibilita veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleAvailabilitySaving(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>Profilo istruttore mancante</Text>
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gestione</Text>
          <Badge label="Istruttore" />
        </View>

        {/* Top-level tab bar */}
        <View style={styles.mainTabRow}>
          <Pressable
            onPress={() => {
              if (mainTab !== 'availability') {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMainTab('availability');
              }
            }}
            style={[
              styles.mainTab,
              mainTab === 'availability' && styles.mainTabActive,
            ]}
          >
            <Text
              style={[
                styles.mainTabText,
                mainTab === 'availability' ? styles.mainTabTextActive : styles.mainTabTextInactive,
              ]}
            >
              Disponibilit{'\u00E0'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (mainTab !== 'vehicles') {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMainTab('vehicles');
              }
            }}
            style={[
              styles.mainTab,
              mainTab === 'vehicles' && styles.mainTabActive,
            ]}
          >
            <Text
              style={[
                styles.mainTabText,
                mainTab === 'vehicles' ? styles.mainTabTextActive : styles.mainTabTextInactive,
              ]}
            >
              Veicoli
            </Text>
          </Pressable>
        </View>

        {initialLoading ? (
          <>
            {mainTab === 'availability' ? (
              <SkeletonCard style={styles.availabilitySkeletonCard}>
                <SkeletonBlock width="60%" height={12} />
                <SkeletonBlock width="50%" height={10} />
                <SkeletonBlock width="100%" height={40} radius={20} style={styles.skeletonButton} />
                <View style={styles.timeCardsRow}>
                  <SkeletonBlock width="48%" height={60} radius={radii.sm} />
                  <SkeletonBlock width="48%" height={60} radius={radii.sm} />
                </View>
                <SkeletonBlock width="100%" height={50} radius={radii.sm} style={styles.skeletonButton} />
              </SkeletonCard>
            ) : (
              <View style={styles.vehiclesSection}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={`vehicles-skeleton-${index}`} style={styles.vehicleSkeletonCard}>
                    <SkeletonBlock width="54%" height={18} />
                    <SkeletonBlock width="36%" height={14} />
                  </SkeletonCard>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {mainTab === 'availability' && (
              <AvailabilityEditor
                title={`Disponibilita istruttore · ${settings?.availabilityWeeks ?? 4} sett.`}
                ownerType="instructor"
                ownerId={instructorId}
                weeks={settings?.availabilityWeeks ?? 4}
                onToast={(text, tone = 'success') => setToast({ text, tone })}
              />
            )}

            {mainTab === 'vehicles' && (
              <View style={styles.vehiclesSection}>
                <Pressable
                  onPress={openVehicleDrawer}
                  style={({ pressed }) => [
                    styles.addVehicleButton,
                    pressed && styles.addVehicleButtonPressed,
                  ]}
                >
                  <Ionicons name="add" size={18} color="#92400E" style={{ marginRight: 4 }} />
                  <Text style={styles.addVehicleText}>Aggiungi veicolo</Text>
                </Pressable>

                {vehicles.map((vehicle) => (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => openEditVehicleDrawer(vehicle)}
                    style={({ pressed }) => [
                      styles.vehicleCard,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.vehicleCardEmoji}>{'\uD83D\uDE97'}</Text>
                    <View style={styles.vehicleCardInfo}>
                      <View style={styles.vehicleCardTopRow}>
                        <Text style={styles.vehicleName}>{vehicle.name}</Text>
                        <Badge
                          label={vehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                          tone={vehicle.status === 'inactive' ? 'warning' : 'success'}
                        />
                      </View>
                      <Text style={styles.vehiclePlate}>Targa: {vehicle.plate ?? '\u2014'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                  </Pressable>
                ))}
                {!vehicles.length ? <Text style={styles.emptyText}>Nessun veicolo.</Text> : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create Vehicle BottomSheet */}
      <BottomSheet
        visible={createVehicleDrawerOpen}
        title="Nuovo veicolo"
        onClose={closeVehicleDrawer}
        closeDisabled={vehicleCreating}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleCreating ? 'Creazione...' : 'Crea'}
                tone="primary"
                onPress={vehicleCreating ? undefined : handleCreateVehicle}
                disabled={vehicleCreating}
                fullWidth
              />
            </View>
          </View>
        }
      >
        <View style={styles.sheetContent}>
          <Input placeholder="Nome veicolo" value={vehicleName} onChangeText={setVehicleName} />
          <Input placeholder="Targa" value={vehiclePlate} onChangeText={setVehiclePlate} />
        </View>
      </BottomSheet>

      {/* Edit Vehicle BottomSheet */}
      <BottomSheet
        visible={editVehicleDrawerOpen}
        title={editingVehicle ? `Modifica ${editingVehicle.name}` : 'Modifica veicolo'}
        onClose={closeEditVehicleDrawer}
        closeDisabled={vehicleAvailabilitySaving || vehicleStatusSaving}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleAvailabilitySaving ? 'Salvataggio...' : 'Salva'}
                tone="primary"
                onPress={vehicleAvailabilitySaving ? undefined : handleSaveEditingVehicleAvailability}
                disabled={vehicleAvailabilitySaving || vehicleStatusSaving}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {editingVehicle ? (
          <View style={styles.sheetContent}>
            {/* Vehicle info card */}
            <View style={styles.vehicleInfoBox}>
              <View style={styles.vehicleInfoRow}>
                <View style={styles.vehicleInfoLeft}>
                  <Text style={styles.vehicleEmoji}>{'\uD83D\uDE97'}</Text>
                  <View>
                    <Text style={styles.vehicleInfoTitle}>{editingVehicle.name}</Text>
                    <Text style={styles.vehicleInfoMeta}>Targa: {editingVehicle.plate ?? '\u2014'}</Text>
                  </View>
                </View>
                <View style={[
                  styles.vehicleStatusBadge,
                  editingVehicle.status === 'inactive' ? styles.vehicleStatusInactive : styles.vehicleStatusActive,
                ]}>
                  <View style={[
                    styles.vehicleStatusDot,
                    { backgroundColor: editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A' },
                  ]} />
                  <Text style={[
                    styles.vehicleStatusLabel,
                    { color: editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A' },
                  ]}>
                    {editingVehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status toggle */}
            <Pressable
              onPress={vehicleStatusSaving ? undefined : handleToggleEditingVehicleStatus}
              disabled={vehicleStatusSaving || vehicleAvailabilitySaving}
              style={({ pressed }) => [
                styles.vehicleToggleBtn,
                pressed && { opacity: 0.8 },
                (vehicleStatusSaving || vehicleAvailabilitySaving) && { opacity: 0.5 },
              ]}
            >
              <Text style={[
                styles.vehicleToggleText,
                { color: editingVehicle.status === 'inactive' ? '#16A34A' : '#EF4444' },
              ]}>
                {vehicleStatusSaving
                  ? 'Aggiornamento...'
                  : editingVehicle.status === 'inactive'
                    ? 'Attiva veicolo'
                    : 'Disattiva veicolo'}
              </Text>
            </Pressable>
            <View style={styles.vehicleAvailabilitySection}>
              {vehicleAvailabilityLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
                </View>
              ) : (
                <View style={styles.editorContent}>
                  <View style={styles.dayCircleRow}>
                    {dayLetters.map((letter, index) => (
                      <Pressable
                        key={`vehicle-day-${index}`}
                        onPress={() => toggleVehicleDay(index)}
                        style={[
                          styles.dayCircle,
                          vehicleAvailabilityDays.includes(index) ? styles.dayCircleActive : styles.dayCircleInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCircleText,
                            vehicleAvailabilityDays.includes(index) ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                          ]}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.timeCardsRow}>
                    <Pressable
                      onPress={() => {
                        setEditVehicleDrawerOpen(false);
                        setTimeout(() => setVehicleStartTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Inizio</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>{toTimeString(vehicleAvailabilityStart)}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditVehicleDrawerOpen(false);
                        setTimeout(() => setVehicleEndTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Fine</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>{toTimeString(vehicleAvailabilityEnd)}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <TimePickerDrawer
        visible={vehicleStartTimePickerOpen}
        selectedTime={vehicleAvailabilityStart}
        onSelectTime={setVehicleAvailabilityStart}
        onClose={() => {
          setVehicleStartTimePickerOpen(false);
          setTimeout(() => setEditVehicleDrawerOpen(true), 350);
        }}
      />
      <TimePickerDrawer
        visible={vehicleEndTimePickerOpen}
        selectedTime={vehicleAvailabilityEnd}
        onSelectTime={setVehicleAvailabilityEnd}
        onClose={() => {
          setVehicleEndTimePickerOpen(false);
          setTimeout(() => setEditVehicleDrawerOpen(true), 350);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Main Tab Bar ───────────────────────────────── */
  mainTabRow: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mainTab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabActive: {
    borderBottomColor: '#EC4899',
  },
  mainTabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainTabTextActive: {
    color: '#EC4899',
  },
  mainTabTextInactive: {
    color: '#94A3B8',
  },

  /* ─── Availability Section ─────────────────────────── */
  availabilityCard: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weeksSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  editorContent: {
    gap: spacing.sm,
  },
  editorContentLoading: {
    opacity: 0.5,
  },

  /* ─── Segmented Control ──────────────────────────── */
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 3,
    marginBottom: 8,
    alignSelf: 'center',
  },
  segmentedPill: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  segmentedPillTextActive: {
    color: '#1E293B',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  /* ─── Day Circles ─────────────────────────────────── */
  dayCircleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#FACC15',
  },
  dayCircleInactive: {
    backgroundColor: '#F1F5F9',
  },
  dayCircleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  dayCircleTextInactive: {
    color: '#64748B',
  },

  /* ─── Time Picker Cards ───────────────────────────── */
  timeCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  timeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  timeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeCardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Save CTA ────────────────────────────────────── */
  saveCta: {
    width: '100%',
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveCtaPressed: {
    transform: [{ scale: 0.98 }],
  },
  saveCtaDisabled: {
    opacity: 0.6,
  },
  /* ─── Day Detail Card (Calendar Tab) ────────────── */
  dayDetailCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: spacing.sm,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayDetailLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  overrideBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  overrideBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  resetOverrideBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  resetOverrideText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  absentCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  absentCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  absentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  absentToggleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  absentToggleCheckActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  absentToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  weeksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  weekPillActive: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  weekPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  weekPillTextActive: {
    color: '#FFFFFF',
  },
  saveCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ─── Vehicles Section ────────────────────────────── */
  vehiclesSection: {
    gap: spacing.sm,
  },
  addVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    backgroundColor: '#FACC15',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  addVehicleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  addVehicleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  vehicleCardEmoji: {
    fontSize: 28,
  },
  vehicleCardInfo: {
    flex: 1,
    gap: 2,
  },
  vehicleCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  vehiclePlate: {
    fontSize: 13,
    color: '#94A3B8',
  },

  /* ─── Loading ─────────────────────────────────────── */
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  /* ─── Skeletons ───────────────────────────────────── */
  availabilitySkeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
    padding: 22,
  },
  vehicleSkeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },

  /* ─── Empty State ─────────────────────────────────── */
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyCardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },

  /* ─── BottomSheet Content ─────────────────────────── */
  sheetContent: {
    gap: spacing.sm,
  },
  vehicleInfoBox: {
    padding: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleEmoji: {
    fontSize: 22,
  },
  vehicleInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  vehicleInfoMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  vehicleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  vehicleStatusActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  vehicleStatusInactive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  vehicleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vehicleStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  vehicleToggleBtn: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleAvailabilitySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetActionsDock: {
    gap: spacing.sm,
    alignItems: 'stretch',
    width: '100%',
  },
  fullWidthButtonWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
