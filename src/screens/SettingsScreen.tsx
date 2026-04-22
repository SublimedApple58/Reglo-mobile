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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
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
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { colors, radii, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaStudent, MobileStudentPaymentProfile } from '../types/regloApi';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import * as Notifications from 'expo-notifications';
import { sessionStorage } from '../services/sessionStorage';

type AnimatedChevronProps = { expanded: boolean };
const AnimatedChevron = ({ expanded }: AnimatedChevronProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 90])}deg` }],
  }));

  return (
    <Animated.View style={[{ marginLeft: 8, width: 20, alignItems: 'center' }, animatedStyle]}>
      <Text style={{ fontSize: 20, color: '#CBD5E1' }}>{'\u203A'}</Text>
    </Animated.View>
  );
};

type AnimatedSectionProps = { expanded: boolean; children: React.ReactNode };
const AnimatedSection = ({ expanded, children }: AnimatedSectionProps) => {
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    height: contentHeight > 0 ? interpolate(progress.value, [0, 1], [0, contentHeight]) : expanded ? undefined : 0,
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={containerStyle}>
      <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)} style={{ position: contentHeight > 0 ? 'relative' : 'absolute', width: '100%' }}>
        {children}
      </View>
    </Animated.View>
  );
};

const shouldRetryPaymentSheetWithoutWallet = (message?: string | null) => {
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes('merchantidentifier') || normalized.includes('merchant identifier');
};

const reminderOptions = [120, 60, 30, 20, 15] as const;
const weekPresets = [2, 4, 6, 8, 12] as const;

const toReminderLabel = (minutes: number) => {
  if (minutes === 120) return '2h';
  return `${minutes}m`;
};

const roleLabelMap = {
  STUDENT: 'Allievo',
  INSTRUCTOR: 'Istruttore',
  OWNER: 'Titolare',
} as const;

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
  const [morningActive, setMorningActive] = useState(false);
  const [afternoonActive, setAfternoonActive] = useState(false);
  const [morningStart, setMorningStart] = useState(buildTime(8, 0));
  const [morningEnd, setMorningEnd] = useState(buildTime(12, 0));
  const [afternoonStart, setAfternoonStart] = useState(buildTime(14, 0));
  const [afternoonEnd, setAfternoonEnd] = useState(buildTime(18, 0));
  const [slotTimePickerTarget, setSlotTimePickerTarget] = useState<
    'morningStart' | 'morningEnd' | 'afternoonStart' | 'afternoonEnd' | null
  >(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
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
  const showStudentPaymentCard =
    autoscuolaRole === 'STUDENT' && paymentProfile?.autoPaymentsEnabled === true;

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
    const dates = Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
    const responses = await Promise.all(
      dates.map((day) =>
        regloApi.getAvailabilitySlots({
          ownerType: 'student',
          ownerId: studentId,
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
      if (autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR') {
        try {
          const settings = await regloApi.getAutoscuolaSettings();
          setAvailabilityWeeks(String(settings.availabilityWeeks));
          setStudentReminderMinutes(String(settings.studentReminderMinutes));
          setInstructorReminderMinutes(String(settings.instructorReminderMinutes));
          setAppBookingActors(settings.appBookingActors ?? 'students');
          setInstructorBookingMode(settings.instructorBookingMode ?? 'manual_engine');
        } catch (settingsErr) {
          if (autoscuolaRole === 'OWNER') {
            throw settingsErr;
          }
        }
      }

      if (autoscuolaRole === 'STUDENT') {
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
        if (linkedStudent?.id) {
          await loadStudentAvailabilityPreset(linkedStudent.id);
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
    if (autoscuolaRole !== 'STUDENT') return;

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
    if (autoscuolaRole !== 'STUDENT' || !paymentProfile?.hasPaymentMethod) return;
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

  const handleOpenInstructorManage = () => {
    router.push('/(tabs)/role');
  };

  const toggleSection = (key: string) =>
    setActiveSection((prev) => (prev === key ? null : key));

  const paymentSubtitle = paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod
    ? `${paymentProfile.paymentMethod.brand.toUpperCase()} \u2022\u2022\u2022\u2022${paymentProfile.paymentMethod.last4} configurata`
    : 'Nessun metodo configurato';

  /* \u2500\u2500\u2500 Student-specific render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const renderStudentContent = () => (
    <>
      {/* 1. Title */}
      {router.canGoBack() ? (
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
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
          <View style={studentStyles.heroCard}>
            <View style={studentStyles.heroRow}>
              <SkeletonBlock width={56} height={56} radius={28} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="60%" height={18} />
                <SkeletonBlock width="40%" height={14} />
              </View>
            </View>
          </View>
          <View style={studentStyles.menuCard}>
            <SkeletonCard>
              <SkeletonBlock width="72%" />
              <SkeletonBlock width="100%" height={40} radius={12} style={styles.skeletonButton} />
            </SkeletonCard>
          </View>
        </>
      ) : (
        <>
          {/* 2. Profile Hero Card */}
          <Pressable onPress={() => toggleSection('profile')} style={studentStyles.heroCard}>
            <View style={studentStyles.heroRow}>
              <View style={studentStyles.heroAvatar}>
                <Text style={studentStyles.heroAvatarText}>{userInitials}</Text>
              </View>
              <View style={studentStyles.heroMeta}>
                <Text style={studentStyles.heroName}>{user?.name ?? 'Utente'}</Text>
                <Text style={studentStyles.heroEmail}>{user?.email ?? 'Email non disponibile'}</Text>
              </View>
              <AnimatedChevron expanded={activeSection === 'profile'} />
            </View>
            <View style={studentStyles.heroDivider} />
            <View style={studentStyles.heroCompanyRow}>
              <View style={studentStyles.yellowDot} />
              <Text style={studentStyles.heroCompanyName}>{activeCompany?.name ?? 'Nessuna autoscuola'}</Text>
            </View>

            {/* Expanded: profile edit */}
            <AnimatedSection expanded={activeSection === 'profile'}>
              <View style={studentStyles.expandedContent}>
                <View style={studentStyles.fieldGroup}>
                  <Text style={studentStyles.fieldLabel}>Nome completo</Text>
                  <Input placeholder="Nome" value={name} onChangeText={setName} />
                </View>
                <View style={studentStyles.fieldGroup}>
                  <Text style={studentStyles.fieldLabel}>Numero di cellulare</Text>
                  <Input placeholder="Cellulare" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={({ pressed }) => [
                    studentStyles.pinkCta,
                    pressed && { opacity: 0.85 },
                    saving && { opacity: 0.6 },
                  ]}
                >
                  <Text style={studentStyles.pinkCtaText}>
                    {saving ? 'Salvataggio...' : 'Salva profilo'}
                  </Text>
                </Pressable>
              </View>
            </AnimatedSection>
          </Pressable>

          {/* 3. Settings Menu Card */}
          <View style={studentStyles.menuCard}>
            {/* a. Disponibilità */}
            <Pressable onPress={() => toggleSection('availability')} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="calendar-outline" size={20} color="#CA8A04" />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.menuTitle}>Disponibilità</Text>
                <Text style={studentStyles.menuSubtitle}>Giorni e orari preferiti per le guide</Text>
              </View>
              <AnimatedChevron expanded={activeSection === 'availability'} />
            </Pressable>

            <AnimatedSection expanded={activeSection === 'availability'}>
              <View style={studentStyles.expandedContent}>
                {!studentProfile ? (
                  <Text style={studentStyles.expandedHint}>
                    Profilo allievo non collegato alla company attiva.
                  </Text>
                ) : (
                  <>
                    <Text style={studentStyles.expandedHint}>
                      Ripetizione ogni {Number(availabilityWeeks) || 4} settimane
                    </Text>

                    {/* Day circles */}
                    <View style={studentStyles.dayRow}>
                      {[1, 2, 3, 4, 5, 6].map((dayIndex) => {
                        const isActive = availabilityDays.includes(dayIndex);
                        return (
                          <Pressable
                            key={dayIndex}
                            onPress={() => toggleAvailabilityDay(dayIndex)}
                            style={[
                              studentStyles.dayCircle,
                              isActive ? studentStyles.dayCircleActive : studentStyles.dayCircleInactive,
                            ]}
                          >
                            <Text
                              style={[
                                studentStyles.dayCircleText,
                                isActive ? studentStyles.dayCircleTextActive : studentStyles.dayCircleTextInactive,
                              ]}
                            >
                              {dayLetters[dayIndex]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Time slot toggles with editable ranges */}
                    <View style={studentStyles.slotsContainer}>
                      {/* Morning slot */}
                      <View style={studentStyles.slotBlock}>
                        <Pressable onPress={toggleMorning} style={studentStyles.slotRow}>
                          <Text
                            style={[
                              studentStyles.slotLabel,
                              morningActive ? studentStyles.slotLabelActive : studentStyles.slotLabelInactive,
                            ]}
                          >
                            Mattina
                          </Text>
                          <View
                            style={[
                              studentStyles.slotDot,
                              morningActive ? studentStyles.slotDotActive : studentStyles.slotDotInactive,
                            ]}
                          />
                        </Pressable>
                        {morningActive ? (
                          <View style={studentStyles.slotTimeRow}>
                            <Pressable
                              style={studentStyles.slotTimeCard}
                              onPress={() => setSlotTimePickerTarget('morningStart')}
                            >
                              <Ionicons name="time-outline" size={16} color="#EC4899" />
                              <Text style={studentStyles.slotTimeText}>{toTimeStr(morningStart)}</Text>
                            </Pressable>
                            <Text style={studentStyles.slotTimeSep}>—</Text>
                            <Pressable
                              style={studentStyles.slotTimeCard}
                              onPress={() => setSlotTimePickerTarget('morningEnd')}
                            >
                              <Ionicons name="time-outline" size={16} color="#EC4899" />
                              <Text style={studentStyles.slotTimeText}>{toTimeStr(morningEnd)}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>

                      {/* Afternoon slot */}
                      <View style={studentStyles.slotBlock}>
                        <Pressable onPress={toggleAfternoon} style={studentStyles.slotRow}>
                          <Text
                            style={[
                              studentStyles.slotLabel,
                              afternoonActive ? studentStyles.slotLabelActive : studentStyles.slotLabelInactive,
                            ]}
                          >
                            Pomeriggio
                          </Text>
                          <View
                            style={[
                              studentStyles.slotDot,
                              afternoonActive ? studentStyles.slotDotActive : studentStyles.slotDotInactive,
                            ]}
                          />
                        </Pressable>
                        {afternoonActive ? (
                          <View style={studentStyles.slotTimeRow}>
                            <Pressable
                              style={studentStyles.slotTimeCard}
                              onPress={() => setSlotTimePickerTarget('afternoonStart')}
                            >
                              <Ionicons name="time-outline" size={16} color="#EC4899" />
                              <Text style={studentStyles.slotTimeText}>{toTimeStr(afternoonStart)}</Text>
                            </Pressable>
                            <Text style={studentStyles.slotTimeSep}>—</Text>
                            <Pressable
                              style={studentStyles.slotTimeCard}
                              onPress={() => setSlotTimePickerTarget('afternoonEnd')}
                            >
                              <Ionicons name="time-outline" size={16} color="#EC4899" />
                              <Text style={studentStyles.slotTimeText}>{toTimeStr(afternoonEnd)}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Save CTA */}
                    <Pressable
                      onPress={handleSaveStudentAvailability}
                      disabled={availabilitySaving}
                      style={({ pressed }) => [
                        studentStyles.pinkCta,
                        pressed && { opacity: 0.85 },
                        availabilitySaving && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={studentStyles.pinkCtaText}>
                        {availabilitySaving ? 'Salvataggio...' : 'Salva Modifiche'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </AnimatedSection>

            {/* Divider */}
            {showStudentPaymentCard ? <View style={studentStyles.menuDivider} /> : null}

            {/* b. Metodo di pagamento */}
            {showStudentPaymentCard ? (
              <>
                <Pressable onPress={() => toggleSection('payment')} style={studentStyles.menuRow}>
                  <View style={[studentStyles.menuIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Ionicons name="card-outline" size={20} color="#EC4899" />
                  </View>
                  <View style={studentStyles.menuTextWrap}>
                    <Text style={studentStyles.menuTitle}>Metodo di pagamento</Text>
                    <Text style={studentStyles.menuSubtitle}>{paymentSubtitle}</Text>
                  </View>
                  <AnimatedChevron expanded={activeSection === 'payment'} />
                </Pressable>

                <AnimatedSection expanded={activeSection === 'payment'}>
                  <View style={studentStyles.expandedContent}>
                    <View style={studentStyles.expandedStatusRow}>
                      <View
                        style={[
                          studentStyles.expandedStatusDot,
                          paymentProfile?.hasPaymentMethod
                            ? studentStyles.expandedStatusDotOk
                            : studentStyles.expandedStatusDotNeutral,
                        ]}
                      />
                      <Text style={studentStyles.expandedStatusText}>{paymentStatusText}</Text>
                    </View>

                    {paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod ? (
                      <View style={studentStyles.paymentMethodRow}>
                        <Ionicons name="card-outline" size={18} color="#94A3B8" />
                        <Text style={studentStyles.paymentMethodText}>
                          {paymentProfile.paymentMethod.brand.toUpperCase()} \u2022\u2022\u2022\u2022{paymentProfile.paymentMethod.last4}
                        </Text>
                      </View>
                    ) : (
                      <Text style={studentStyles.expandedHint}>
                        Aggiungi una carta per prenotare e pagare senza attriti.
                      </Text>
                    )}

                    {paymentProfile?.blockedByInsoluti ? (
                      <Text style={studentStyles.warningText}>Hai pagamenti insoluti. Salda dalla Home.</Text>
                    ) : null}

                    <Pressable
                      onPress={handleConfigurePaymentMethod}
                      disabled={paymentLoading}
                      style={({ pressed }) => [
                        studentStyles.pinkCta,
                        pressed && { opacity: 0.85 },
                        paymentLoading && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={studentStyles.pinkCtaText}>
                        {paymentLoading
                          ? 'Attendi...'
                          : paymentProfile?.hasPaymentMethod
                            ? 'Aggiorna metodo'
                            : 'Aggiungi metodo'}
                      </Text>
                    </Pressable>

                    {paymentProfile?.hasPaymentMethod ? (
                      <Pressable
                        onPress={handleRemovePaymentMethod}
                        disabled={paymentLoading}
                        style={({ pressed }) => [
                          studentStyles.dangerCta,
                          pressed && { opacity: 0.85 },
                          paymentLoading && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={studentStyles.dangerCtaText}>
                          {paymentLoading ? 'Attendi...' : 'Rimuovi metodo'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </AnimatedSection>
              </>
            ) : null}

            {/* Divider */}
            <View style={studentStyles.menuDivider} />

            {/* c. Notifiche */}
            <Pressable onPress={handleNotificationsTap} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: notificationsEnabled ? '#EFF6FF' : '#FEF2F2' }]}>
                <Ionicons
                  name={notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline'}
                  size={20}
                  color={notificationsEnabled ? '#3B82F6' : '#EF4444'}
                />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.menuTitle}>Notifiche</Text>
                <Text style={[studentStyles.menuSubtitle, !notificationsEnabled && { color: '#EF4444' }]}>
                  {notificationsEnabled ? 'Attive — riceverai promemoria guide' : 'Disattivate — attivale per non perdere le guide'}
                </Text>
              </View>
              <View style={[studentStyles.notifDot, notificationsEnabled ? studentStyles.notifDotOn : studentStyles.notifDotOff]} />
            </Pressable>
          </View>

          {/* 4. Danger Zone Card */}
          <View style={studentStyles.dangerCard}>
            <Pressable onPress={handleSignOut} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.dangerTitle}>Logout</Text>
              </View>
            </Pressable>

            <View style={studentStyles.menuDivider} />

            <Pressable onPress={handleDeleteAccount} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.dangerTitle}>Elimina account</Text>
              </View>
            </Pressable>
          </View>

          {/* 5. Footer */}
          <Text style={studentStyles.footer}>Reglo v1.0.0</Text>
        </>
      )}
    </>
  );

  /* \u2500\u2500\u2500 Owner / Instructor render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const renderNonStudentContent = () => (
    <>
      {/* 1. Title */}
      {router.canGoBack() ? (
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
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
          <View style={studentStyles.heroCard}>
            <View style={studentStyles.heroRow}>
              <SkeletonBlock width={56} height={56} radius={28} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="60%" height={18} />
                <SkeletonBlock width="40%" height={14} />
              </View>
            </View>
          </View>
          <View style={studentStyles.menuCard}>
            <SkeletonCard>
              <SkeletonBlock width="72%" />
              <SkeletonBlock width="100%" height={40} radius={12} style={styles.skeletonButton} />
            </SkeletonCard>
          </View>
        </>
      ) : (
        <>
          {/* 2. Profile Hero Card */}
          <Pressable onPress={() => toggleSection('profile')} style={studentStyles.heroCard}>
            <View style={studentStyles.heroRow}>
              <View style={studentStyles.heroAvatar}>
                <Text style={studentStyles.heroAvatarText}>{userInitials}</Text>
              </View>
              <View style={studentStyles.heroMeta}>
                <Text style={studentStyles.heroName}>{user?.name ?? 'Utente'}</Text>
                <Text style={studentStyles.heroEmail}>{user?.email ?? 'Email non disponibile'}</Text>
              </View>
              <AnimatedChevron expanded={activeSection === 'profile'} />
            </View>
            <View style={studentStyles.heroDivider} />
            <View style={studentStyles.heroCompanyRow}>
              <View style={studentStyles.yellowDot} />
              <Text style={studentStyles.heroCompanyName}>{activeCompany?.name ?? 'Nessuna autoscuola'}</Text>
            </View>

            {/* Expanded: profile edit */}
            <AnimatedSection expanded={activeSection === 'profile'}>
              <View style={studentStyles.expandedContent}>
                <View style={studentStyles.fieldGroup}>
                  <Text style={studentStyles.fieldLabel}>Nome completo</Text>
                  <Input placeholder="Nome" value={name} onChangeText={setName} />
                </View>
                <View style={studentStyles.fieldGroup}>
                  <Text style={studentStyles.fieldLabel}>Numero di cellulare</Text>
                  <Input placeholder="Cellulare" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={({ pressed }) => [
                    studentStyles.pinkCta,
                    pressed && { opacity: 0.85 },
                    saving && { opacity: 0.6 },
                  ]}
                >
                  <Text style={studentStyles.pinkCtaText}>
                    {saving ? 'Salvataggio...' : 'Salva profilo'}
                  </Text>
                </Pressable>
              </View>
            </AnimatedSection>
          </Pressable>

          {/* 3. Settings Menu Card */}
          <View style={studentStyles.menuCard}>
            {/* Agenda View Mode */}
            {(autoscuolaRole === 'INSTRUCTOR' || autoscuolaRole === 'OWNER') ? (
              <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={[studentStyles.menuIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Ionicons name="grid-outline" size={20} color="#EC4899" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={studentStyles.menuTitle}>Vista agenda</Text>
                    <Text style={studentStyles.menuSubtitle}>Come visualizzare le guide in home</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={async () => {
                      setAgendaViewMode('day');
                      await sessionStorage.setAgendaViewMode('day');
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      alignItems: 'center',
                      backgroundColor: agendaViewMode === 'day' ? '#FEF9C3' : '#F8FAFC',
                      borderColor: agendaViewMode === 'day' ? '#FDE047' : '#E2E8F0',
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={agendaViewMode === 'day' ? '#A16207' : '#64748B'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: agendaViewMode === 'day' ? '#A16207' : '#64748B', marginTop: 4 }}>
                      Giornaliera
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      setAgendaViewMode('week');
                      await sessionStorage.setAgendaViewMode('week');
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      alignItems: 'center',
                      backgroundColor: agendaViewMode === 'week' ? '#FEF9C3' : '#F8FAFC',
                      borderColor: agendaViewMode === 'week' ? '#FDE047' : '#E2E8F0',
                    }}
                  >
                    <Ionicons name="grid-outline" size={18} color={agendaViewMode === 'week' ? '#A16207' : '#64748B'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: agendaViewMode === 'week' ? '#A16207' : '#64748B', marginTop: 4 }}>
                      Settimanale
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* a. Role-specific settings row */}
            {autoscuolaRole === 'INSTRUCTOR' ? (
              <>
                <Pressable onPress={() => toggleSection('operativity')} style={studentStyles.menuRow}>
                  <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF9C3' }]}>
                    <Ionicons name="speedometer-outline" size={20} color="#CA8A04" />
                  </View>
                  <View style={studentStyles.menuTextWrap}>
                    <Text style={studentStyles.menuTitle}>Operatività</Text>
                    <Text style={studentStyles.menuSubtitle}>
                      Promemoria: {toReminderLabel(Number(instructorReminderMinutes))}
                    </Text>
                  </View>
                  <AnimatedChevron expanded={activeSection === 'operativity'} />
                </Pressable>

                <AnimatedSection expanded={activeSection === 'operativity'}>
                  <View style={studentStyles.expandedContent}>
                    <View style={studentStyles.expandedStatusRow}>
                      <View style={[studentStyles.expandedStatusDot, studentStyles.expandedStatusDotOk]} />
                      <Text style={studentStyles.expandedStatusText}>
                        Promemoria guide: {toReminderLabel(Number(instructorReminderMinutes))}
                      </Text>
                    </View>
                    <Text style={studentStyles.expandedHint}>
                      Il promemoria viene applicato prima della guida in base alle impostazioni della tua autoscuola.
                    </Text>
                    <Text style={studentStyles.expandedHint}>
                      Prenotazioni da app: {bookingActorLabelMap[appBookingActors]}.
                    </Text>
                    {(appBookingActors === 'instructors' || appBookingActors === 'both') ? (
                      <Text style={studentStyles.expandedHint}>
                        Modalità corrente: {instructorModeLabelMap[instructorBookingMode]}.
                      </Text>
                    ) : null}
                    <Text style={studentStyles.expandedHint}>
                      Questa policy è configurata dal titolare in web app.
                    </Text>
                    <Pressable
                      onPress={handleOpenInstructorManage}
                      style={({ pressed }) => [
                        studentStyles.pinkCta,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={studentStyles.pinkCtaText}>Apri gestione disponibilità</Text>
                    </Pressable>
                  </View>
                </AnimatedSection>
              </>
            ) : null}

            {autoscuolaRole === 'OWNER' ? (
              <>
                <Pressable onPress={() => toggleSection('agenda')} style={studentStyles.menuRow}>
                  <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF9C3' }]}>
                    <Ionicons name="calendar-outline" size={20} color="#CA8A04" />
                  </View>
                  <View style={studentStyles.menuTextWrap}>
                    <Text style={studentStyles.menuTitle}>Agenda e notifiche</Text>
                    <Text style={studentStyles.menuSubtitle}>
                      {availabilityWeeks} settimane prenotabili
                    </Text>
                  </View>
                  <AnimatedChevron expanded={activeSection === 'agenda'} />
                </Pressable>

                <AnimatedSection expanded={activeSection === 'agenda'}>
                  <View style={studentStyles.expandedContent}>
                    {/* Settimane prenotabili */}
                    <View style={studentStyles.fieldGroup}>
                      <Text style={studentStyles.fieldLabel}>Settimane prenotabili</Text>
                      <Input
                        placeholder="Settimane disponibilità (1-12)"
                        value={availabilityWeeks}
                        onChangeText={setAvailabilityWeeks}
                        keyboardType="number-pad"
                      />
                      <View style={styles.chipRow}>
                        {weekPresets.map((weeks) => (
                          <SelectableChip
                            key={weeks}
                            label={`${weeks}w`}
                            active={availabilityWeeks === String(weeks)}
                            onPress={() => setAvailabilityWeeks(String(weeks))}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Promemoria allievo */}
                    <View style={studentStyles.fieldGroup}>
                      <Text style={studentStyles.fieldLabel}>Promemoria allievo</Text>
                      <View style={styles.chipRow}>
                        {reminderOptions.map((minutes) => (
                          <SelectableChip
                            key={`student-${minutes}`}
                            label={toReminderLabel(minutes)}
                            active={studentReminderMinutes === String(minutes)}
                            onPress={() => setStudentReminderMinutes(String(minutes))}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Promemoria istruttore */}
                    <View style={studentStyles.fieldGroup}>
                      <Text style={studentStyles.fieldLabel}>Promemoria istruttore</Text>
                      <View style={styles.chipRow}>
                        {reminderOptions.map((minutes) => (
                          <SelectableChip
                            key={`instructor-${minutes}`}
                            label={toReminderLabel(minutes)}
                            active={instructorReminderMinutes === String(minutes)}
                            onPress={() => setInstructorReminderMinutes(String(minutes))}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Prenotazioni da app info */}
                    <Text style={studentStyles.expandedHint}>
                      Attori abilitati: {bookingActorLabelMap[appBookingActors]}.
                    </Text>
                    {(appBookingActors === 'instructors' || appBookingActors === 'both') ? (
                      <Text style={studentStyles.expandedHint}>
                        Modalità istruttore: {instructorModeLabelMap[instructorBookingMode]}.
                      </Text>
                    ) : (
                      <Text style={studentStyles.expandedHint}>
                        Configurazione istruttore non necessaria con policy attuale.
                      </Text>
                    )}
                    <Text style={[studentStyles.expandedHint, { marginBottom: 16 }]}>
                      Configura i dettagli da Reglo Web &gt; Autoscuole &gt; Disponibilità.
                    </Text>

                    {/* Save CTA */}
                    <Pressable
                      onPress={handleSaveOwnerSettings}
                      disabled={savingSettings}
                      style={({ pressed }) => [
                        studentStyles.pinkCta,
                        pressed && { opacity: 0.85 },
                        savingSettings && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={studentStyles.pinkCtaText}>
                        {savingSettings ? 'Salvataggio...' : 'Salva impostazioni'}
                      </Text>
                    </Pressable>
                  </View>
                </AnimatedSection>
              </>
            ) : null}

            {/* Divider */}
            <View style={studentStyles.menuDivider} />

            {/* b. Notifiche */}
            <Pressable onPress={handleNotificationsTap} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: notificationsEnabled ? '#EFF6FF' : '#FEF2F2' }]}>
                <Ionicons
                  name={notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline'}
                  size={20}
                  color={notificationsEnabled ? '#3B82F6' : '#EF4444'}
                />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.menuTitle}>Notifiche</Text>
                <Text style={[studentStyles.menuSubtitle, !notificationsEnabled && { color: '#EF4444' }]}>
                  {notificationsEnabled ? 'Attive \u2014 riceverai promemoria guide' : 'Disattivate \u2014 attivale per non perdere le guide'}
                </Text>
              </View>
              <View style={[studentStyles.notifDot, notificationsEnabled ? studentStyles.notifDotOn : studentStyles.notifDotOff]} />
            </Pressable>
          </View>

          {/* 4. Danger Zone Card */}
          <View style={studentStyles.dangerCard}>
            <Pressable onPress={handleSignOut} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.dangerTitle}>Logout</Text>
              </View>
            </Pressable>

            <View style={studentStyles.menuDivider} />

            <Pressable onPress={handleDeleteAccount} style={studentStyles.menuRow}>
              <View style={[studentStyles.menuIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <View style={studentStyles.menuTextWrap}>
                <Text style={studentStyles.dangerTitle}>Elimina account</Text>
              </View>
            </Pressable>
          </View>

          {/* 5. Footer */}
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
        {autoscuolaRole === 'STUDENT' ? renderStudentContent() : renderNonStudentContent()}
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* Hero Card */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EC4899',
  },
  heroMeta: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  heroEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  heroCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yellowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FACC15',
  },
  heroCompanyName: {
    fontSize: 13,
    color: '#64748B',
  },

  /* Menu Card */
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 20,
  },

  /* Expanded content */
  expandedContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  expandedHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  expandedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  expandedStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  expandedStatusDotOk: {
    backgroundColor: '#22C55E',
  },
  expandedStatusDotNeutral: {
    backgroundColor: '#CBD5E1',
  },
  expandedStatusText: {
    fontSize: 14,
    color: '#1E293B',
  },

  /* Availability day circles */
  dayRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontWeight: '700',
    fontSize: 15,
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  dayCircleTextInactive: {
    color: '#64748B',
  },

  /* Slot toggles */
  slotsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  slotLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  slotLabelActive: {
    color: '#1E293B',
  },
  slotLabelInactive: {
    color: '#94A3B8',
  },
  slotDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  slotDotActive: {
    backgroundColor: '#22C55E',
  },
  slotDotInactive: {
    backgroundColor: '#CBD5E1',
  },
  slotBlock: {
    gap: 8,
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  slotTimeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  slotTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  slotTimeSep: {
    fontSize: 14,
    color: '#94A3B8',
  },

  /* Payment method row inside expanded */
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginBottom: 12,
  },

  /* CTA Buttons */
  pinkCta: {
    backgroundColor: '#EC4899',
    minHeight: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinkCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dangerCta: {
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  dangerCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },

  /* Field group */
  fieldGroup: {
    gap: 10,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },

  /* Notification dot */
  notifDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  notifDotOn: {
    backgroundColor: '#22C55E',
  },
  notifDotOff: {
    backgroundColor: '#CBD5E1',
  },

  /* Danger Zone Card */
  dangerCard: {
    backgroundColor: '#FFFBFB',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    overflow: 'hidden',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },

  /* Footer */
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 20,
  },
});

/* \u2500\u2500\u2500 Shared / non-student styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  headerBlock: {
    gap: spacing.xs,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.pink[50],
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
    backgroundColor: colors.pink[50],
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
    backgroundColor: 'rgba(10, 15, 30, 0.78)',
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
