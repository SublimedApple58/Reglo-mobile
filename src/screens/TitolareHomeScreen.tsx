import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { CalendarDrawer } from '../components/CalendarDrawer';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaSettings,
  OutOfAvailabilityAppointment,
} from '../types/regloApi';
import { useNavigation } from '@react-navigation/native';
import { colors, radii, spacing } from '../theme';
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

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DEFAULT_HOUR_START = 7;
const HOUR_END = 21;

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
    return { border: '#94A3B8', badgeBg: '#F1F5F9', badgeText: '#64748B', label: s === 'cancelled' ? 'Annullata' : 'Assente' };
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
  const [outOfAvailAppointments, setOutOfAvailAppointments] = useState<OutOfAvailabilityAppointment[]>([]);
  const [outOfAvailSheetOpen, setOutOfAvailSheetOpen] = useState(false);
  const [outOfAvailActionPending, setOutOfAvailActionPending] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidaySheetOpen, setHolidaySheetOpen] = useState(false);
  const [holidaySheetDate, setHolidaySheetDate] = useState<Date | null>(null);
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayPending, setHolidayPending] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<AutoscuolaAppointmentWithRelations | null>(null);

  const dayScrollRef = useRef<ScrollView | null>(null);
  const dayScrollMountedRef = useRef(false);

  // ── Calendar days (same pattern as AllievoHomeScreen) ──
  const NAV_WEEKS = 52; // navigation: 1 year ahead

  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addDays(today, -7);
    const totalDays = 7 + NAV_WEEKS * 7;
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
  }, []);

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
  const loadHolidays = useCallback(async () => {
    try {
      const today = new Date();
      const from = addDays(today, -14);
      const to = addDays(today, 52 * 7);
      const response = await regloApi.getHolidays({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const set = new Set<string>();
      const list = Array.isArray(response) ? response : [];
      for (const h of list) {
        const d = new Date(h.date);
        set.add(toDateStr(d));
      }
      setHolidays(set);
    } catch {
      // silent
    }
  }, []);

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

  const loadOutOfAvailability = useCallback(async () => {
    try {
      const data = await regloApi.getOutOfAvailabilityAppointments();
      setOutOfAvailAppointments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, []);

  const handleOutOfAvailAction = useCallback(async (
    appointmentId: string,
    action: 'cancel' | 'reposition' | 'approve',
  ) => {
    setOutOfAvailActionPending(appointmentId);
    try {
      if (action === 'cancel') {
        await regloApi.cancelAppointment(appointmentId);
        setToast({ text: 'Guida cancellata.', tone: 'success' });
      } else if (action === 'reposition') {
        await regloApi.repositionAppointment(appointmentId);
        setToast({ text: 'Riposizionamento avviato.', tone: 'success' });
      } else {
        await regloApi.approveAvailabilityOverride(appointmentId);
        setToast({ text: 'Guida mantenuta.', tone: 'success' });
      }
      loadOutOfAvailability();
      loadData(selectedDate);
    } catch {
      setToast({ text: 'Errore durante l\'operazione.', tone: 'danger' });
    } finally {
      setOutOfAvailActionPending(null);
    }
  }, [loadData, loadOutOfAvailability, selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadData(selectedDate).then(() => loadOutOfAvailability());
  }, [loadData, loadOutOfAvailability, selectedDate]);

  // Load holidays once on mount (full pill range)
  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(selectedDate);
    loadOutOfAvailability();
    setRefreshing(false);
  }, [loadData, loadOutOfAvailability, selectedDate]);

  // Re-fetch data when screen regains focus
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(selectedDate);
      loadOutOfAvailability();
    });
    return unsubscribe;
  }, [navigation, loadData, loadOutOfAvailability, selectedDate]);

  // ── Group appointments by hour ──
  const appointmentsByHour = useMemo(() => {
    const map = new Map<number, AutoscuolaAppointmentWithRelations[]>();
    for (const appt of appointments) {
      const st = (appt.status ?? '').trim().toLowerCase();
      if (st === 'proposal' || st === 'cancelled') continue;
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

  const isSelectedDateHoliday = useMemo(
    () => holidays.has(toDateStr(selectedDate)),
    [holidays, selectedDate],
  );

  const HOUR_SLOTS = useMemo(() => {
    let earliest = DEFAULT_HOUR_START;
    for (const appt of appointments) {
      const s = (appt.status ?? '').trim().toLowerCase();
      if (s === 'cancelled' || s === 'proposal') continue;
      const h = new Date(appt.startsAt).getHours();
      if (h < earliest) earliest = h;
    }
    return Array.from({ length: HOUR_END - earliest + 1 }, (_, i) => i + earliest);
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

        {outOfAvailAppointments.length > 0 && (
          <Pressable
            onPress={() => setOutOfAvailSheetOpen(true)}
            style={oobStyles.banner}
          >
            <Ionicons name="alert-circle" size={18} color="#92400E" />
            <Text style={oobStyles.bannerText}>
              <Text style={oobStyles.bannerCount}>{outOfAvailAppointments.length}</Text>
              {' '}guid{outOfAvailAppointments.length === 1 ? 'a' : 'e'} fuori disponibilità
            </Text>
            <Text style={oobStyles.bannerAction}>Gestisci</Text>
          </Pressable>
        )}

        {/* ── Horizontal Day Picker ── */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="return-down-back-outline" size={20} color="#94A3B8" />
              </Pressable>
              <Pressable
                onPress={() => setCalendarDrawerOpen(true)}
                style={styles.calendarIconBtn}
              >
                <Ionicons name="calendar-outline" size={22} color="#94A3B8" />
              </Pressable>
            </View>
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
              const isDayHoliday = holidays.has(toDateStr(dayNorm));
              return (
                <Pressable
                  key={`day-${index}`}
                  style={[
                    styles.dayPill,
                    isDayHoliday && !isSelected && !isToday
                      ? styles.dayPillHoliday
                      : isSelected
                        ? styles.dayPillSelected
                        : isToday
                          ? styles.dayPillToday
                          : styles.dayPillUnselected,
                  ]}
                  onPress={() => setSelectedDate(day.date)}
                  onLongPress={() => {
                    if (isDayHoliday) {
                      Alert.alert(
                        'Rimuovere festivo?',
                        'La disponibilità normale verrà ripristinata.',
                        [
                          { text: 'Annulla', style: 'cancel' },
                          {
                            text: 'Rimuovi',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await regloApi.deleteHoliday({ date: toDateStr(dayNorm) });
                                setToast({ text: 'Festivo rimosso.', tone: 'success' });
                                loadData(selectedDate); loadHolidays();
                              } catch {
                                setToast({ text: 'Errore.', tone: 'danger' });
                              }
                            },
                          },
                        ],
                      );
                    } else {
                      setHolidaySheetDate(dayNorm);
                      setHolidayLabel('');
                      setHolidaySheetOpen(true);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dayPillWeekday,
                      isDayHoliday && !isSelected && !isToday
                        ? styles.dayPillWeekdayHoliday
                        : isSelected
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
                      isDayHoliday && !isSelected && !isToday
                        ? styles.dayPillNumberHoliday
                        : isSelected
                          ? styles.dayPillNumberSelected
                          : isToday
                            ? styles.dayPillNumberToday
                            : styles.dayPillNumberUnselected,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                  {isDayHoliday && (
                    <View style={styles.holidayDot} />
                  )}
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
        ) : isSelectedDateHoliday ? (
          <View style={styles.emptyState}>
            <Ionicons name="ban-outline" size={48} color="#DC2626" style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyText, { color: '#DC2626' }]}>Giorno festivo</Text>
            <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
              L'autoscuola è chiusa
            </Text>
            <Pressable
              style={styles.removeHolidayBtn}
              onPress={() => {
                Alert.alert(
                  'Rimuovere festivo?',
                  'La disponibilità normale verrà ripristinata.',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Rimuovi',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await regloApi.deleteHoliday({ date: toDateStr(selectedDate) });
                          setToast({ text: 'Festivo rimosso.', tone: 'success' });
                          loadData(selectedDate);
                        } catch {
                          setToast({ text: 'Errore.', tone: 'danger' });
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.removeHolidayBtnText}>Rimuovi festivo</Text>
            </Pressable>
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
                          <Pressable
                            key={appt.id}
                            style={[
                              styles.appointmentBlock,
                              { borderLeftColor: config.border },
                            ]}
                            onPress={() => setSelectedAppt(appt)}
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
                          </Pressable>
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

      {/* ── Out of Availability BottomSheet ── */}
      <BottomSheet
        visible={outOfAvailSheetOpen}
        onClose={() => setOutOfAvailSheetOpen(false)}
        title="Guide fuori disponibilità"
        showHandle
      >
        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
          {outOfAvailAppointments.map((apt) => {
            const isLoading = outOfAvailActionPending === apt.id;
            return (
            <View key={apt.id} style={[oobStyles.card, isLoading && { opacity: 0.5 }]}>
              <View style={oobStyles.cardHeader}>
                <Text style={oobStyles.studentName}>{apt.studentName}</Text>
                <View style={[
                  oobStyles.badge,
                  apt.outOfAvailabilityFor.length > 1
                    ? oobStyles.badgeBoth
                    : apt.outOfAvailabilityFor.includes('instructor')
                      ? oobStyles.badgeInstructor
                      : oobStyles.badgeVehicle,
                ]}>
                  <Text style={[
                    oobStyles.badgeText,
                    apt.outOfAvailabilityFor.length > 1
                      ? oobStyles.badgeTextBoth
                      : apt.outOfAvailabilityFor.includes('instructor')
                        ? oobStyles.badgeTextInstructor
                        : oobStyles.badgeTextVehicle,
                  ]}>
                    {apt.outOfAvailabilityFor.length > 1
                      ? 'Entrambi'
                      : apt.outOfAvailabilityFor.includes('instructor')
                        ? 'Istruttore'
                        : 'Veicolo'}
                  </Text>
                </View>
              </View>
              <Text style={oobStyles.cardTime}>
                {new Date(apt.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                {' \u00B7 '}
                {formatTime(apt.startsAt)} – {formatTime(apt.endsAt)}
              </Text>
              {apt.instructorName && (
                <Text style={oobStyles.cardMeta}>{apt.instructorName}</Text>
              )}
              {apt.vehicleName && (
                <Text style={oobStyles.cardMeta}>{apt.vehicleName}</Text>
              )}
              <View style={oobStyles.actions}>
                <Pressable
                  style={oobStyles.actionBtn}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'reposition')}
                >
                  <Text style={oobStyles.actionBtnText}>Riposiziona</Text>
                </Pressable>
                <Pressable
                  style={[oobStyles.actionBtn, oobStyles.actionBtnDanger]}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'cancel')}
                >
                  <Text style={[oobStyles.actionBtnText, oobStyles.actionBtnDangerText]}>Cancella</Text>
                </Pressable>
                <Pressable
                  style={[oobStyles.actionBtn, oobStyles.actionBtnPrimary]}
                  disabled={isLoading}
                  onPress={() => handleOutOfAvailAction(apt.id, 'approve')}
                >
                  <Text style={[oobStyles.actionBtnText, oobStyles.actionBtnPrimaryText]}>Mantieni</Text>
                </Pressable>
              </View>
            </View>
            );
          })}
          {outOfAvailAppointments.length === 0 && (
            <Text style={oobStyles.emptyText}>Nessuna guida fuori disponibilità.</Text>
          )}
        </ScrollView>
      </BottomSheet>

      {/* ── Calendar Drawer ── */}
      <CalendarDrawer
        visible={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSelectDate={handleCalendarSelectDate}
        selectedDate={selectedDate}
        unlimitedNavigation
        caption="Seleziona un giorno per vedere le guide programmate"
      />

      {/* ── Holiday Creation BottomSheet ── */}
      <BottomSheet
        visible={holidaySheetOpen}
        onClose={() => { if (!holidayPending) setHolidaySheetOpen(false); }}
        title="Segna come festivo"
        showHandle
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: 16 }}>
          <Text style={{ fontSize: 14, color: '#64748B' }}>
            {holidaySheetDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#94A3B8', marginBottom: 6 }}>
              Nome festività (opzionale)
            </Text>
            <TextInput
              style={styles.holidayInput}
              placeholder="es. Ferragosto, Ferie estive..."
              placeholderTextColor="#CBD5E1"
              value={holidayLabel}
              onChangeText={setHolidayLabel}
              editable={!holidayPending}
            />
          </View>
          <Pressable
            style={[styles.holidayBtn, styles.holidayBtnOutline]}
            disabled={holidayPending}
            onPress={async () => {
              if (!holidaySheetDate) return;
              setHolidayPending(true);
              try {
                await regloApi.createHoliday({
                  date: toDateStr(holidaySheetDate),
                  label: holidayLabel || undefined,
                  cancelAppointments: false,
                });
                setToast({ text: 'Giorno festivo aggiunto.', tone: 'success' });
                setHolidaySheetOpen(false);
                loadData(selectedDate); loadHolidays();
              } catch {
                setToast({ text: 'Errore.', tone: 'danger' });
              } finally {
                setHolidayPending(false);
              }
            }}
          >
            <Text style={[styles.holidayBtnText, { color: '#64748B' }]}>Chiudi e mantieni guide</Text>
          </Pressable>
          <Pressable
            style={[styles.holidayBtn, styles.holidayBtnDestructive]}
            disabled={holidayPending}
            onPress={async () => {
              if (!holidaySheetDate) return;
              setHolidayPending(true);
              try {
                const result = await regloApi.createHoliday({
                  date: toDateStr(holidaySheetDate),
                  label: holidayLabel || undefined,
                  cancelAppointments: true,
                });
                const count = (result as any)?.cancelledCount ?? 0;
                setToast({
                  text: count > 0
                    ? `Festivo aggiunto. ${count} ${count === 1 ? 'guida cancellata' : 'guide cancellate'}.`
                    : 'Giorno festivo aggiunto.',
                  tone: 'success',
                });
                setHolidaySheetOpen(false);
                loadData(selectedDate); loadHolidays();
              } catch {
                setToast({ text: 'Errore.', tone: 'danger' });
              } finally {
                setHolidayPending(false);
              }
            }}
          >
            <Text style={[styles.holidayBtnText, { color: '#FFFFFF' }]}>Chiudi e cancella guide</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* ── Appointment Detail BottomSheet ── */}
      <BottomSheet
        visible={!!selectedAppt}
        onClose={() => setSelectedAppt(null)}
        title="Dettaglio guida"
      >
        {selectedAppt ? (
          <View style={styles.apptDetailContent}>
            <Text style={styles.apptDetailName}>
              {selectedAppt.student
                ? `${selectedAppt.student.firstName} ${selectedAppt.student.lastName}`
                : 'Studente'}
            </Text>
            {selectedAppt.student?.phone ? (
              <View style={styles.apptDetailContactRow}>
                <Pressable
                  style={styles.apptDetailContactBtn}
                  onPress={() => Linking.openURL(`tel:${selectedAppt.student!.phone}`)}
                >
                  <Text style={styles.apptDetailContactIcon}>📞</Text>
                  <Text style={styles.apptDetailContactLabel}>Chiama</Text>
                </Pressable>
                <Pressable
                  style={[styles.apptDetailContactBtn, styles.apptDetailContactWhatsapp]}
                  onPress={() => {
                    const num = selectedAppt.student!.phone!.replace(/[^0-9]/g, '');
                    Linking.openURL(`https://wa.me/${num}`);
                  }}
                >
                  <Text style={styles.apptDetailContactIcon}>💬</Text>
                  <Text style={styles.apptDetailContactLabel}>WhatsApp</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.apptDetailInfoRow}>
              <Text style={styles.apptDetailInfoLabel}>Orario</Text>
              <Text style={styles.apptDetailInfoValue}>{getAppointmentTimeRange(selectedAppt)}</Text>
            </View>
            <View style={styles.apptDetailInfoRow}>
              <Text style={styles.apptDetailInfoLabel}>Istruttore</Text>
              <Text style={styles.apptDetailInfoValue}>{selectedAppt.instructor?.name ?? 'N/D'}</Text>
            </View>
            <View style={styles.apptDetailInfoRow}>
              <Text style={styles.apptDetailInfoLabel}>Veicolo</Text>
              <Text style={styles.apptDetailInfoValue}>{selectedAppt.vehicle?.name ?? 'N/D'}</Text>
            </View>
            <View style={styles.apptDetailInfoRow}>
              <Text style={styles.apptDetailInfoLabel}>Stato</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig(selectedAppt.status).badgeBg }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig(selectedAppt.status).badgeText }]}>
                  {statusConfig(selectedAppt.status).label}
                </Text>
              </View>
            </View>
            {selectedAppt.notes?.trim() ? (
              <View style={styles.apptDetailNotesBox}>
                <Text style={styles.apptDetailNotesLabel}>Note</Text>
                <Text style={styles.apptDetailNotesText}>{selectedAppt.notes.trim()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

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
  dayPillHoliday: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  dayPillWeekdayHoliday: {
    color: '#DC2626',
  },
  dayPillNumberHoliday: {
    color: '#DC2626',
  },
  holidayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    position: 'absolute',
    bottom: 6,
  },
  removeHolidayBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  removeHolidayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  holidayInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  holidayBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  holidayBtnOutline: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  holidayBtnDestructive: {
    backgroundColor: '#DC2626',
  },
  holidayBtnText: {
    fontSize: 15,
    fontWeight: '600',
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

const oobStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  bannerCount: {
    fontWeight: '700',
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeInstructor: {
    backgroundColor: '#FEF3C7',
  },
  badgeVehicle: {
    backgroundColor: '#DBEAFE',
  },
  badgeBoth: {
    backgroundColor: '#FCE7F3',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextInstructor: {
    color: '#92400E',
  },
  badgeTextVehicle: {
    color: '#1E40AF',
  },
  badgeTextBoth: {
    color: '#9D174D',
  },
  cardTime: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  actionBtnDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  actionBtnDangerText: {
    color: '#DC2626',
  },
  actionBtnPrimary: {
    borderColor: '#EC4899',
    backgroundColor: '#EC4899',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 32,
  },

  /* ── Appointment Detail ── */
  apptDetailContent: {
    gap: 12,
    paddingHorizontal: 4,
  },
  apptDetailName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  apptDetailContactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  apptDetailContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  apptDetailContactWhatsapp: {
    backgroundColor: '#F0FDF4',
  },
  apptDetailContactIcon: {
    fontSize: 16,
  },
  apptDetailContactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  apptDetailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  apptDetailInfoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  apptDetailInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  apptDetailNotesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  apptDetailNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  apptDetailNotesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
