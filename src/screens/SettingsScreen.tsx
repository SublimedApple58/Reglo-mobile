import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { ClayList, ClayListRow, ClaySection } from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { AppVersionFooter, CLAY_DANGER, ClayTextRow, ProfileSummaryCard } from '../components/ClayAccountParts';
import { CLAY } from '../theme/clay';
import { softStagger } from '../utils/motion';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaStudent } from '../types/regloApi';
import { settingsStore, SlotTarget } from '../stores/settingsStore';
import { instructorSettingsStore } from '../stores/instructorSettingsStore';
import * as Notifications from 'expo-notifications';
import { sessionStorage } from '../services/sessionStorage';
import { isInstructor, isOwner, isStudent } from '../utils/roles';

const reminderOptions = [120, 60, 30, 20, 15] as const;

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const pad = (value: number) => value.toString().padStart(2, '0');
const toDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};
const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};
const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};
const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);

  const byEmail = students.find((student) => normalize(student.email) === normalizedEmail);
  if (byEmail) return byEmail;

  if (!normalizedName) return null;
  const byName = students.find(
    (student) => `${normalize(student.firstName)} ${normalize(student.lastName)}` === normalizedName
  );
  return byName ?? null;
};



export const SettingsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, companies, activeCompanyId, refreshMe, signOut, autoscuolaRole } = useSession();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [availabilityWeeks, setAvailabilityWeeks] = useState('4');
  const [studentReminderMinutes, setStudentReminderMinutes] = useState('60');
  const [instructorReminderMinutes, setInstructorReminderMinutes] = useState('60');
  const [instrAvailabilityMode, setInstrAvailabilityMode] = useState<'default' | 'publication'>('default');
  const [, setAppBookingActors] = useState<'students' | 'instructors' | 'both'>('students');
  const [, setInstructorBookingMode] =
    useState<'manual_full' | 'manual_engine'>('manual_engine');
  const [refreshing, setRefreshing] = useState(false);
  const [studentProfile, setStudentProfile] = useState<AutoscuolaStudent | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState(buildTime(9, 0));
  const [availabilityEnd, setAvailabilityEnd] = useState(buildTime(18, 0));
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Loads after initialLoading (background) — gates only the availability hint.
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  // Instructor/owner: gates only the settings-dependent row hints (Disponibilità
  // mode, Agenda weeks) while they load in the background. The screen renders
  // immediately from the session — never blocked on these network calls.
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [morningActive, setMorningActive] = useState(false);
  const [afternoonActive, setAfternoonActive] = useState(false);
  const [morningStart, setMorningStart] = useState(buildTime(8, 0));
  const [morningEnd, setMorningEnd] = useState(buildTime(12, 0));
  const [afternoonStart, setAfternoonStart] = useState(buildTime(14, 0));
  const [afternoonEnd, setAfternoonEnd] = useState(buildTime(18, 0));
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const activeCompany = useMemo(
    () => companies.find((item) => item.id === activeCompanyId) ?? null,
    [companies, activeCompanyId],
  );

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  // Check notification permission status
  const checkNotificationPermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const { granted } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(granted);
  }, []);

  useEffect(() => {
    checkNotificationPermission();
  }, [checkNotificationPermission]);

  // Re-check when app returns to foreground (user might have changed in OS settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNotificationPermission();
    });
    return () => sub.remove();
  }, [checkNotificationPermission]);

  const handleNotificationsTap = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (notificationsEnabled) {
      // Already enabled — open OS settings so user can manage
      await Linking.openSettings();
      return;
    }
    // Try requesting permission
    const { granted } = await Notifications.requestPermissionsAsync();
    if (granted) {
      setNotificationsEnabled(true);
      setToast({ text: 'Notifiche attivate!', tone: 'success' });
    } else {
      // Permission denied — send to OS settings
      setToast({ text: 'Abilita le notifiche dalle impostazioni del dispositivo', tone: 'info' });
      await Linking.openSettings();
    }
  }, [notificationsEnabled]);

  // Derive morningActive/afternoonActive + ranges from loaded availability
  const deriveSlotsFromTime = useCallback((start: Date, end: Date) => {
    const startHour = start.getHours();
    const startMin = start.getMinutes();
    const endHour = end.getHours();
    const endMin = end.getMinutes();
    const isMorning = startHour < 13;
    const isAfternoon = endHour > 13;
    setMorningActive(isMorning);
    setAfternoonActive(isAfternoon);
    if (isMorning) {
      setMorningStart(buildTime(startHour, startMin));
      setMorningEnd(isAfternoon ? buildTime(12, 0) : buildTime(endHour, endMin));
    }
    if (isAfternoon) {
      setAfternoonStart(isMorning ? buildTime(14, 0) : buildTime(startHour, startMin));
      setAfternoonEnd(buildTime(endHour, endMin));
    }
  }, []);

  const loadStudentAvailabilityPreset = useCallback(async (studentId: string) => {
    const anchor = new Date();
    anchor.setHours(0, 0, 0, 0);
    // Single range request for the whole week (was 7 separate per-day calls).
    const slots = await regloApi.getAvailabilitySlots({
      ownerType: 'student',
      ownerId: studentId,
      from: toDateString(anchor),
      to: toDateString(addDays(anchor, 6)),
    });

    // Group the week's slots by calendar day.
    const byDay = new Map<string, typeof slots>();
    (slots ?? []).forEach((slot) => {
      if (slot.status === 'cancelled') return;
      const key = toDateString(new Date(slot.startsAt));
      const arr = byDay.get(key);
      if (arr) arr.push(slot);
      else byDay.set(key, [slot]);
    });

    const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
    byDay.forEach((daySlots) => {
      if (!daySlots.length) return;
      const sorted = daySlots
        .slice()
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      const first = new Date(sorted[0].startsAt);
      const last = new Date(sorted[sorted.length - 1].endsAt);
      const startMin = first.getHours() * 60 + first.getMinutes();
      const endMin = last.getHours() * 60 + last.getMinutes();
      ranges.push({ dayIndex: first.getDay(), startMin, endMin });
    });

    if (!ranges.length) {
      setAvailabilityDays([]);
      setAvailabilityStart(buildTime(9, 0));
      setAvailabilityEnd(buildTime(18, 0));
      deriveSlotsFromTime(buildTime(9, 0), buildTime(18, 0));
      return;
    }

    const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
    const minStart = Math.min(...ranges.map((item) => item.startMin));
    const maxEnd = Math.max(...ranges.map((item) => item.endMin));
    const newStart = buildTime(Math.floor(minStart / 60), minStart % 60);
    const newEnd = buildTime(Math.floor(maxEnd / 60), maxEnd % 60);
    setAvailabilityDays(daySet);
    setAvailabilityStart(newStart);
    setAvailabilityEnd(newEnd);
    deriveSlotsFromTime(newStart, newEnd);
  }, [deriveSlotsFromTime]);

  const loadSettings = useCallback(async () => {
    try {
      // La vista agenda non si sceglie più (solo griglia): via la preferenza salvata.
      void sessionStorage.forgetAgendaViewMode();
      if (isOwner(autoscuolaRole) || isInstructor(autoscuolaRole)) {
        // Render immediately — the profile card needs no network. The settings feeding the Disponibilità / Agenda row
        // hints load in the background, in parallel, gated by settingsLoading.
        setInitialLoading(false);
        setSettingsLoading(true);
        const tasks: Promise<void>[] = [];
        tasks.push(
          regloApi.getAutoscuolaSettings()
            .then((settings) => {
              setAvailabilityWeeks(String(settings.availabilityWeeks));
              setStudentReminderMinutes(String(settings.studentReminderMinutes));
              setInstructorReminderMinutes(String(settings.instructorReminderMinutes));
              setAppBookingActors(settings.appBookingActors ?? 'students');
              setInstructorBookingMode(settings.instructorBookingMode ?? 'manual_engine');
            })
            .catch((settingsErr) => {
              if (isOwner(autoscuolaRole)) {
                setError(settingsErr instanceof Error ? settingsErr.message : 'Errore caricando impostazioni');
              }
            }),
        );
        if (isInstructor(autoscuolaRole)) {
          tasks.push(
            regloApi.getInstructorSettings()
              .then((instrSettings) => {
                if (instrSettings.settings?.availabilityMode) {
                  setInstrAvailabilityMode(instrSettings.settings.availabilityMode);
                }
              })
              .catch(() => {}),
          );
        }
        Promise.all(tasks).finally(() => setSettingsLoading(false));
      }

      if (isStudent(autoscuolaRole)) {
        const [settings, studentsList] = await Promise.all([
          regloApi.getAutoscuolaSettings().catch(() => null),
          regloApi.getStudents().catch(() => [] as AutoscuolaStudent[]),
        ]);
        if (settings) {
          setAvailabilityWeeks(String(settings.availabilityWeeks));
        }
        const linkedStudent = findLinkedStudent(studentsList, user);
        setStudentProfile(linkedStudent);
        // Unblock the screen immediately: the profile card needs no network.
        // The availability preset only feeds the Disponibilità sub-page + its
        // summary row, so load it in the background instead of blocking the
        // whole screen on 7 slot calls.
        setInitialLoading(false);
        if (linkedStudent?.id) {
          setAvailabilityLoading(true);
          loadStudentAvailabilityPreset(linkedStudent.id)
            .catch(() => {})
            .finally(() => setAvailabilityLoading(false));
        } else {
          setAvailabilityLoading(false);
        }
      } else {
        setStudentProfile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricando impostazioni');
    } finally {
      setInitialLoading(false);
    }
  }, [autoscuolaRole, loadStudentAvailabilityPreset, user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Nome troppo corto');
      return;
    }

    setSaving(true);
    setError(null);
    setToast(null);
    try {
      await regloApi.updateProfile({ name: trimmed, phone: phone.trim() });
      await refreshMe();
      setToast({ text: 'Profilo aggiornato', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando profilo');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Elimina account',
      // REG-629: l'allievo deve sapere che l'autoscuola non lo perde di vista
      // del tutto. Nome, guide e pagamenti restano per gli obblighi contabili.
      isStudent(autoscuolaRole)
        ? "Questa azione è definitiva: perderai l'accesso all'app e cancelleremo email, telefono, foto e firma.\n\nLa tua autoscuola conserverà il tuo nome, lo storico delle guide e dei pagamenti, come richiesto dagli obblighi contabili."
        : "Questa azione è definitiva: perderai accesso all'app e i tuoi dati profilo verranno rimossi.",
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            setError(null);
            setToast(null);
            try {
              await regloApi.deleteAccount({ confirm: true });
              await signOut();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Errore durante eliminazione account');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveOwnerSettings = async () => {
    const parsedWeeks = Number(availabilityWeeks);
    if (Number.isNaN(parsedWeeks) || parsedWeeks < 1 || parsedWeeks > 12) {
      setError('Numero settimane non valido');
      return;
    }

    const studentReminder = Number(studentReminderMinutes);
    const instructorReminder = Number(instructorReminderMinutes);

    if (!reminderOptions.includes(studentReminder as (typeof reminderOptions)[number])) {
      setError('Preavviso allievo non valido');
      return;
    }
    if (!reminderOptions.includes(instructorReminder as (typeof reminderOptions)[number])) {
      setError('Preavviso istruttore non valido');
      return;
    }

    setSavingSettings(true);
    setError(null);
    setToast(null);
    try {
      await regloApi.updateAutoscuolaSettings({
        availabilityWeeks: parsedWeeks,
        studentReminderMinutes: studentReminder as 120 | 60 | 30 | 20 | 15,
        instructorReminderMinutes: instructorReminder as 120 | 60 | 30 | 20 | 15,
      });
      setToast({ text: 'Impostazioni operative aggiornate', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando impostazioni');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleAvailabilityDay = (day: number) => {
    setAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  // Compute availabilityStart/End from morning/afternoon toggles
  const computeTimeFromSlots = useCallback(() => {
    if (morningActive && afternoonActive) {
      // Two separate ranges — primary is morning, secondary sent via startsAt2/endsAt2
      setAvailabilityStart(morningStart);
      setAvailabilityEnd(morningEnd);
    } else if (morningActive) {
      setAvailabilityStart(morningStart);
      setAvailabilityEnd(morningEnd);
    } else if (afternoonActive) {
      setAvailabilityStart(afternoonStart);
      setAvailabilityEnd(afternoonEnd);
    } else {
      setAvailabilityStart(buildTime(9, 0));
      setAvailabilityEnd(buildTime(18, 0));
    }
  }, [morningActive, afternoonActive, morningStart, morningEnd, afternoonStart, afternoonEnd]);

  const toggleMorning = () => {
    setMorningActive((prev) => !prev);
  };

  const toggleAfternoon = () => {
    setAfternoonActive((prev) => !prev);
  };

  // Recompute availability times when slots or ranges change
  useEffect(() => {
    computeTimeFromSlots();
  }, [computeTimeFromSlots]);

  const handleSaveStudentAvailability = async () => {
    if (!studentProfile?.id) {
      setError('Profilo allievo non collegato alla company attiva.');
      return;
    }
    if (!availabilityDays.length) {
      setError('Seleziona almeno un giorno disponibile.');
      return;
    }
    if (availabilityEnd <= availabilityStart) {
      setError('Intervallo orario non valido.');
      return;
    }

    setAvailabilitySaving(true);
    setError(null);
    setToast(null);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(availabilityStart.getHours(), availabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(availabilityEnd.getHours(), availabilityEnd.getMinutes(), 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);

      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType: 'student',
          ownerId: studentProfile.id,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks: Number(availabilityWeeks) || 4,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) {
          throw err;
        }
      }

      // Build second range if both morning and afternoon are active separately
      const hasSecondRange = morningActive && afternoonActive;
      const secondRange = hasSecondRange ? (() => {
        const s2 = new Date(anchor);
        s2.setHours(afternoonStart.getHours(), afternoonStart.getMinutes(), 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(afternoonEnd.getHours(), afternoonEnd.getMinutes(), 0, 0);
        return { startsAt2: s2.toISOString(), endsAt2: e2.toISOString() };
      })() : {};

      await regloApi.createAvailabilitySlots({
        ownerType: 'student',
        ownerId: studentProfile.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        ...secondRange,
        daysOfWeek: availabilityDays,
        weeks: Number(availabilityWeeks) || 4,
      });
      setToast({ text: 'Disponibilità aggiornata', tone: 'success' });
      await loadStudentAvailabilityPreset(studentProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando disponibilità');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setToast(null);
    try {
      await refreshMe();
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel refresh');
    } finally {
      setRefreshing(false);
    }
  }, [loadSettings, refreshMe]);

  /* \u2500\u2500\u2500 Student-specific render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const availabilitySummary = availabilityDays.length > 0
    ? availabilityDays.map((d) => dayLetters[d]).join(', ') + (morningActive && afternoonActive ? ' \u2022 Tutto il giorno' : morningActive ? ' \u2022 Mattina' : afternoonActive ? ' \u2022 Pomeriggio' : '')
    : 'Non configurata';

  const onPickSlotTime = (target: SlotTarget, date: Date) => {
    if (target === 'morningStart') setMorningStart(date);
    else if (target === 'morningEnd') setMorningEnd(date);
    else if (target === 'afternoonStart') setAfternoonStart(date);
    else if (target === 'afternoonEnd') setAfternoonEnd(date);
  };

  // Publish edit state + handlers to the store so dedicated sub-pages
  // (profile-edit, availability, payment) can bind to them. Published for
  // every role: instructors/owners reach profile-edit from the "Altro" stack
  // (more/profile-edit); availability/payment remain student-only routes.
  useEffect(() => {
    settingsStore.set({
      name, phone, saving, setName, setPhone, onSaveProfile: handleSaveProfile,
      hasProfile: !!studentProfile, weeks: Number(availabilityWeeks) || 4,
      availabilityDays, toggleDay: toggleAvailabilityDay,
      morningActive, afternoonActive, toggleMorning, toggleAfternoon,
      morningStart, morningEnd, afternoonStart, afternoonEnd,
      onPickSlotTime, availabilitySaving, onSaveAvailability: handleSaveStudentAvailability,
    });
  });

  // Publish instructor/owner settings so the "Altro" formSheet sub-pages
  // (availability-mode, agenda-settings) can bind to live state.
  useEffect(() => {
    if (isStudent(autoscuolaRole)) return;
    instructorSettingsStore.set({
      availabilityMode: instrAvailabilityMode,
      onPickAvailabilityMode: async (m) => {
        const prev = instrAvailabilityMode;
        setInstrAvailabilityMode(m);
        try { await regloApi.updateInstructorSettings({ availabilityMode: m }); }
        catch { setInstrAvailabilityMode(prev); }
      },
      availabilityWeeks,
      setAvailabilityWeeks,
      studentReminderMinutes,
      setStudentReminderMinutes,
      instructorReminderMinutes,
      setInstructorReminderMinutes,
      savingSettings,
      onSaveOwnerSettings: handleSaveOwnerSettings,
    });
  });

  /* ─── Student render ─────────────────────────────────────────────── */
  const renderStudentContent = () => (
    <>
      <Animated.View entering={softStagger(0)}>
        <ClayPageHeader title="Profilo" />
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Profile card -> opens profile-edit page. Name/email/company come from
          the session, so they render instantly with no skeleton. */}
      <Animated.View entering={softStagger(1)} style={styles.profile}>
        <ProfileSummaryCard
          user={user}
          detail={[user?.email, activeCompany?.name ?? 'Autoscuola'].filter(Boolean).join(' · ')}
          onPress={() => router.push('/(tabs)/settings/profile-edit')}
          testID="profile-card"
        />
      </Animated.View>

      <Animated.View entering={softStagger(2)}>
        <ClaySection title="Preferenze">
          <ClayList>
            <ClayListRow title="Le tue guide" onPress={() => router.push('/(tabs)/settings/le-tue-guide')} />
            <ClayListRow
              title="Disponibilità"
              subtitle={
                availabilityLoading ? <SkeletonBlock width={130} height={11} radius={6} /> : availabilitySummary
              }
              onPress={() => router.push('/(tabs)/settings/availability')}
            />
            {/* REG-451: "Scansiona QR" — associazione all'istruttore dalla sua card (la card stampata dice "tab Profilo → Scansiona QR") */}
            <ClayListRow
              title="Scansiona QR"
              subtitle="Associati al tuo istruttore"
              onPress={() => router.push('/(tabs)/settings/associa-istruttore')}
              testID="profile-scan-qr"
            />
            <ClayListRow
              title="Notifiche"
              subtitle={notificationsEnabled ? 'Attive' : 'Disattivate'}
              onPress={handleNotificationsTap}
            />
          </ClayList>
        </ClaySection>
      </Animated.View>

      <Animated.View entering={softStagger(3)}>
        <ClaySection title="Account">
          <ClayList>
            <ClayTextRow title="Esci" onPress={handleSignOut} />
            <ClayTextRow title="Elimina account" danger disabled={deletingAccount} onPress={handleDeleteAccount} />
          </ClayList>
        </ClaySection>
        <AppVersionFooter />
      </Animated.View>
    </>
  );

  /* ─── Owner / Instructor render ──────────────────────────────────── */
  // «Esci» sta nella tab «Tu» (MoreScreen): qui restano le preferenze e
  // l'eliminazione dell'account.
  const renderNonStudentContent = () => (
    <>
      <ClayPageHeader
        title="Impostazioni"
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {initialLoading ? (
        <ClaySection>
          <ClayList>
            <ClayListRow title="Caricamento" subtitle={<SkeletonBlock width={120} height={11} radius={6} />} />
          </ClayList>
        </ClaySection>
      ) : (
        <>
          {/* Preferences — rows that open formSheet sub-pages. Profile card
              lives on the «Tu» (More) screen to avoid duplication. */}
          <ClaySection title="Preferenze">
            <ClayList>
              {isInstructor(autoscuolaRole) ? (
                <ClayListRow
                  title="Disponibilità"
                  subtitle={
                    settingsLoading ? (
                      <SkeletonBlock width={90} height={11} radius={6} />
                    ) : instrAvailabilityMode === 'publication' ? 'Pubblicazione' : 'Predefinita'
                  }
                  onPress={() => router.push('/(tabs)/more/availability-mode')}
                  testID="settings-availability-mode"
                />
              ) : null}
              {isOwner(autoscuolaRole) ? (
                <ClayListRow
                  title="Agenda"
                  subtitle={
                    settingsLoading ? (
                      <SkeletonBlock width={120} height={11} radius={6} />
                    ) : `${availabilityWeeks} settimane prenotabili`
                  }
                  onPress={() => router.push('/(tabs)/more/agenda-settings')}
                  testID="settings-agenda"
                />
              ) : null}
              <ClayListRow
                title="Notifiche"
                subtitle={notificationsEnabled ? 'Attive' : 'Disattivate'}
                onPress={handleNotificationsTap}
                testID="settings-notifications"
              />
            </ClayList>
          </ClaySection>

          <ClaySection title="Account">
            <ClayList>
              <ClayTextRow title="Elimina account" danger disabled={deletingAccount} onPress={handleDeleteAccount} />
            </ClayList>
          </ClaySection>

          <AppVersionFooter />
        </>
      )}
    </>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={CLAY.ink3}
            colors={[CLAY.ink]}
          />
        }
      >
        {isStudent(autoscuolaRole) ? renderStudentContent() : renderNonStudentContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  profile: { marginTop: 20 },
  error: { fontSize: 14, lineHeight: 20, color: CLAY_DANGER, marginTop: 14, paddingHorizontal: 4 },
});
