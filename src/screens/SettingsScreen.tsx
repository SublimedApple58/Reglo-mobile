import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { colors, radii, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaStudent, MobileStudentPaymentProfile } from '../types/regloApi';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { settingsStore, SlotTarget } from '../stores/settingsStore';
import { instructorSettingsStore } from '../stores/instructorSettingsStore';
import * as Notifications from 'expo-notifications';
import { sessionStorage } from '../services/sessionStorage';
import { isInstructor, isOwner, isStudent } from '../utils/roles';
import { useAutoPaymentsEnabled } from '../hooks/useAutoPaymentsEnabled';

const shouldRetryPaymentSheetWithoutWallet = (message?: string | null) => {
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes('merchantidentifier') || normalized.includes('merchant identifier');
};

const reminderOptions = [120, 60, 30, 20, 15] as const;

const roleLabelMap: Record<string, string> = {
  STUDENT: 'Allievo',
  INSTRUCTOR: 'Istruttore',
  OWNER: 'Titolare',
  INSTRUCTOR_OWNER: 'Istruttore e Titolare',
};

const bookingActorLabelMap = {
  students: 'Solo allievi',
  instructors: 'Solo istruttori',
  both: 'Allievi e istruttori',
} as const;

const instructorModeLabelMap = {
  manual_full: 'Manuale totale',
  manual_engine: 'Manuale + motore annullamenti',
} as const;

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
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

type PickerFieldProps = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
};

const PickerField = ({ label, value, mode, onChange }: PickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <View style={styles.timePickerFieldWrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.timePickerField, pressed && styles.timePickerFieldPressed]}
      >
        <View pointerEvents="none">
          <Input
            editable={false}
            placeholder={label}
            value={
              mode === 'date'
                ? value.toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })
                : value.toTimeString().slice(0, 5)
            }
          />
        </View>
      </Pressable>
      {open ? (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" onRequestClose={close}>
            <View style={styles.pickerBackdrop}>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <DateTimePicker
                  value={value}
                  mode={mode}
                  display="spinner"
                  onChange={(_, selected) => {
                    if (selected) onChange(selected);
                  }}
                />
                <Button label="Fatto" onPress={close} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode={mode}
            display="default"
            onChange={(_, selected) => {
              setOpen(false);
              if (selected) onChange(selected);
            }}
          />
        )
      ) : null}
    </View>
  );
};

