import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- expo-clipboard non è nel binario
  // corrente (aggiungerlo richiede una build nativa): il Clipboard core di RN è OTA-safe.
  Clipboard,
  ImageSourcePropType,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { timePickerStore } from '../stores/timePickerStore';
import { groupStudentsStore } from '../stores/groupStudentsStore';
import { clusterSettingsStore, ClusterCompanyDefaults } from '../stores/clusterSettingsStore';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { ClayIconButton, ClayList, ClayListRow, ClaySection, ClaySurface, Icon3D } from '../components/clay';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';

const H_PAD = 20;
const PERSONE_ART = require('../../assets/icons3d-ai/persone.png') as ImageSourcePropType;
const SCAMBIO_ART = require('../../assets/icons3d-ai/scambio.png') as ImageSourcePropType;

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
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [saving, setSaving] = useState(false);

  const [companyDefaults, setCompanyDefaults] = useState<ClusterCompanyDefaults>(DEFAULTS);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([30, 60]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [appBookingActors, setAppBookingActors] = useState<string | undefined>(undefined);
  const [appBookingActorsByPath, setAppBookingActorsByPath] = useState<{ moto?: string; auto?: string; pro?: string } | undefined>(undefined);
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
  const [allStudents, setAllStudents] = useState<Array<{ id: string; firstName: string; lastName: string; assignedInstructorId: string | null; licenseCategory?: string | null; transmission?: string | null }>>([]);
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
      setAppBookingActorsByPath(res.settings.appBookingActorsByPath);
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
      // REG-426: se ci sono override per-percorso, azzera il default cluster
      // (null) così le righe "Default" ereditano dall'autoscuola; altrimenti
      // salva il valore semplice e azzera gli override.
      const perPathActive = Boolean(
        appBookingActorsByPath &&
          (appBookingActorsByPath.moto || appBookingActorsByPath.auto || appBookingActorsByPath.pro),
      );
      await regloApi.updateInstructorSettings({
        bookingSlotDurations,
        roundedHoursOnly,
        appBookingActors: perPathActive
          ? null
          : ((appBookingActors as 'students' | 'instructors' | 'both' | undefined) ?? null),
        appBookingActorsByPath: perPathActive
          ? (appBookingActorsByPath as { moto?: 'students' | 'instructors' | 'both'; auto?: 'students' | 'instructors' | 'both'; pro?: 'students' | 'instructors' | 'both' })
          : null,
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
    bookingSlotDurations, roundedHoursOnly, appBookingActors, appBookingActorsByPath, instructorBookingMode,
    swapEnabled, studentCancellationEnabled, bookingCutoffEnabled, bookingCutoffTime,
    weeklyLimitEnabled, weeklyLimit, weeklyAbsenceEnabled, restrictedTimeEnabled,
    restrictedTimeStart, restrictedTimeEnd, assignedStudentIds,
  ]);

  // Publish draft + setters + save() so the formSheet sub-pages can bind to live state.
  useEffect(() => {
    clusterSettingsStore.set({
      companyDefaults,
      appBookingActors, setAppBookingActors,
      appBookingActorsByPath, setAppBookingActorsByPath,
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
    const perPathActive = Boolean(
      appBookingActorsByPath &&
        (appBookingActorsByPath.moto || appBookingActorsByPath.auto || appBookingActorsByPath.pro),
    );
    if (perPathActive) return `Per percorso · ${bookingSlotDurations.join('/')} min`;
    const actor = appBookingActors ?? companyDefaults.appBookingActors;
    const actorLabel = actor === 'instructors' ? 'Solo istruttori' : actor === 'both' ? 'Entrambi' : 'Solo allievi';
    return `${actorLabel} · ${bookingSlotDurations.join('/')} min`;
  }, [appBookingActors, appBookingActorsByPath, companyDefaults.appBookingActors, bookingSlotDurations]);

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

  const row = (art: ImageSourcePropType, label: string, hint: string, onPress: () => void, testID: string) => (
    <ClayListRow
      key={label}
      leading={<Icon3D source={art} size={40} />}
      title={label}
      subtitle={
        loading ? <SkeletonBlock width={150} height={11} radius={6} style={{ marginTop: 3 }} /> : hint
      }
      onPress={onPress}
      testID={testID}
    />
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ClayLargeTitleScroll
        title="Il mio gruppo"
        subtitle="Come i tuoi allievi prenotano le guide con te"
        onBack={() => router.back()}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor={CLAY.ink} colors={[CLAY.ink]} />}
        contentContainerStyle={styles.content}
      >

        <ClayList style={styles.list}>
          {row(PERSONE_ART, 'Allievi del gruppo', studentsSummary, openStudentsSheet, 'cluster-students')}
          {row(VITA_ART.calendario, 'Prenotazione guide', bookingSummary, () => router.push('/(tabs)/notes/booking-rules' as never), 'cluster-booking')}
          {row(VITA_ART.orologio, 'Limiti e orari', limitsSummary, () => router.push('/(tabs)/notes/limits' as never), 'cluster-limits')}
          {row(SCAMBIO_ART, 'Funzionalità extra', extrasSummary, () => router.push('/(tabs)/notes/extras' as never), 'cluster-extras')}
        </ClayList>

        {/* Codice di invito: chi si registra con questo codice entra
            direttamente nel gruppo. Tocco sulla card o sul bottone = copia. */}
        {autonomousMode && inviteCode ? (
          <ClaySection
            title="Codice di invito"
            footnote="Chi si registra con questo codice entra in autoscuola già nel tuo gruppo."
          >
            <ClaySurface onPress={copyInviteCode} style={styles.codeCard} testID="cluster-invite-code" accessibilityLabel={`Codice di invito ${inviteCode}, copia`}>
              <Text style={styles.codeValue} selectable>{inviteCode}</Text>
              <ClayIconButton
                icon={<Ionicons name="copy-outline" size={18} color={CLAY.ink} />}
                onPress={copyInviteCode}
                accessibilityLabel="Copia il codice"
              />
            </ClaySurface>
          </ClaySection>
        ) : null}
      </ClayLargeTitleScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: H_PAD, paddingBottom: 120 },
  list: { marginTop: 22 },
  codeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20 },
  codeValue: {
    fontSize: 28,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
