import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaSettings,
} from '../types/regloApi';
import { colors, spacing } from '../theme';
import { formatTime } from '../utils/date';

// ─── Helpers ─────────────────────────────────────────────────
const pad = (value: number) => value.toString().padStart(2, '0');

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const ITALIAN_WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'] as const;
const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const;
const ITALIAN_MONTHS_SHORT = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
] as const;
const ITALIAN_WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'] as const;

const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00

type StatusColorConfig = {
  border: string;
  badgeBg: string;
  badgeText: string;
  label: string;
};

const statusConfig = (status: string): StatusColorConfig => {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'pending_review')
    return { border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#EA580C', label: 'Da confermare' };
  if (s === 'checked_in')
    return { border: '#EC4899', badgeBg: '#FDF2F8', badgeText: '#EC4899', label: 'In corso' };
  if (s === 'completed')
    return { border: '#22C55E', badgeBg: '#F0FDF4', badgeText: '#16A34A', label: 'Completata' };
  if (s === 'cancelled' || s === 'no_show')
    return { border: '#94A3B8', badgeBg: '#F1F5F9', badgeText: '#64748B', label: s === 'cancelled' ? 'Annullata' : 'No-show' };
  // scheduled / confirmed / default
  return { border: '#FACC15', badgeBg: '#FEF9C3', badgeText: '#CA8A04', label: 'Programmata' };
};

