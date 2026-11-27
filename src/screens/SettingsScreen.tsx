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
import { ClayList, ClayListRow, ClaySection, Icon3D } from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { AppVersionFooter, CLAY_DANGER, ClayTextRow, ProfileSummaryCard } from '../components/ClayAccountParts';
import { CLAY } from '../theme/clay';
import { softStagger } from '../utils/motion';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaStudent } from '../types/regloApi';
import { settingsStore } from '../stores/settingsStore';
import { useMyStudentAvailability } from '../hooks/queries/useMyStudentAvailability';
import { DEFAULT_BANDS, payloadRanges, summaryText } from '../utils/studentAvailability';
import { instructorSettingsStore } from '../stores/instructorSettingsStore';
import * as Notifications from 'expo-notifications';
import { sessionStorage } from '../services/sessionStorage';
import { isInstructor, isOwner, isStudent } from '../utils/roles';
import { useStudentPhase } from '../hooks/useStudentPhase';

const reminderOptions = [120, 60, 30, 20, 15] as const;

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
  // REG-802: disponibilità a fasce (riga «Disponibilità» e la sua pagina, già piena all'apertura).
  const availabilityQ = useMyStudentAvailability();

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
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Instructor/owner: gates only the settings-dependent row hints (Disponibilità
  // mode, Agenda weeks) while they load in the background. The screen renders
  // immediately from the session — never blocked on these network calls.
  const [settingsLoading, setSettingsLoading] = useState(true);
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
        // REG-802: le disponibilità le legge `useMyStudentAvailability`.
        setInitialLoading(false);
      } else {
        setStudentProfile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricando impostazioni');
    } finally {
      setInitialLoading(false);
    }
  }, [autoscuolaRole, user]);

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
  // Publish edit state + handlers to the store so dedicated sub-pages
  // (profile-edit, availability, payment) can bind to them. Published for
  // every role: instructors/owners reach profile-edit from the "Altro" stack
  // (more/profile-edit); availability/payment remain student-only routes.
  useEffect(() => {
    settingsStore.set({
      name, phone, saving, setName, setPhone, onSaveProfile: handleSaveProfile,
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
  // REG-786: in pratica le guide stanno nella tab Guide; qui restano per le altre fasi.
  const { phase: studentPhase } = useStudentPhase();
  const showLessonsRow = studentPhase !== 'PRATICA';

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
            {showLessonsRow ? (
              <ClayListRow title="Le tue guide" onPress={() => router.push('/(tabs)/settings/le-tue-guide')} />
            ) : null}
            <ClayListRow
              title="Disponibilità"
              subtitle={
                availabilityQ.isLoading ? (
                  <SkeletonBlock width={130} height={11} radius={6} />
                ) : (
                  summaryText(payloadRanges(availabilityQ.data), availabilityQ.data?.bands ?? DEFAULT_BANDS) ??
                  'Non ancora indicate'
                )
              }
              onPress={() => router.push('/(tabs)/settings/availability')}
              testID="profile-availability"
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
              {isOwner(autoscuolaRole) ? (
                // REG-773: solo il titolare. Apre il foglio di conferma.
                <ClayListRow
                  leading={<Icon3D source={require('../../assets/icons3d-ai/barriera.png')} size={32} />}
                  title="Modalità manutenzione"
                  subtitle="Blocca subito l'accesso all'account"
                  onPress={() => router.push('/(tabs)/more/maintenance')}
                  testID="settings-maintenance"
                />
              ) : null}
              <ClayTextRow title="Elimina account" danger disabled={deletingAccount} onPress={handleDeleteAccount} />
            </ClayList>
          </ClaySection>

          <AppVersionFooter />
        </>
      )}
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink3} colors={[CLAY.ink]} />
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {isStudent(autoscuolaRole) ? (
        // App allievo: la barra a titolo grande arriva in un secondo giro.
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {renderStudentContent()}
        </ScrollView>
      ) : (
        <ClayLargeTitleScroll
          title="Impostazioni"
          onBack={router.canGoBack() ? () => router.back() : undefined}
          contentContainerStyle={styles.content}
          refreshControl={refreshControl}
        >
          {renderNonStudentContent()}
        </ClayLargeTitleScroll>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  profile: { marginTop: 20 },
  error: { fontSize: 14, lineHeight: 20, color: CLAY_DANGER, marginTop: 14, paddingHorizontal: 4 },
});