export const SettingsScreen = () => {
  const router = useRouter();
  const { user, companies, activeCompanyId, refreshMe, signOut, autoscuolaRole } = useSession();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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
  const [appBookingActors, setAppBookingActors] = useState<'students' | 'instructors' | 'both'>('students');
  const [instructorBookingMode, setInstructorBookingMode] =
    useState<'manual_full' | 'manual_engine'>('manual_engine');
  const [refreshing, setRefreshing] = useState(false);
  const [paymentProfile, setPaymentProfile] = useState<MobileStudentPaymentProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<AutoscuolaStudent | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState(buildTime(9, 0));
  const [availabilityEnd, setAvailabilityEnd] = useState(buildTime(18, 0));
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
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
  const [slotTimePickerTarget, setSlotTimePickerTarget] = useState<
    'morningStart' | 'morningEnd' | 'afternoonStart' | 'afternoonEnd' | null
  >(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [agendaViewMode, setAgendaViewMode] = useState<'day' | 'week'>('day');

  const activeCompany = useMemo(
    () => companies.find((item) => item.id === activeCompanyId) ?? null,
    [companies, activeCompanyId],
  );

  const roleLabel = autoscuolaRole ? roleLabelMap[autoscuolaRole] : 'Utente';

  const logoLabel = useMemo(
    () => (activeCompany?.name ?? '?').slice(0, 1).toUpperCase(),
    [activeCompany?.name],
  );

  const userInitials = useMemo(() => {
    const source = (user?.name ?? user?.email ?? 'U').trim();
    const parts = source.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [user?.email, user?.name]);

  const paymentStatusText = paymentProfile?.hasPaymentMethod
    ? 'Metodo di pagamento configurato'
    : 'Nessun metodo configurato';
  // Presence of the payment row comes from the cached settings query (instant
  // after first load) so the row renders immediately; only its summary value
  // waits on the payment profile.
  const autoPayments = useAutoPaymentsEnabled();
  const showStudentPaymentCard =
    autoPayments.enabled || paymentProfile?.autoPaymentsEnabled === true;

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
      const savedViewMode = await sessionStorage.getAgendaViewMode();
      setAgendaViewMode(savedViewMode);
      if (isOwner(autoscuolaRole) || isInstructor(autoscuolaRole)) {
        // Render immediately — the profile card + Vista agenda (local storage)
        // need no network. The settings feeding the Disponibilità / Agenda row
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
        const [profile, settings, studentsList] = await Promise.all([
          regloApi.getPaymentProfile(),
          regloApi.getAutoscuolaSettings().catch(() => null),
          regloApi.getStudents().catch(() => [] as AutoscuolaStudent[]),
        ]);
        setPaymentProfile(profile);
        if (settings) {
          setAvailabilityWeeks(String(settings.availabilityWeeks));
        }
        const linkedStudent = findLinkedStudent(studentsList, user);
        setStudentProfile(linkedStudent);
        // Unblock the screen immediately: the profile card needs no network
        // and payment is already loaded. The availability preset only feeds
        // the Disponibilità sub-page + its summary row, so load it in the
        // background instead of blocking the whole screen on 7 slot calls.
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
        setPaymentProfile(null);
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
      "Questa azione è definitiva: perderai accesso all'app e i tuoi dati profilo verranno rimossi.",
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

  const toTimeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleSlotTimePicked = (date: Date) => {
    if (slotTimePickerTarget === 'morningStart') setMorningStart(date);
    else if (slotTimePickerTarget === 'morningEnd') setMorningEnd(date);
    else if (slotTimePickerTarget === 'afternoonStart') setAfternoonStart(date);
    else if (slotTimePickerTarget === 'afternoonEnd') setAfternoonEnd(date);
    setSlotTimePickerTarget(null);
  };

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

  const handleConfigurePaymentMethod = async () => {
    if (!isStudent(autoscuolaRole)) return;

    setPaymentLoading(true);
    setError(null);
    setToast(null);
    try {
      const setup = await regloApi.createSetupIntent();
      const baseSheetConfig = {
        merchantDisplayName: 'Reglo Autoscuole',
        customerId: setup.customerId,
        customerEphemeralKeySecret: setup.ephemeralKey,
        setupIntentClientSecret: setup.setupIntentClientSecret,
        defaultBillingDetails: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
        },
      } as const;

      let init = await initPaymentSheet({
        ...baseSheetConfig,
        applePay: { merchantCountryCode: 'IT' },
        googlePay: { merchantCountryCode: 'IT', testEnv: __DEV__ },
      });

      if (init.error && shouldRetryPaymentSheetWithoutWallet(init.error.message)) {
        init = await initPaymentSheet(baseSheetConfig);
        if (!init.error) {
          setToast({
            text: 'Apple Pay non disponibile su questa build. Usa carta o Link.',
            tone: 'info',
          });
        }
      }

      if (init.error) {
        throw new Error(init.error.message);
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        throw new Error(result.error.message);
      }

      await regloApi.confirmPaymentMethod({ setupIntentId: setup.setupIntentId });
      const profile = await regloApi.getPaymentProfile();
      setPaymentProfile(profile);
      setToast({ text: 'Metodo di pagamento salvato', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore configurando pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRemovePaymentMethod = () => {
    if (!isStudent(autoscuolaRole) || !paymentProfile?.hasPaymentMethod) return;
    Alert.alert(
      'Rimuovi metodo',
      'Rimuovendo il metodo di pagamento non potrai prenotare nuove guide finché non ne aggiungi uno nuovo.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            setPaymentLoading(true);
            setError(null);
            setToast(null);
            try {
              await regloApi.removePaymentMethod();
              const profile = await regloApi.getPaymentProfile();
              setPaymentProfile(profile);
              setToast({ text: 'Metodo di pagamento rimosso', tone: 'success' });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Errore rimuovendo il metodo');
            } finally {
              setPaymentLoading(false);
            }
          },
        },
      ]
    );
  };

  const paymentSubtitle = paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod
    ? `${paymentProfile.paymentMethod.brand.toUpperCase()} \u2022\u2022\u2022\u2022${paymentProfile.paymentMethod.last4} configurata`
    : 'Nessun metodo configurato';

  /* \u2500\u2500\u2500 Student-specific render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const availabilitySummary = availabilityDays.length > 0
    ? availabilityDays.map((d) => dayLetters[d]).join(', ') + (morningActive && afternoonActive ? ' \u2022 Tutto il giorno' : morningActive ? ' \u2022 Mattina' : afternoonActive ? ' \u2022 Pomeriggio' : '')
    : 'Non configurata';

  const paymentSummary = paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod
    ? `${paymentProfile.paymentMethod.brand.toUpperCase()} \u2022\u2022\u2022\u2022${paymentProfile.paymentMethod.last4}`
    : 'Non configurato';

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
      paymentProfile, paymentLoading,
      onConfigurePayment: handleConfigurePaymentMethod, onRemovePayment: handleRemovePaymentMethod,
    });
  });

  // Publish instructor/owner settings so the "Altro" formSheet sub-pages
  // (agenda-view, availability-mode, agenda-settings) can bind to live state.
  useEffect(() => {
    if (isStudent(autoscuolaRole)) return;
    instructorSettingsStore.set({
      agendaViewMode,
      onPickAgendaView: async (m) => {
        setAgendaViewMode(m);
        await sessionStorage.setAgendaViewMode(m);
      },
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

  const renderStudentContent = () => (
    <>
      <Animated.Text entering={FadeInUp.duration(400).springify()} style={studentStyles.pageTitle}>Profilo</Animated.Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Profile card -> opens profile-edit page. Name/email/company come from
          the session, so they render instantly with no skeleton. */}
      <Animated.View entering={FadeInUp.delay(70).duration(420).springify()}>
        <Pressable
          onPress={() => router.push('/(tabs)/settings/profile-edit')}
          style={({ pressed }) => [studentStyles.profileCard, pressed && { opacity: 0.95 }]}
        >
          <View style={studentStyles.profileAvatar}>
            <Text style={studentStyles.profileAvatarText}>{userInitials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={studentStyles.profileName} numberOfLines={1}>{user?.name ?? 'Utente'}</Text>
            <Text style={studentStyles.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
            <View style={studentStyles.profileCompanyPill}>
              <Ionicons name="business-outline" size={12} color={colors.textMuted} />
              <Text style={studentStyles.profileCompanyText} numberOfLines={1}>{activeCompany?.name ?? 'Autoscuola'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </Pressable>
      </Animated.View>

      {/* Menu group: preferences */}
      <Animated.View entering={FadeInUp.delay(140).duration(420).springify()} style={studentStyles.menuGroup}>
        <Pressable onPress={() => router.push('/(tabs)/settings/availability')} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
          <Ionicons name="calendar-outline" size={23} color="#1A1A2E" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={studentStyles.rowLabel}>Disponibilità</Text>
            {availabilityLoading ? (
              <SkeletonBlock width={130} height={11} radius={6} style={{ marginTop: 5 }} />
            ) : (
              <Text style={studentStyles.rowHint} numberOfLines={1}>{availabilitySummary}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </Pressable>

        {showStudentPaymentCard && (
          <>
            <View style={studentStyles.rowDivider} />
            <Pressable onPress={() => router.push('/(tabs)/settings/payment')} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
              <Ionicons name="card-outline" size={23} color="#1A1A2E" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={studentStyles.rowLabel}>Metodo di pagamento</Text>
                {initialLoading ? (
                  <SkeletonBlock width={110} height={11} radius={6} style={{ marginTop: 5 }} />
                ) : (
                  <Text style={studentStyles.rowHint} numberOfLines={1}>{paymentSummary}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          </>
        )}

        <View style={studentStyles.rowDivider} />
        <Pressable onPress={handleNotificationsTap} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
          <Ionicons name={notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline'} size={23} color="#1A1A2E" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={studentStyles.rowLabel}>Notifiche</Text>
            <Text style={[studentStyles.rowHint, !notificationsEnabled && { color: '#DC2626' }]} numberOfLines={1}>
              {notificationsEnabled ? 'Attive' : 'Disattivate'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </Pressable>
      </Animated.View>

      {/* Menu group: account */}
      <Animated.View entering={FadeInUp.delay(210).duration(420).springify()} style={studentStyles.menuGroup}>
        <Pressable onPress={handleSignOut} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
          <Ionicons name="log-out-outline" size={23} color="#1A1A2E" />
          <Text style={studentStyles.rowLabelFlex}>Esci</Text>
        </Pressable>
        <View style={studentStyles.rowDivider} />
        <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
          <Ionicons name="trash-outline" size={23} color="#DC2626" />
          <Text style={[studentStyles.rowLabelFlex, { color: '#DC2626' }]}>Elimina account</Text>
        </Pressable>
      </Animated.View>

      <Animated.Text entering={FadeInUp.delay(280).duration(420).springify()} style={studentStyles.footer}>Reglo v1.0.0</Animated.Text>
    </>
  );

  /* \u2500\u2500\u2500 Owner / Instructor render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const renderNonStudentContent = () => (
    <>
      {/* 1. Title */}
      {router.canGoBack() ? (
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
          <Text style={studentStyles.title}>Impostazioni</Text>
        </Pressable>
      ) : (
        <Text style={studentStyles.title}>Impostazioni</Text>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {initialLoading ? (
        <>
          <View style={studentStyles.profileCard}>
            <SkeletonBlock width={60} height={60} radius={30} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="60%" height={18} />
              <SkeletonBlock width="40%" height={14} />
            </View>
          </View>
          <SkeletonCard>
            <SkeletonBlock width="72%" />
            <SkeletonBlock width="100%" height={40} radius={12} style={styles.skeletonButton} />
          </SkeletonCard>
        </>
      ) : (
        <>
          {/* 2. Profile card -> sub-page (more/profile-edit) */}
          <Pressable
            onPress={() => router.push('/(tabs)/more/profile-edit')}
            style={({ pressed }) => [studentStyles.profileCard, pressed && { opacity: 0.95 }]}
          >
            <View style={studentStyles.profileAvatar}>
              <Text style={studentStyles.profileAvatarText}>{userInitials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={studentStyles.profileName} numberOfLines={1}>{user?.name ?? 'Utente'}</Text>
              <Text style={studentStyles.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
              <View style={studentStyles.profileCompanyPill}>
                <Ionicons name="business-outline" size={12} color={colors.textMuted} />
                <Text style={studentStyles.profileCompanyText} numberOfLines={1}>{activeCompany?.name ?? 'Autoscuola'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </Pressable>

          {/* 3. Preferences — normal rows that open formSheet sub-pages (like student) */}
          <View style={studentStyles.menuGroup}>
            {(isInstructor(autoscuolaRole) || isOwner(autoscuolaRole)) ? (
              <Pressable onPress={() => router.push('/(tabs)/more/agenda-view')} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
                <Ionicons name="grid-outline" size={23} color="#1A1A2E" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={studentStyles.rowLabel}>Vista agenda</Text>
                  <Text style={studentStyles.rowHint} numberOfLines={1}>
                    {agendaViewMode === 'day' ? 'Giornaliera' : 'Settimanale'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
              </Pressable>
            ) : null}

            {isInstructor(autoscuolaRole) ? (
              <>
                <View style={studentStyles.rowDivider} />
                <Pressable onPress={() => router.push('/(tabs)/more/availability-mode')} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
                  <Ionicons name="calendar-outline" size={23} color="#1A1A2E" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={studentStyles.rowLabel}>Disponibilità</Text>
                    {settingsLoading ? (
                      <SkeletonBlock width={90} height={11} radius={6} style={{ marginTop: 5 }} />
                    ) : (
                      <Text style={studentStyles.rowHint} numberOfLines={1}>
                        {instrAvailabilityMode === 'publication' ? 'Pubblicazione' : 'Predefinita'}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </Pressable>
              </>
            ) : null}

            {isOwner(autoscuolaRole) ? (
              <>
                <View style={studentStyles.rowDivider} />
                <Pressable onPress={() => router.push('/(tabs)/more/agenda-settings')} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
                  <Ionicons name="time-outline" size={23} color="#1A1A2E" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={studentStyles.rowLabel}>Agenda</Text>
                    {settingsLoading ? (
                      <SkeletonBlock width={120} height={11} radius={6} style={{ marginTop: 5 }} />
                    ) : (
                      <Text style={studentStyles.rowHint} numberOfLines={1}>
                        {availabilityWeeks} settimane prenotabili
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </Pressable>
              </>
            ) : null}

            <View style={studentStyles.rowDivider} />
            <Pressable onPress={handleNotificationsTap} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
              <Ionicons
                name={notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline'}
                size={23}
                color="#1A1A2E"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={studentStyles.rowLabel}>Notifiche</Text>
                <Text style={[studentStyles.rowHint, !notificationsEnabled && { color: '#DC2626' }]} numberOfLines={1}>
                  {notificationsEnabled ? 'Attive' : 'Disattivate'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          </View>

          {/* Account (flat menu group, like student) */}
          <View style={studentStyles.menuGroup}>
            <Pressable onPress={handleSignOut} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
              <Ionicons name="log-out-outline" size={23} color="#1A1A2E" />
              <Text style={studentStyles.rowLabelFlex}>Esci</Text>
            </Pressable>
            <View style={studentStyles.rowDivider} />
            <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [studentStyles.row, pressed && studentStyles.rowPressed]}>
              <Ionicons name="trash-outline" size={23} color="#DC2626" />
              <Text style={[studentStyles.rowLabelFlex, { color: '#DC2626' }]}>Elimina account</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <Text style={studentStyles.footer}>Reglo v1.0.0</Text>
        </>
      )}
    </>
  );


  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

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
        {isStudent(autoscuolaRole) ? renderStudentContent() : renderNonStudentContent()}
      </ScrollView>
      <TimePickerDrawer
        visible={slotTimePickerTarget !== null}
        onClose={() => setSlotTimePickerTarget(null)}
        onSelectTime={handleSlotTimePicked}
        selectedTime={
          slotTimePickerTarget === 'morningStart' ? morningStart
            : slotTimePickerTarget === 'morningEnd' ? morningEnd
            : slotTimePickerTarget === 'afternoonStart' ? afternoonStart
            : slotTimePickerTarget === 'afternoonEnd' ? afternoonEnd
            : buildTime(9, 0)
        }
      />
    </Screen>
  );
};

/* \u2500\u2500\u2500 Student-specific styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const studentStyles = StyleSheet.create({
  title: {
    fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E',
  },

  pageTitle: {
    fontSize: 30, fontWeight: '600', letterSpacing: -0.5, color: '#1A1A2E',
    marginBottom: 4,
  },

  /* Profile card (Airbnb-style: avatar + info + chevron) */
  profileCard: {
    backgroundColor: colors.surface, borderRadius: 22,
    padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 10, elevation: 4,
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E9EBF2',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 22, fontWeight: '800', color: colors.primary,
  },
  profileName: {
    fontSize: 18, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.2,
  },
  profileEmail: {
    fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 1,
  },
  profileCompanyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
  },
  profileCompanyText: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
  },

  /* Menu group: flat rows grouped, hairline dividers */
  menuGroup: {
    gap: 0,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, minHeight: 60,
  },
  rowPressed: {
    opacity: 0.55,
  },
  rowLabel: {
    fontSize: 16, fontWeight: '500', color: '#1A1A2E',
  },
  rowLabelFlex: {
    fontSize: 16, fontWeight: '500', color: '#1A1A2E', flex: 1,
  },
  rowHint: {
    fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 39,
  },

  /* ── Payment ── */
  warningText: { fontSize: 12, fontWeight: '500', color: '#F59E0B', marginBottom: 12 },

  /* ── CTA Buttons ── */
  pinkCta: {
    backgroundColor: colors.primary, minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  pinkCtaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  dangerCta: {
    backgroundColor: '#FEE2E2', minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 10,
  },
  dangerCtaText: { fontSize: 16, fontWeight: '600', color: '#DC2626' },

  /* ── Field group ── */
  fieldGroup: { gap: 8, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

  /* ── Footer ── */
  footer: {
    textAlign: 'center', fontSize: 11, fontWeight: '500',
    color: colors.textMuted, marginTop: 12,
  },

});

/* \u2500\u2500\u2500 Shared / non-student styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 24,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  headerBlock: {
    gap: spacing.xs,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  rolePillText: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.36)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.destructive,
    flex: 1,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatarText: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  profileHeroMeta: {
    flex: 1,
  },
  profileName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  profileHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fieldGroup: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },
  inlineHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  sessionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'cover',
  },
  logoFallback: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  companyMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  studentAvailabilityBlock: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  studentAvailabilityDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotOk: {
    backgroundColor: colors.positive,
  },
  statusDotNeutral: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  paymentMethodText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  warningText: {
    ...typography.caption,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timePickerFieldWrap: {
    flex: 1,
  },
  timePickerField: {
    borderRadius: 14,
  },
  timePickerFieldPressed: {
    opacity: 0.86,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 18, 10, 0.72)',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
});