const formatSubtitleDate = (date: Date): string => {
  const wd = ITALIAN_WEEKDAYS_SHORT[date.getDay()];
  const day = pad(date.getDate());
  const month = ITALIAN_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${wd} ${day} ${month} ${year}`;
};

const formatHourLabel = (hour: number): string => `${pad(hour)}:00`;

const getAppointmentTimeRange = (appointment: AutoscuolaAppointmentWithRelations): string => {
  const start = formatTime(appointment.startsAt);
  const end = appointment.endsAt ? formatTime(appointment.endsAt) : '';
  return end ? `${start} - ${end}` : start;
};

// ─── Component ───────────────────────────────────────────────
export const TitolareHomeScreen = () => {
  const { width: screenWidth } = useWindowDimensions();

  // ── State ──
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const dayScrollRef = useRef<ScrollView | null>(null);
  const dayScrollMountedRef = useRef(false);

  // ── Calendar days (same pattern as AllievoHomeScreen) ──
  const maxWeeks = Number(settings?.availabilityWeeks) || 4;

  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addDays(today, -7);
    const totalDays = 7 + maxWeeks * 7;
    const days: { date: Date; dayNum: number; weekday: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        weekday: ITALIAN_WEEKDAYS[d.getDay()],
      });
    }
    return days;
  }, [maxWeeks]);

  const calendarMonthLabel = `${ITALIAN_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  // ── Scroll day pills ──
  const scrollToDay = useCallback(
    (animated: boolean) => {
      const DAY_PILL_WIDTH = 58;
      const DAY_PILL_GAP = 8;
      const selectedNorm = new Date(selectedDate);
      selectedNorm.setHours(0, 0, 0, 0);
      const idx = calendarDays.findIndex(
        (d) => d.date.getTime() === selectedNorm.getTime(),
      );
      if (idx >= 0 && dayScrollRef.current) {
        const offset =
          idx * (DAY_PILL_WIDTH + DAY_PILL_GAP) -
          (screenWidth - spacing.lg * 2) / 2 +
          DAY_PILL_WIDTH / 2;
        dayScrollRef.current.scrollTo({ x: Math.max(0, offset), animated });
      }
    },
    [calendarDays, screenWidth, selectedDate],
  );

  const handleDayScrollLayout = useCallback(() => {
    if (!dayScrollMountedRef.current) {
      dayScrollMountedRef.current = true;
      scrollToDay(false);
    }
  }, [scrollToDay]);

  useEffect(() => {
    if (dayScrollMountedRef.current) {
      scrollToDay(true);
    }
  }, [scrollToDay]);

  // ── Data fetching ──
  const loadData = useCallback(async (date: Date) => {
    setToast(null);
    try {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date);
      to.setHours(23, 59, 59, 999);

      const [appointmentsResponse, settingsResponse] = await Promise.all([
        regloApi.getAppointments({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 50,
        }),
        regloApi.getAutoscuolaSettings(),
      ]);

      setAppointments(appointmentsResponse);
      setSettings(settingsResponse);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel caricamento',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(selectedDate);
    setRefreshing(false);
  }, [loadData, selectedDate]);

  // ── Group appointments by hour ──
  const appointmentsByHour = useMemo(() => {
    const map = new Map<number, AutoscuolaAppointmentWithRelations[]>();
    for (const appt of appointments) {
      if ((appt.status ?? '').trim().toLowerCase() === 'proposal') continue;
      const hour = new Date(appt.startsAt).getHours();
      const list = map.get(hour) ?? [];
      list.push(appt);
      map.set(hour, list);
    }
    // Sort each hour group by time
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [appointments]);

  const hasAppointments = appointmentsByHour.size > 0;

  // ── CalendarDrawer handler ──
  const handleCalendarSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // ── Render ──
  return (
    <Screen>
      <StatusBar style="dark" />
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
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Calendario</Text>
            <Text style={styles.subtitle}>{formatSubtitleDate(selectedDate)}</Text>
          </View>
        </View>

        {/* ── Horizontal Day Picker ── */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
            <Pressable
              onPress={() => setCalendarDrawerOpen(true)}
              style={styles.calendarIconBtn}
            >
              <Ionicons name="calendar-outline" size={22} color="#94A3B8" />
            </Pressable>
          </View>
          <ScrollView
            ref={dayScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayPillsRow}
            onLayout={handleDayScrollLayout}
          >
            {calendarDays.map((day, index) => {
              const dayNorm = new Date(day.date);
              dayNorm.setHours(0, 0, 0, 0);
              const selNorm = new Date(selectedDate);
              selNorm.setHours(0, 0, 0, 0);
              const todayNorm = new Date();
              todayNorm.setHours(0, 0, 0, 0);
              const isToday = dayNorm.getTime() === todayNorm.getTime();
              const isSelected = dayNorm.getTime() === selNorm.getTime() && !isToday;
              return (
                <Pressable
                  key={`day-${index}`}
                  style={[
                    styles.dayPill,
                    isSelected
                      ? styles.dayPillSelected
                      : isToday
                        ? styles.dayPillToday
                        : styles.dayPillUnselected,
                  ]}
                  onPress={() => setSelectedDate(day.date)}
                >
                  <Text
                    style={[
                      styles.dayPillWeekday,
                      isSelected
                        ? styles.dayPillWeekdaySelected
                        : isToday
                          ? styles.dayPillWeekdayToday
                          : styles.dayPillWeekdayUnselected,
                    ]}
                  >
                    {day.weekday}
                  </Text>
                  <Text
                    style={[
                      styles.dayPillNumber,
                      isSelected
                        ? styles.dayPillNumberSelected
                        : isToday
                          ? styles.dayPillNumberToday
                          : styles.dayPillNumberUnselected,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Timeline ── */}
        {loading ? (
          <View style={styles.timelineSection}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`skeleton-hour-${i}`} style={styles.timelineRow}>
                <SkeletonBlock width={42} height={14} radius={6} />
                <View style={styles.timelineSlotArea}>
                  <SkeletonCard style={styles.skeletonApptCard}>
                    <SkeletonBlock width="60%" height={14} radius={6} />
                    <SkeletonBlock width="80%" height={12} radius={6} />
                    <SkeletonBlock width="40%" height={10} radius={6} />
                  </SkeletonCard>
                </View>
              </View>
            ))}
          </View>
        ) : hasAppointments ? (
          <View style={styles.timelineSection}>
            {HOUR_SLOTS.map((hour) => {
              const hourAppts = appointmentsByHour.get(hour);
              const hasAppts = hourAppts && hourAppts.length > 0;
              return (
                <View key={`hour-${hour}`} style={styles.timelineRow}>
                  <Text style={styles.hourLabel}>{formatHourLabel(hour)}</Text>
                  <View style={styles.timelineSlotArea}>
                    {hasAppts ? (
                      hourAppts.map((appt) => {
                        const config = statusConfig(appt.status);
                        return (
                          <View
                            key={appt.id}
                            style={[
                              styles.appointmentBlock,
                              { borderLeftColor: config.border },
                            ]}
                          >
                            <View style={styles.appointmentHeader}>
                              <Text style={styles.appointmentTime}>
                                {getAppointmentTimeRange(appt)}
                              </Text>
                              <View
                                style={[
                                  styles.statusBadge,
                                  { backgroundColor: config.badgeBg },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    { color: config.badgeText },
                                  ]}
                                >
                                  {config.label}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.appointmentStudent} numberOfLines={1}>
                              {appt.student
                                ? `${appt.student.firstName} ${appt.student.lastName}`
                                : 'Studente'}
                            </Text>
                            <Text style={styles.appointmentMeta} numberOfLines={1}>
                              {[
                                appt.instructor?.name,
                                appt.vehicle?.name,
                              ]
                                .filter(Boolean)
                                .join(' \u00B7 ') || 'Nessun dettaglio'}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptyHourLine} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* ── Empty State ── */
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/duck-zen.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>Nessuna guida oggi</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Calendar Drawer ── */}
      <CalendarDrawer
        visible={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSelectDate={handleCalendarSelectDate}
        selectedDate={selectedDate}
        maxWeeks={maxWeeks}
        caption="Seleziona un giorno per vedere le guide programmate"
      />

      {/* ── Toast ── */}
      {toast ? (
        <ToastNotice
          message={toast.text}
          tone={toast.tone}
          onHide={() => setToast(null)}
        />
      ) : null}
    </Screen>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: spacing.xs,
  },

  /* ── Calendar Section (day picker) ── */
  calendarSection: {
    gap: spacing.sm,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  calendarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillsRow: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayPill: {
    width: 58,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayPillSelected: {
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
    borderColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayPillUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillToday: {
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: '#FACC15',
    shadowColor: '#D97706',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayPillWeekday: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayPillWeekdaySelected: {
    color: '#BE185D',
  },
  dayPillWeekdayUnselected: {
    color: '#94A3B8',
  },
  dayPillWeekdayToday: {
    color: '#CA8A04',
  },
  dayPillNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayPillNumberSelected: {
    color: '#BE185D',
  },
  dayPillNumberUnselected: {
    color: '#1E293B',
  },
  dayPillNumberToday: {
    color: '#CA8A04',
  },

  /* ── Timeline ── */
  timelineSection: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 48,
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 50,
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    paddingTop: 2,
  },
  timelineSlotArea: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    paddingLeft: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: 48,
  },
  emptyHourLine: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderStyle: 'dashed',
    marginTop: 10,
    flex: 1,
  },

  /* ── Appointment Block ── */
  appointmentBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  appointmentStudent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  appointmentMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },

  /* ── Skeleton ── */
  skeletonApptCard: {
    gap: spacing.xs,
  },

  /* ── Empty State ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyImage: {
    width: 180,
    height: 112,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    fontStyle: 'italic',
    color: '#94A3B8',
  },
});
