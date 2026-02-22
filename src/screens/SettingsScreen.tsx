import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaStudent, MobileStudentPaymentProfile } from '../types/regloApi';

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
  guided_proposal: 'Guidata con proposta',
} as const;

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
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
          <GlassInput
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
                <GlassButton label="Fatto" onPress={close} />
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
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [availabilityWeeks, setAvailabilityWeeks] = useState('4');
  const [studentReminderMinutes, setStudentReminderMinutes] = useState('60');
  const [instructorReminderMinutes, setInstructorReminderMinutes] = useState('60');
  const [appBookingActors, setAppBookingActors] = useState<'students' | 'instructors' | 'both'>('students');
  const [instructorBookingMode, setInstructorBookingMode] =
    useState<'manual_full' | 'manual_engine' | 'guided_proposal'>('manual_engine');
  const [refreshing, setRefreshing] = useState(false);
  const [paymentProfile, setPaymentProfile] = useState<MobileStudentPaymentProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<AutoscuolaStudent | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState(buildTime(9, 0));
  const [availabilityEnd, setAvailabilityEnd] = useState(buildTime(18, 0));
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

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

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user]);

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
      return;
    }

    const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
    const minStart = Math.min(...ranges.map((item) => item.startMin));
    const maxEnd = Math.max(...ranges.map((item) => item.endMin));
    setAvailabilityDays(daySet);
    setAvailabilityStart(buildTime(Math.floor(minStart / 60), minStart % 60));
    setAvailabilityEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
  }, []);

  const loadSettings = useCallback(async () => {
    try {
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
      await regloApi.updateProfile({ name: trimmed });
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

      await regloApi.createAvailabilitySlots({
        ownerType: 'student',
        ownerId: studentProfile.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
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

  const handleOpenInstructorManage = () => {
    router.push('/(tabs)/role');
  };

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
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.headerBlock}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
          <Text style={styles.title}>Impostazioni</Text>
          <Text style={styles.subtitle}>Account, autoscuola e preferenze operative.</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {initialLoading ? (
          <>
            <GlassCard title="Account" subtitle="Dati personali e accesso">
              <SkeletonCard>
                <SkeletonBlock width="100%" height={52} radius={14} />
                <SkeletonBlock width="56%" />
                <SkeletonBlock width="100%" height={44} radius={14} style={styles.skeletonButton} />
              </SkeletonCard>
            </GlassCard>
            <GlassCard title="Autoscuola attiva" subtitle="Contesto operativo corrente">
              <SkeletonCard>
                <SkeletonBlock width="64%" height={22} />
                <SkeletonBlock width="46%" />
              </SkeletonCard>
            </GlassCard>
            <GlassCard title="Caricamento impostazioni">
              <SkeletonCard>
                <SkeletonBlock width="72%" />
                <SkeletonBlock width="100%" height={40} radius={12} style={styles.skeletonButton} />
              </SkeletonCard>
            </GlassCard>
          </>
        ) : (
          <>
            <GlassCard title="Account" subtitle="Dati personali e accesso">
              <View style={styles.profileHeroRow}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{userInitials}</Text>
                </View>
                <View style={styles.profileHeroMeta}>
                  <Text style={styles.profileName}>{user?.name ?? 'Utente'}</Text>
                  <Text style={styles.profileHint}>{user?.email ?? 'Email non disponibile'}</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nome completo</Text>
                <GlassInput placeholder="Nome" value={name} onChangeText={setName} />
              </View>

              <GlassButton
                label={saving ? 'Salvataggio...' : 'Salva profilo'}
                onPress={handleSaveProfile}
                disabled={saving}
                tone="primary"
                fullWidth
              />
            </GlassCard>

            <GlassCard title="Autoscuola attiva" subtitle="Contesto operativo corrente">
              <View style={styles.companyRow}>
                <View style={styles.logoWrap}>
                  {activeCompany?.logoUrl ? (
                    <Image source={{ uri: activeCompany.logoUrl }} style={styles.logo} />
                  ) : (
                    <Text style={styles.logoFallback}>{logoLabel}</Text>
                  )}
                </View>
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{activeCompany?.name ?? 'Nessuna autoscuola'}</Text>
                  <Text style={styles.companyMeta}>ID: {activeCompany?.id ?? '-'}</Text>
                </View>
              </View>
              {autoscuolaRole === 'STUDENT' ? (
                <View style={styles.studentAvailabilityBlock}>
                  <View style={styles.studentAvailabilityDivider} />
                  <Text style={styles.fieldLabel}>Disponibilità guida</Text>
                  {!studentProfile ? (
                    <Text style={styles.inlineHint}>
                      Profilo allievo non collegato alla company attiva.
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.inlineHint}>
                        Ripetizione attiva: {Number(availabilityWeeks) || 4} settimane.
                      </Text>
                      <View style={styles.chipRow}>
                        {dayLabels.map((label, index) => (
                          <SelectableChip
                            key={label}
                            label={label}
                            active={availabilityDays.includes(index)}
                            onPress={() => toggleAvailabilityDay(index)}
                          />
                        ))}
                      </View>
                      <View style={styles.pickerRow}>
                        <PickerField
                          label="Inizio"
                          value={availabilityStart}
                          mode="time"
                          onChange={setAvailabilityStart}
                        />
                        <PickerField
                          label="Fine"
                          value={availabilityEnd}
                          mode="time"
                          onChange={setAvailabilityEnd}
                        />
                      </View>
                      <GlassButton
                        label={availabilitySaving ? 'Salvataggio...' : 'Salva disponibilità'}
                        onPress={handleSaveStudentAvailability}
                        disabled={availabilitySaving}
                        tone="primary"
                        fullWidth
                      />
                    </>
                  )}
                </View>
              ) : null}
            </GlassCard>

            {autoscuolaRole === 'STUDENT' ? (
              <>
                <GlassCard title="Pagamenti" subtitle="Metodo predefinito per addebiti automatici">
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        paymentProfile?.hasPaymentMethod ? styles.statusDotOk : styles.statusDotNeutral,
                      ]}
                    />
                    <Text style={styles.statusText}>{paymentStatusText}</Text>
                  </View>

                  {paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod ? (
                    <View style={styles.paymentMethodRow}>
                      <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.paymentMethodText}>
                        {paymentProfile.paymentMethod.brand.toUpperCase()} ••••{paymentProfile.paymentMethod.last4}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.inlineHint}>Aggiungi una carta per prenotare e pagare senza attriti.</Text>
                  )}

                  {paymentProfile?.blockedByInsoluti ? (
                    <Text style={styles.warningText}>Hai pagamenti insoluti. Salda dalla Home.</Text>
                  ) : null}

                  <GlassButton
                    label={
                      paymentLoading
                        ? 'Attendi...'
                        : paymentProfile?.hasPaymentMethod
                          ? 'Aggiorna metodo'
                          : 'Aggiungi metodo'
                    }
                    onPress={handleConfigurePaymentMethod}
                    disabled={paymentLoading}
                    tone={paymentProfile?.hasPaymentMethod ? 'standard' : 'primary'}
                    fullWidth
                  />
                </GlassCard>
              </>
            ) : null}

            {autoscuolaRole === 'OWNER' ? (
              <GlassCard title="Agenda e notifiche" subtitle="Preferenze globali della tua autoscuola">
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Settimane prenotabili</Text>
                  <GlassInput
                    placeholder="Settimane disponibilita (1-12)"
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
                  <Text style={styles.inlineHint}>Range consentito: da 1 a 12 settimane.</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Promemoria allievo</Text>
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

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Promemoria istruttore</Text>
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

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Prenotazioni da app</Text>
                  <Text style={styles.inlineHint}>
                    Attori abilitati: {bookingActorLabelMap[appBookingActors]}.
                  </Text>
                  {(appBookingActors === 'instructors' || appBookingActors === 'both') ? (
                    <Text style={styles.inlineHint}>
                      Modalità istruttore: {instructorModeLabelMap[instructorBookingMode]}.
                    </Text>
                  ) : (
                    <Text style={styles.inlineHint}>
                      Configurazione istruttore non necessaria con policy attuale.
                    </Text>
                  )}
                  <Text style={styles.inlineHint}>Configura i dettagli da Reglo Web &gt; Autoscuole &gt; Disponibilità.</Text>
                </View>

                <GlassButton
                  label={savingSettings ? 'Salvataggio...' : 'Salva impostazioni'}
                  onPress={handleSaveOwnerSettings}
                  disabled={savingSettings}
                  tone="primary"
                  fullWidth
                />
              </GlassCard>
            ) : null}

            {autoscuolaRole === 'INSTRUCTOR' ? (
              <GlassCard title="Operativita istruttore" subtitle="Preferenze e accesso rapido">
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, styles.statusDotOk]} />
                  <Text style={styles.statusText}>
                    Promemoria guide: {toReminderLabel(Number(instructorReminderMinutes))}
                  </Text>
                </View>
                <Text style={styles.inlineHint}>
                  Il promemoria viene applicato prima della guida in base alle impostazioni della tua autoscuola.
                </Text>
                <Text style={styles.inlineHint}>
                  Prenotazioni da app: {bookingActorLabelMap[appBookingActors]}.
                </Text>
                {(appBookingActors === 'instructors' || appBookingActors === 'both') ? (
                  <Text style={styles.inlineHint}>
                    Modalità corrente: {instructorModeLabelMap[instructorBookingMode]}.
                  </Text>
                ) : null}
                <Text style={styles.inlineHint}>Questa policy è configurata dal titolare in web app.</Text>
                <GlassButton
                  label="Apri gestione disponibilita"
                  onPress={handleOpenInstructorManage}
                  tone="primary"
                  fullWidth
                />
              </GlassCard>
            ) : null}

            <GlassCard title="Sessione" subtitle="Gestione account su questo dispositivo">
              <Text style={styles.inlineHint}>Esci in modo sicuro e torna alla schermata di accesso.</Text>
              <GlassButton label="Logout" onPress={handleSignOut} tone="danger" fullWidth />
            </GlassCard>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerBlock: {
    gap: spacing.xs,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(50, 77, 122, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.18)',
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
    borderColor: 'rgba(226, 109, 109, 0.36)',
    backgroundColor: 'rgba(226, 109, 109, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
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
    backgroundColor: 'rgba(50, 77, 122, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.2)',
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
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: 'rgba(50, 77, 122, 0.12)',
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
    backgroundColor: colors.success,
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
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
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
    color: colors.warning,
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
    backgroundColor: '#F7FAFF',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
});
