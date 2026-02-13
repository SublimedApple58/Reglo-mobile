import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { SelectableChip } from '../components/SelectableChip';
import { SectionHeader } from '../components/SectionHeader';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import {
  AutoscuolaAppointmentWithRelations,
  MobileStudentPaymentProfile,
  AutoscuolaStudent,
  AutoscuolaSettings,
  AutoscuolaWaitlistOfferWithSlot,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const upcomingConfirmedStatuses = new Set(['scheduled', 'confirmed', 'checked_in']);
const proposalStatuses = new Set(['proposal']);
const historyPageSize = 10;

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};
const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

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

const statusLabel = (status: string) => {
  if (status === 'completed') return { label: 'Completata', tone: 'success' as const };
  if (status === 'no_show') return { label: 'No-show', tone: 'danger' as const };
  if (status === 'cancelled') return { label: 'Annullata', tone: 'warning' as const };
  if (status === 'proposal') return { label: 'Proposta', tone: 'default' as const };
  return { label: 'Programmato', tone: 'default' as const };
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
  const isTimeField = mode === 'time';

  return (
    <View style={isTimeField ? styles.timePickerFieldWrap : undefined}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          isTimeField && styles.timePickerField,
          pressed && isTimeField && styles.timePickerFieldPressed,
        ]}
      >
        <View pointerEvents="none">
          <GlassInput
            editable={false}
            placeholder={label}
            value={mode === 'date' ? formatDay(value.toISOString()) : toTimeString(value)}
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



