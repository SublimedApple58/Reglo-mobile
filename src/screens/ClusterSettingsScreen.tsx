import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- expo-clipboard non è nel binario
  // corrente (aggiungerlo richiede una build nativa): il Clipboard core di RN è OTA-safe.
  Clipboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { groupStudentsStore } from '../stores/groupStudentsStore';
import { clusterSettingsStore, ClusterCompanyDefaults } from '../stores/clusterSettingsStore';
import { colors } from '../theme';

const H_PAD = 22;
const COMPACT_H = 54;
const LARGE_TITLE_H = 56;

const timeStringToDate = (hhmm: string | undefined | null): Date => {
  const safe = hhmm ?? '08:00';
  const [h, m] = safe.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
};
const dateToTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const DEFAULTS: ClusterCompanyDefaults = {
  bookingSlotDurations: [30, 60],
  roundedHoursOnly: false,
  appBookingActors: 'students',
  instructorBookingMode: 'manual_engine',
  swapEnabled: false,
  studentCancellationEnabled: true,
  bookingCutoffEnabled: false,
  bookingCutoffTime: '18:00',
  weeklyBookingLimitEnabled: false,
  weeklyBookingLimit: 3,
  weeklyAbsenceEnabled: false,
  restrictedTimeRangeEnabled: false,
  restrictedTimeRangeStart: '08:00',
  restrictedTimeRangeEnd: '13:00',
};