export const AllievoHomeScreen = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useSession();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState(buildTime(9, 0));
  const [availabilityEnd, setAvailabilityEnd] = useState(buildTime(18, 0));
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const [preferredDate, setPreferredDate] = useState(new Date());
  const [preferredStart, setPreferredStart] = useState(buildTime(9, 0));
  const [preferredEnd, setPreferredEnd] = useState(buildTime(18, 0));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [suggestion, setSuggestion] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const [paymentProfile, setPaymentProfile] = useState<MobileStudentPaymentProfile | null>(null);
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pendingSuggestionOpen, setPendingSuggestionOpen] = useState(false);
  const [waitlistOffer, setWaitlistOffer] = useState<AutoscuolaWaitlistOfferWithSlot | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [proposalAppointmentOpen, setProposalAppointmentOpen] = useState(false);
  const [proposalAppointmentLoading, setProposalAppointmentLoading] = useState(false);
  const [historyVisibleCount, setHistoryVisibleCount] = useState(historyPageSize);

  const openPreferences = () => {
    setPrefsOpen(true);
  };

  const selectedStudent = useMemo(
    () => findLinkedStudent(students, user),
    [students, user]
  );
  const selectedStudentId = selectedStudent?.id ?? null;

  const loadStudents = useCallback(async () => {
    const list = await regloApi.getStudents();
    setStudents(list);
    setStudentsLoaded(true);
    return list;
  }, []);

  const loadData = useCallback(
    async (studentId: string) => {
      setLoading(true);
      setToast(null);
      try {
        const [appointmentsResponse, settingsResponse, paymentResponse] = await Promise.all([
          regloApi.getAppointments(),
          regloApi.getAutoscuolaSettings(),
          regloApi.getPaymentProfile(),
        ]);
        setAppointments(appointmentsResponse.filter((item) => item.studentId === studentId));
        setSettings(settingsResponse);
        setPaymentProfile(paymentResponse);
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore nel caricamento',
          tone: 'danger',
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadWaitlistOffers = useCallback(async (studentId: string) => {
    try {
      const offers = await regloApi.getWaitlistOffers(studentId, 1);
      setWaitlistOffer(offers[0] ?? null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore caricando le proposte disponibili',
        tone: 'danger',
      });
    }
  }, []);

  const loadAvailabilityPreset = useCallback(
    async (studentId: string) => {
      try {
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
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore caricando disponibilita',
          tone: 'danger',
        });
      }
    },
    []
  );

  useEffect(() => {
    const init = async () => {
      try {
        await loadStudents();
      } catch (err) {
        setToast({
          text: err instanceof Error ? err.message : 'Errore nel caricamento studenti',
          tone: 'danger',
        });
      }
    };
    init();
  }, [loadStudents]);

  useEffect(() => {
    if (!selectedStudentId) {
      setWaitlistOffer(null);
      setWaitlistOpen(false);
      return;
    }
    loadData(selectedStudentId);
    loadAvailabilityPreset(selectedStudentId);
    loadWaitlistOffers(selectedStudentId);
  }, [loadAvailabilityPreset, loadData, loadWaitlistOffers, selectedStudentId]);

  useEffect(() => {
    if (!waitlistOffer) {
      setWaitlistOpen(false);
      return;
    }
    if (!prefsOpen && !sheetOpen) {
      setWaitlistOpen(true);
    }
  }, [prefsOpen, sheetOpen, waitlistOffer]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const unsubscribe = subscribePushIntent((intent) => {
      if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(selectedStudentId);
        return;
      }
      if (intent === 'appointment_proposal') {
        setProposalAppointmentOpen(true);
        loadData(selectedStudentId);
      }
    });
    return unsubscribe;
  }, [loadData, loadWaitlistOffers, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      loadData(selectedStudentId);
      loadWaitlistOffers(selectedStudentId);
    });
    return () => {
      subscription.remove();
    };
  }, [loadData, loadWaitlistOffers, selectedStudentId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => {
        const status = (item.status ?? '').trim().toLowerCase();
        return upcomingConfirmedStatuses.has(status) && new Date(item.startsAt) >= now;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments]);

  const history = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => new Date(item.startsAt) < now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [appointments]);
  const visibleHistory = useMemo(
    () => history.slice(0, historyVisibleCount),
    [history, historyVisibleCount]
  );
  const hasMoreHistory = visibleHistory.length < history.length;

  useEffect(() => {
    setHistoryVisibleCount(historyPageSize);
  }, [selectedStudentId]);

  const nextLesson = upcoming[0];
  const pendingProposal = useMemo(() => {
    const now = new Date();
    return [...appointments]
      .filter((item) => {
        const status = (item.status ?? '').trim().toLowerCase();
        return proposalStatuses.has(status) && new Date(item.startsAt) >= now;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;
  }, [appointments]);

  useEffect(() => {
    if (!pendingProposal) {
      setProposalAppointmentOpen(false);
      return;
    }
    if (!prefsOpen && !sheetOpen && !waitlistOpen) {
      setProposalAppointmentOpen(true);
    }
  }, [pendingProposal, prefsOpen, sheetOpen, waitlistOpen]);

  const toggleDay = (day: number) => {
    setAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  const handleCreateAvailability = async () => {
    if (!selectedStudentId) return;
    if (!availabilityDays.length) {
      setToast({ text: 'Seleziona almeno un giorno', tone: 'danger' });
      return;
    }
    if (availabilityEnd <= availabilityStart) {
      setToast({ text: 'Orario non valido', tone: 'danger' });
      return;
    }
    setToast(null);
    setAvailabilitySaving(true);
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
          ownerId: selectedStudentId,
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
        ownerType: 'student',
        ownerId: selectedStudentId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: availabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });
      setToast({ text: 'Disponibilita salvata', tone: 'success' });
      await loadAvailabilityPreset(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando disponibilita',
        tone: 'danger',
      });
    } finally {
      setAvailabilitySaving(false);
    }
  };


  const handleBookingRequest = async () => {
    if (!selectedStudentId) return;
    if (paymentProfile?.autoPaymentsEnabled && !paymentProfile?.hasPaymentMethod) {
      setToast({
        text: 'Aggiungi un metodo di pagamento dalle impostazioni prima di prenotare.',
        tone: 'info',
      });
      return;
    }
    if (paymentProfile?.blockedByInsoluti) {
      setToast({
        text: 'Hai pagamenti insoluti. Salda prima di prenotare una nuova guida.',
        tone: 'danger',
      });
      return;
    }
    setToast(null);
    setSuggestion(null);
    setBookingLoading(true);
    if (preferredEnd <= preferredStart) {
      setToast({ text: 'Orario non valido', tone: 'danger' });
      setBookingLoading(false);
      return;
    }
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        preferredStartTime: toTimeString(preferredStart),
        preferredEndTime: toTimeString(preferredEnd),
        maxDays: 4,
        requestId: bookingRequestId ?? undefined,
      });

      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        setPrefsOpen(false);
        await loadData(selectedStudentId);
        return;
      }

      if (response.suggestion) {
        setSuggestion(response.suggestion);
        setBookingRequestId(response.request.id);
        if (prefsOpen) {
          setPendingSuggestionOpen(true);
          setPrefsOpen(false);
        } else {
          setSheetOpen(true);
        }
        return;
      }

      setToast({ text: 'Nessuna disponibilita per il giorno scelto', tone: 'info' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella richiesta',
        tone: 'danger',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!selectedStudentId || !suggestion) return;
    setToast(null);
    setProposalLoading(true);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        selectedStartsAt: suggestion.startsAt,
        requestId: bookingRequestId ?? undefined,
      });
      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        setSuggestion(null);
        setBookingRequestId(null);
        setSheetOpen(false);
        setPrefsOpen(false);
        await loadData(selectedStudentId);
        return;
      }
      setToast({ text: 'Slot non disponibile', tone: 'danger' });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore prenotando slot',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleRejectSuggestion = () => {
    if (proposalLoading) return;
    setSheetOpen(false);
    setSuggestion(null);
    setBookingRequestId(null);
  };

  const handleAcceptAppointmentProposal = async () => {
    if (!pendingProposal || !selectedStudentId) return;
    setProposalAppointmentLoading(true);
    setToast(null);
    try {
      await regloApi.updateAppointmentStatus(pendingProposal.id, { status: 'scheduled' });
      setToast({ text: 'Proposta accettata', tone: 'success' });
      setProposalAppointmentOpen(false);
      await loadData(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione proposta',
        tone: 'danger',
      });
    } finally {
      setProposalAppointmentLoading(false);
    }
  };

  const handleDeclineAppointmentProposal = async () => {
    if (!pendingProposal || !selectedStudentId || proposalAppointmentLoading) return;
    setProposalAppointmentLoading(true);
    setToast(null);
    try {
      await regloApi.cancelAppointment(pendingProposal.id);
      setToast({ text: 'Proposta rifiutata', tone: 'info' });
      setProposalAppointmentOpen(false);
      await loadData(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto proposta',
        tone: 'danger',
      });
    } finally {
      setProposalAppointmentLoading(false);
    }
  };

  const handleClosePreferences = () => {
    setPrefsOpen(false);
  };

  const handleAlternativeSuggestion = async () => {
    if (!selectedStudentId || !suggestion) return;
    setProposalLoading(true);
    try {
      const response = await regloApi.createBookingRequest({
        studentId: selectedStudentId,
        preferredDate: toDateString(preferredDate),
        durationMinutes,
        preferredStartTime: toTimeString(preferredStart),
        preferredEndTime: toTimeString(preferredEnd),
        maxDays: 4,
        excludeStartsAt: suggestion.startsAt,
        requestId: bookingRequestId ?? undefined,
      });
      if (!response.matched && response.suggestion) {
        setSuggestion(response.suggestion);
        setBookingRequestId(response.request.id);
        return;
      }
      setToast({ text: 'Nessuna alternativa disponibile', tone: 'info' });
      setSheetOpen(false);
      setSuggestion(null);
      setBookingRequestId(null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella ricerca alternativa',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleAcceptWaitlistOffer = async () => {
    if (!selectedStudentId || !waitlistOffer) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      const response = await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId: selectedStudentId,
        response: 'accept',
      });
      if (response.accepted) {
        setToast({ text: 'Slot accettato e guida prenotata', tone: 'success' });
        setWaitlistOpen(false);
        await loadData(selectedStudentId);
      } else {
        setToast({ text: 'Slot non più disponibile', tone: 'info' });
      }
      await loadWaitlistOffers(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleDeclineWaitlistOffer = async () => {
    if (!selectedStudentId || !waitlistOffer || waitlistLoading) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId: selectedStudentId,
        response: 'decline',
      });
      setToast({ text: 'Offerta rifiutata', tone: 'info' });
      setWaitlistOpen(false);
      await loadWaitlistOffers(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };


  const handleCancel = async (appointmentId: string) => {
    setToast(null);
    setCancellingAppointmentId(appointmentId);
    try {
      await regloApi.cancelAppointment(appointmentId);
      setToast({ text: 'Guida annullata', tone: 'success' });
      if (selectedStudentId) {
        await Promise.all([loadData(selectedStudentId), loadWaitlistOffers(selectedStudentId)]);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante annullamento',
        tone: 'danger',
      });
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const handlePayNow = async () => {
    if (!selectedStudentId || !paymentProfile?.outstanding.length) return;
    const outstanding = paymentProfile.outstanding[0];
    setPayNowLoading(true);
    setToast(null);
    try {
      const setup = await regloApi.preparePayNow(outstanding.appointmentId);
      const init = await initPaymentSheet({
        merchantDisplayName: 'Reglo Autoscuole',
        customerId: setup.customerId,
        customerEphemeralKeySecret: setup.ephemeralKey,
        paymentIntentClientSecret: setup.paymentIntentClientSecret,
        applePay: { merchantCountryCode: 'IT' },
        googlePay: { merchantCountryCode: 'IT', testEnv: true },
      });

      if (init.error) {
        throw new Error(init.error.message);
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        throw new Error(result.error.message);
      }

      const finalized = await regloApi.finalizePayNow(
        outstanding.appointmentId,
        setup.paymentIntentId
      );

      if (!finalized.success) {
        throw new Error(finalized.message ?? 'Pagamento in elaborazione.');
      }

      setToast({ text: 'Pagamento completato', tone: 'success' });
      await loadData(selectedStudentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante pagamento',
        tone: 'danger',
      });
    } finally {
      setPayNowLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setToast(null);
    try {
      const list = await loadStudents();
      const linkedStudent = findLinkedStudent(list, user);
      if (linkedStudent?.id) {
        await Promise.all([
          loadData(linkedStudent.id),
          loadAvailabilityPreset(linkedStudent.id),
          loadWaitlistOffers(linkedStudent.id),
        ]);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel refresh',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadAvailabilityPreset, loadData, loadStudents, loadWaitlistOffers, user]);

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
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, {selectedStudent?.firstName ?? 'Allievo'}</Text>
            <Text style={styles.subtitle}>
              {selectedStudent
                ? 'Gestisci le tue guide'
                : studentsLoaded
                  ? 'Profilo allievo non collegato'
                  : 'Caricamento profilo...'}
            </Text>
          </View>
          <GlassBadge label="Allievo" />
        </View>

        {!selectedStudent ? (
          <GlassCard
            title={studentsLoaded ? 'Profilo non associato' : 'Caricamento profilo'}
            subtitle={
              studentsLoaded
                ? 'Questo account STUDENT non e collegato a un allievo della company.'
                : 'Recupero dati allievo in corso.'
            }
          >
            {studentsLoaded ? (
              <Text style={styles.empty}>Contatta il titolare per collegare il tuo profilo.</Text>
            ) : null}
          </GlassCard>
        ) : (
          <>
            <GlassCard title="Prossima guida" subtitle={loading ? 'Aggiornamento...' : 'Prenotazione confermata'}>
              {nextLesson ? (
                <View style={styles.lessonRow}>
                  <View>
                    <Text style={styles.lessonTime}>
                      {formatDay(nextLesson.startsAt)} · {formatTime(nextLesson.startsAt)}
                    </Text>
                    <Text style={styles.lessonMeta}>
                      Istruttore: {nextLesson.instructor?.name ?? 'Da assegnare'}
                    </Text>
                    <Text style={styles.lessonMeta}>
                      Veicolo: {nextLesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                  </View>
                  <GlassButton
                    label={cancellingAppointmentId === nextLesson.id ? 'Annullamento...' : 'Annulla'}
                    onPress={() => handleCancel(nextLesson.id)}
                    disabled={cancellingAppointmentId === nextLesson.id}
                  />
                </View>
              ) : (
                <Text style={styles.empty}>Nessuna guida programmata.</Text>
              )}
            </GlassCard>

            <SectionHeader title="Disponibilita" action={`Ripeti ${settings?.availabilityWeeks ?? 4} sett.`} />
            <GlassCard>
              <View style={styles.dayRow}>
                {dayLabels.map((label, index) => (
                  <SelectableChip
                    key={label}
                    label={label}
                    active={availabilityDays.includes(index)}
                    onPress={() => toggleDay(index)}
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
              <View style={styles.actionRow}>
                <GlassButton
                  label={availabilitySaving ? 'Salvataggio...' : 'Salva'}
                  tone="primary"
                  onPress={handleCreateAvailability}
                  disabled={availabilitySaving}
                  fullWidth
                />
              </View>
            </GlassCard>

            <SectionHeader title="Prenota una guida" action="Preferenze" />
            <GlassCard>
              {paymentProfile?.blockedByInsoluti ? (
                <View style={styles.outstandingBlock}>
                  <Text style={styles.outstandingTitle}>Pagamento in sospeso</Text>
                  <Text style={styles.outstandingText}>
                    Hai importi da saldare prima di poter prenotare nuove guide.
                  </Text>
                  <Text style={styles.outstandingText}>
                    Da saldare: € {paymentProfile.outstanding[0]?.amountDue.toFixed(2) ?? '0.00'}
                  </Text>
                  <GlassButton
                    label={payNowLoading ? 'Attendi...' : 'Salda ora'}
                    tone="primary"
                    onPress={handlePayNow}
                    disabled={payNowLoading}
                  />
                </View>
              ) : null}
              {paymentProfile?.autoPaymentsEnabled && !paymentProfile?.hasPaymentMethod ? (
                <View style={styles.outstandingBlock}>
                  <Text style={styles.outstandingTitle}>Metodo di pagamento richiesto</Text>
                  <Text style={styles.outstandingText}>
                    Questa autoscuola richiede un metodo di pagamento valido per prenotare.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.bookingHint}>
                Imposta le tue preferenze e richiedi una guida.
              </Text>
              <GlassButton
                label="Apri preferenze"
                onPress={openPreferences}
                disabled={Boolean(
                  paymentProfile?.blockedByInsoluti ||
                    (paymentProfile?.autoPaymentsEnabled && !paymentProfile?.hasPaymentMethod)
                )}
              />
            </GlassCard>

            <SectionHeader title="Storico" action="Ultime guide" />
            <GlassCard>
              <View style={styles.historyList}>
                {visibleHistory.map((lesson) => {
                  const status = statusLabel(lesson.status);
                  return (
                    <View key={lesson.id} style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyTime}>
                          {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                        </Text>
                        <Text style={styles.lessonMeta}>{lesson.instructor?.name ?? 'Istruttore'}</Text>
                      </View>
                      <GlassBadge label={status.label} tone={status.tone} />
                    </View>
                  );
                })}
                {!history.length ? <Text style={styles.empty}>Nessuna guida passata.</Text> : null}
                {hasMoreHistory ? (
                  <View style={styles.historyMore}>
                    <GlassButton
                      label="Carica altre"
                      onPress={() =>
                        setHistoryVisibleCount((prev) => Math.min(prev + historyPageSize, history.length))
                      }
                    />
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
      <BottomSheet
        visible={proposalAppointmentOpen && !!pendingProposal}
        title="Nuova proposta guida"
        onClose={() => {
          if (!proposalAppointmentLoading) setProposalAppointmentOpen(false);
        }}
        closeDisabled={proposalAppointmentLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalAppointmentLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={proposalAppointmentLoading ? undefined : handleAcceptAppointmentProposal}
                disabled={proposalAppointmentLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalAppointmentLoading ? 'Attendi...' : 'Rifiuta'}
                tone="danger"
                onPress={proposalAppointmentLoading ? undefined : handleDeclineAppointmentProposal}
                disabled={proposalAppointmentLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {pendingProposal ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(pendingProposal.startsAt)} · {formatTime(pendingProposal.startsAt)}
            </Text>
            <Text style={styles.sheetMeta}>
              Durata:{' '}
              {Math.max(
                30,
                Math.round(
                  ((pendingProposal.endsAt
                    ? new Date(pendingProposal.endsAt).getTime()
                    : new Date(pendingProposal.startsAt).getTime() + 30 * 60 * 1000) -
                    new Date(pendingProposal.startsAt).getTime()) /
                    60000
                )
              )}{' '}
              min
            </Text>
            <Text style={styles.sheetMeta}>
              Istruttore: {pendingProposal.instructor?.name ?? 'Da assegnare'}
            </Text>
            <Text style={styles.sheetMeta}>
              Veicolo: {pendingProposal.vehicle?.name ?? 'Da assegnare'}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={waitlistOpen && !!waitlistOffer}
        title="Slot liberato"
        onClose={waitlistLoading ? () => {} : handleDeclineWaitlistOffer}
        closeDisabled={waitlistLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={waitlistLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={waitlistLoading ? undefined : handleAcceptWaitlistOffer}
                disabled={waitlistLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={waitlistLoading ? 'Attendi...' : 'Rifiuta'}
                tone="danger"
                onPress={waitlistLoading ? undefined : handleDeclineWaitlistOffer}
                disabled={waitlistLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {waitlistOffer ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(waitlistOffer.slot.startsAt)} · {formatTime(waitlistOffer.slot.startsAt)}
            </Text>
            <Text style={styles.sheetMeta}>Durata: 30 min</Text>
            <Text style={styles.sheetMeta}>
              Conferma entro: {formatTime(waitlistOffer.expiresAt)}
            </Text>
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={prefsOpen}
        title="Preferenze guida"
        onClose={handleClosePreferences}
        onClosed={() => {
          if (pendingSuggestionOpen) {
            setSheetOpen(true);
            setPendingSuggestionOpen(false);
          }
        }}
        closeDisabled={bookingLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={bookingLoading ? 'Attendi...' : 'Prenota'}
                tone="primary"
                onPress={bookingLoading ? undefined : handleBookingRequest}
                disabled={bookingLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        <View style={styles.sheetContent}>
          <View style={styles.pickerRow}>
            <PickerField
              label="Giorno"
              value={preferredDate}
              mode="date"
              onChange={setPreferredDate}
            />
            <View style={styles.durationWrap}>
              <Pressable
                style={[styles.durationChip, durationMinutes === 30 && styles.durationChipActive]}
                onPress={() => setDurationMinutes(30)}
              >
                <Text
                  style={durationMinutes === 30 ? styles.durationTextActive : styles.durationText}
                >
                  30m
                </Text>
              </Pressable>
              <Pressable
                style={[styles.durationChip, durationMinutes === 60 && styles.durationChipActive]}
                onPress={() => setDurationMinutes(60)}
              >
                <Text
                  style={durationMinutes === 60 ? styles.durationTextActive : styles.durationText}
                >
                  60m
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.pickerRow}>
            <PickerField
              label="Dalle"
              value={preferredStart}
              mode="time"
              onChange={setPreferredStart}
            />
            <PickerField
              label="Alle"
              value={preferredEnd}
              mode="time"
              onChange={setPreferredEnd}
            />
          </View>
        </View>
      </BottomSheet>
      <BottomSheet
        visible={sheetOpen}
        title="Proposta di guida"
        onClose={handleRejectSuggestion}
        closeDisabled={proposalLoading}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalLoading ? 'Attendi...' : 'Accetta'}
                tone="primary"
                onPress={proposalLoading ? undefined : handleAcceptSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label={proposalLoading ? 'Attendi...' : 'Proponimi altro'}
                onPress={proposalLoading ? undefined : handleAlternativeSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
                label="Rifiuta"
                tone="danger"
                onPress={proposalLoading ? undefined : handleRejectSuggestion}
                disabled={proposalLoading}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {suggestion ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>
              {formatDay(suggestion.startsAt)} · {formatTime(suggestion.startsAt)}
            </Text>
            <Text style={styles.sheetMeta}>Durata: {durationMinutes} min</Text>
            <Text style={styles.sheetMeta}>Istruttore: da assegnare</Text>
            <Text style={styles.sheetMeta}>Veicolo: da assegnare</Text>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  lessonTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  lessonMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  historyList: {
    gap: spacing.md,
  },
  historyMore: {
    marginTop: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  durationChip: {
    minWidth: 62,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(50, 77, 122, 0.35)',
    backgroundColor: 'rgba(239, 244, 252, 0.9)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  durationChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
    shadowColor: colors.navy,
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  durationText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  durationTextActive: {
    ...typography.body,
    color: '#FFFFFF',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  suggestionBox: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bookingHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  outstandingBlock: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  outstandingTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  outstandingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sheetContent: {
    gap: spacing.xs,
  },
  sheetText: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  sheetMeta: {
    ...typography.body,
    color: colors.textSecondary,
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
  empty: {
    ...typography.body,
    color: colors.textMuted,
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
  timePickerFieldWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.34)',
    backgroundColor: 'rgba(238, 244, 252, 0.92)',
    padding: 3,
    shadowColor: 'rgba(50, 77, 122, 0.4)',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  timePickerField: {
    borderRadius: 16,
  },
  timePickerFieldPressed: {
    opacity: 0.9,
  },
});