export const ClusterSettingsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [saving, setSaving] = useState(false);

  const [companyDefaults, setCompanyDefaults] = useState<ClusterCompanyDefaults>(DEFAULTS);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([30, 60]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [appBookingActors, setAppBookingActors] = useState<string | undefined>(undefined);
  const [instructorBookingMode, setInstructorBookingMode] = useState<string | undefined>(undefined);
  const [swapEnabled, setSwapEnabled] = useState<boolean | undefined>(undefined);
  const [studentCancellationEnabled, setStudentCancellationEnabled] = useState<boolean | undefined>(undefined);
  const [bookingCutoffEnabled, setBookingCutoffEnabled] = useState<boolean | undefined>(undefined);
  const [bookingCutoffTime, setBookingCutoffTime] = useState<string | undefined>(undefined);
  const [weeklyLimitEnabled, setWeeklyLimitEnabled] = useState<boolean | undefined>(undefined);
  const [weeklyLimit, setWeeklyLimit] = useState<number | undefined>(undefined);
  const [weeklyAbsenceEnabled, setWeeklyAbsenceEnabled] = useState<boolean | undefined>(undefined);
  const [restrictedTimeEnabled, setRestrictedTimeEnabled] = useState<boolean | undefined>(undefined);
  const [restrictedTimeStart, setRestrictedTimeStart] = useState<string | undefined>(undefined);
  const [restrictedTimeEnd, setRestrictedTimeEnd] = useState<string | undefined>(undefined);
  const [allStudents, setAllStudents] = useState<Array<{ id: string; firstName: string; lastName: string; assignedInstructorId: string | null }>>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await regloApi.getInstructorSettings();
      setCompanyDefaults(res.companyDefaults);
      setBookingSlotDurations(res.settings.bookingSlotDurations ?? res.companyDefaults.bookingSlotDurations);
      setRoundedHoursOnly(res.settings.roundedHoursOnly ?? res.companyDefaults.roundedHoursOnly);
      setAppBookingActors(res.settings.appBookingActors);
      setInstructorBookingMode(res.settings.instructorBookingMode);
      setSwapEnabled(res.settings.swapEnabled);
      setStudentCancellationEnabled(res.settings.studentCancellationEnabled);
      setBookingCutoffEnabled(res.settings.bookingCutoffEnabled);
      setBookingCutoffTime(res.settings.bookingCutoffTime);
      setWeeklyLimitEnabled(res.settings.weeklyBookingLimitEnabled);
      setWeeklyLimit(res.settings.weeklyBookingLimit);
      setWeeklyAbsenceEnabled(res.settings.weeklyAbsenceEnabled);
      setRestrictedTimeEnabled(res.settings.restrictedTimeRangeEnabled);
      setRestrictedTimeStart(res.settings.restrictedTimeRangeStart);
      setRestrictedTimeEnd(res.settings.restrictedTimeRangeEnd);
      setAllStudents(res.students ?? []);
      setAssignedStudentIds(res.assignedStudentIds ?? []);
      setAutonomousMode(res.autonomousMode === true);
      setInviteCode(res.inviteCode ?? null);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const assignedCount = useMemo(
    () => allStudents.filter((s) => assignedStudentIds.includes(s.id)).length,
    [allStudents, assignedStudentIds],
  );

  const toggleDuration = (dur: number) => {
    setBookingSlotDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur].sort((a, b) => a - b),
    );
  };

  const openStudentsSheet = () => {
    groupStudentsStore.set({
      allStudents,
      assignedIds: assignedStudentIds,
      onConfirm: async (ids) => {
        setAssignedStudentIds(ids);
        // Persist the roster change immediately (per-action save).
        setSaving(true);
        try {
          await regloApi.updateInstructorSettings({ assignStudentIds: ids });
          setToast({ text: 'Gruppo aggiornato', tone: 'success' });
        } catch {
          setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
        } finally {
          setSaving(false);
        }
      },
    });
    router.push('/(tabs)/notes/group-students');
  };

  const copyInviteCode = () => {
    if (!inviteCode) return;
    Clipboard.setString(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setToast({ text: 'Codice copiato', tone: 'success' });
  };

  const openTimePicker = (current: string, onPick: (hhmm: string) => void) => {
    timePickerStore.set({
      selectedTime: timeStringToDate(current),
      onConfirm: (d) => onPick(dateToTimeString(d)),
    });
    router.push('/(tabs)/notes/time-picker');
  };

  const handleSave = useCallback(async () => {
    if (!bookingSlotDurations.length) {
      setToast({ text: 'Seleziona almeno una durata', tone: 'danger' });
      return;
    }
    setSaving(true);
    try {
      await regloApi.updateInstructorSettings({
        bookingSlotDurations,
        roundedHoursOnly,
        appBookingActors: appBookingActors as 'students' | 'instructors' | 'both' | undefined,
        instructorBookingMode: instructorBookingMode as 'manual_full' | 'manual_engine' | undefined,
        swapEnabled,
        studentCancellationEnabled,
        bookingCutoffEnabled,
        bookingCutoffTime,
        weeklyBookingLimitEnabled: weeklyLimitEnabled,
        weeklyBookingLimit: weeklyLimit,
        weeklyAbsenceEnabled,
        restrictedTimeRangeEnabled: restrictedTimeEnabled,
        restrictedTimeRangeStart: restrictedTimeStart,
        restrictedTimeRangeEnd: restrictedTimeEnd,
        assignStudentIds: assignedStudentIds,
      });
      setToast({ text: 'Impostazioni salvate', tone: 'success' });
    } catch {
      setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [
    bookingSlotDurations, roundedHoursOnly, appBookingActors, instructorBookingMode,
    swapEnabled, studentCancellationEnabled, bookingCutoffEnabled, bookingCutoffTime,
    weeklyLimitEnabled, weeklyLimit, weeklyAbsenceEnabled, restrictedTimeEnabled,
    restrictedTimeStart, restrictedTimeEnd, assignedStudentIds,
  ]);

  // Publish draft + setters + save() so the formSheet sub-pages can bind to live state.
  useEffect(() => {
    clusterSettingsStore.set({
      companyDefaults,
      appBookingActors, setAppBookingActors,
      instructorBookingMode, setInstructorBookingMode,
      bookingSlotDurations, toggleDuration,
      roundedHoursOnly, setRoundedHoursOnly,
      bookingCutoffEnabled, setBookingCutoffEnabled,
      bookingCutoffTime, setBookingCutoffTime,
      weeklyLimitEnabled, setWeeklyLimitEnabled,
      weeklyLimit, setWeeklyLimit,
      restrictedTimeEnabled, setRestrictedTimeEnabled,
      restrictedTimeStart, setRestrictedTimeStart,
      restrictedTimeEnd, setRestrictedTimeEnd,
      swapEnabled, setSwapEnabled,
      studentCancellationEnabled, setStudentCancellationEnabled,
      weeklyAbsenceEnabled, setWeeklyAbsenceEnabled,
      openTimePicker,
      saving,
      onSave: handleSave,
    });
  });

  /* ── Summaries (row hints) ── */
  const bookingSummary = useMemo(() => {
    const actor = appBookingActors ?? companyDefaults.appBookingActors;
    const actorLabel = actor === 'instructors' ? 'Solo istruttori' : actor === 'both' ? 'Entrambi' : 'Solo allievi';
    return `${actorLabel} · ${bookingSlotDurations.join('/')} min`;
  }, [appBookingActors, companyDefaults.appBookingActors, bookingSlotDurations]);

  const limitsSummary = useMemo(() => {
    const parts: string[] = [];
    if (bookingCutoffEnabled ?? companyDefaults.bookingCutoffEnabled) parts.push(`Cutoff ${bookingCutoffTime ?? companyDefaults.bookingCutoffTime}`);
    if (weeklyLimitEnabled ?? companyDefaults.weeklyBookingLimitEnabled) parts.push(`Max ${weeklyLimit ?? companyDefaults.weeklyBookingLimit}/sett.`);
    if (restrictedTimeEnabled ?? companyDefaults.restrictedTimeRangeEnabled) parts.push(`Fascia ${restrictedTimeStart ?? companyDefaults.restrictedTimeRangeStart}–${restrictedTimeEnd ?? companyDefaults.restrictedTimeRangeEnd}`);
    return parts.length ? parts.join(' · ') : 'Nessun limite attivo';
  }, [bookingCutoffEnabled, bookingCutoffTime, weeklyLimitEnabled, weeklyLimit, restrictedTimeEnabled, restrictedTimeStart, restrictedTimeEnd, companyDefaults]);

  const extrasSummary = useMemo(() => {
    const parts: string[] = [];
    if (swapEnabled ?? companyDefaults.swapEnabled) parts.push('Scambio');
    if (studentCancellationEnabled ?? companyDefaults.studentCancellationEnabled) parts.push('Annullamento');
    if (weeklyAbsenceEnabled ?? companyDefaults.weeklyAbsenceEnabled) parts.push('Assenza');
    return parts.length ? parts.join(' · ') : 'Nessuna attiva';
  }, [swapEnabled, studentCancellationEnabled, weeklyAbsenceEnabled, companyDefaults]);

  const studentsSummary = assignedCount === 0
    ? 'Nessun allievo nel gruppo'
    : `${assignedCount} ${assignedCount === 1 ? 'allievo' : 'allievi'} nel gruppo`;

  /* ── Collapsible header ── */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const largeTitleStyle = useAnimatedStyle(() => {
    const ty = scrollY.value < 0
      ? scrollY.value
      : interpolate(scrollY.value, [0, LARGE_TITLE_H], [0, -12], Extrapolation.CLAMP);
    return {
      opacity: interpolate(scrollY.value, [0, LARGE_TITLE_H * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: ty }],
    };
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_H * 0.5, LARGE_TITLE_H * 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

  const Row = ({
    icon, label, hint, onPress, danger,
  }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void; danger?: boolean }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={23} color={danger ? '#DC2626' : '#1A1A2E'} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {loading ? (
          <SkeletonBlock width={150} height={11} radius={6} style={{ marginTop: 5 }} />
        ) : (
          <Text style={styles.rowHint} numberOfLines={1}>{hint}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Sticky collapsible header */}
      <View style={[styles.headerWrap, { height: insets.top + COMPACT_H, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.96)' }]} />
          )}
          <View style={styles.headerBorder} />
        </Animated.View>

        <View style={styles.compactRow}>
          <Pressable onPress={() => router.back()} hitSlop={6} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </Pressable>
          <Animated.Text style={[styles.compactTitle, compactStyle]} numberOfLines={1}>Il mio gruppo</Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={loadData}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={insets.top + COMPACT_H}
          />
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top + COMPACT_H }]}
      >
        <View style={{ height: LARGE_TITLE_H, justifyContent: 'flex-end' }}>
          <Animated.Text style={[styles.largeTitle, largeTitleStyle]}>Il mio gruppo</Animated.Text>
        </View>
        <Text style={styles.pageDesc}>
          Configura come i tuoi allievi prenotano le guide con te.
        </Text>

        <View style={styles.menuGroup}>
          <Row icon="people-outline" label="Allievi del gruppo" hint={studentsSummary} onPress={openStudentsSheet} />
          <View style={styles.rowDivider} />
          <Row icon="calendar-outline" label="Prenotazione guide" hint={bookingSummary} onPress={() => router.push('/(tabs)/notes/booking-rules' as never)} />
          <View style={styles.rowDivider} />
          <Row icon="time-outline" label="Limiti e orari" hint={limitsSummary} onPress={() => router.push('/(tabs)/notes/limits' as never)} />
          <View style={styles.rowDivider} />
          <Row icon="sparkles-outline" label="Funzionalità extra" hint={extrasSummary} onPress={() => router.push('/(tabs)/notes/extras' as never)} />
        </View>

        {/* Codice di invito — gli allievi che si registrano con questo codice
            entrano direttamente nel gruppo. Tap = copia. */}
        {autonomousMode && inviteCode ? (
          <Pressable
            onPress={copyInviteCode}
            style={({ pressed }) => [styles.codeCard, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
          >
            <View style={styles.codeCardHeader}>
              <Text style={styles.codeCardLabel}>Codice di invito</Text>
              <Ionicons name="copy-outline" size={17} color="#9CA3AF" />
            </View>
            <Text style={styles.codeCardValue}>{inviteCode}</Text>
            <Text style={styles.codeCardHint}>
              Condividilo con i nuovi allievi: registrandosi con questo codice si iscriveranno all'autoscuola direttamente nel tuo gruppo.
            </Text>
          </Pressable>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: H_PAD, paddingBottom: 120 },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: colors.border,
  },
  compactRow: { height: COMPACT_H, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', left: H_PAD - 4, width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  compactTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },

  largeTitle: { fontSize: 32, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },
  pageDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 6, marginBottom: 22 },

  /* Flat menu rows */
  menuGroup: { paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, minHeight: 60 },
  rowPressed: { opacity: 0.55 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#1A1A2E' },
  rowHint: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 39 },

  /* Codice di invito */
  codeCard: {
    marginTop: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  codeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeCardValue: {
    fontSize: 30,
    fontWeight: '600',
    color: '#1A1A2E',
    letterSpacing: 6,
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeCardHint: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 10, lineHeight: 18 },
});
