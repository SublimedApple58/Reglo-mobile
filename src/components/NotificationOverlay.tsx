import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { BookingCelebration } from './BookingCelebration';
import { ToastNotice, ToastTone } from './ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent, consumePendingOrLaunchPushIntent } from '../services/pushNotifications';
import { notificationEvents } from '../services/notificationEvents';
import {
  loadInbox,
  saveInbox,
  mergeFromApi,
  migrateLegacyKeys,
  setInboxUserId,
} from '../services/notificationStore';
import {
  AutoscuolaSwapOfferWithDetails,
  AutoscuolaWaitlistOfferWithSlot,
  AutoscuolaAppointmentWithRelations,
  AutoscuolaStudent,
  AvailableSlot,
} from '../types/regloApi';
import { NotificationItem, ConfirmationData, AvailableSlotsData, PersistedNotification } from '../types/notifications';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const lessonTypeLabelMap: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
  altro: 'Altro',
  guida: 'Guida',
  esame: 'Esame',
};

const normalize = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null,
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);
  const byEmail = students.find((s) => normalize(s.email) === normalizedEmail);
  if (byEmail) return byEmail;
  if (!normalizedName) return null;
  const byName = students.find(
    (s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === normalizedName,
  );
  return byName ?? null;
};

type Props = {
  isStudent: boolean;
  isInstructor?: boolean;
  swapEnabled: boolean;
};

export const NotificationOverlay = ({ isStudent, isInstructor = false, swapEnabled }: Props) => {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // ── Persistent inbox ──
  const [inboxItems, setInboxItems] = useState<PersistedNotification[]>([]);
  const inboxRef = useRef<PersistedNotification[]>([]);
  const inboxLoaded = useRef(false);

  // ── Students ──
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const selectedStudent = useMemo(() => findLinkedStudent(students, user), [students, user]);
  const studentId = selectedStudent?.id ?? null;

  // ── Swap offers (all incoming) ──
  const [swapOffers, setSwapOffers] = useState<AutoscuolaSwapOfferWithDetails[]>([]);
  const [swapOffer, setSwapOffer] = useState<AutoscuolaSwapOfferWithDetails | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const ignoredIds = useRef(new Set<string>());
  const ignoredLoaded = useRef(false);

  // ── Swap accepted confirmations (all) ──
  const [confirmations, setConfirmations] = useState<ConfirmationData[]>([]);
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  // ── Waitlist (all) ──
  const [waitlistOffers, setWaitlistOffers] = useState<AutoscuolaWaitlistOfferWithSlot[]>([]);
  const [waitlistOffer, setWaitlistOffer] = useState<AutoscuolaWaitlistOfferWithSlot | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // ── Proposals (all) ──
  const [proposals, setProposals] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [pendingProposal, setPendingProposal] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const dismissedProposalId = useRef<string | null>(null);

  // ── Available slots (from push notification) ──
  const [availableSlotsDate, setAvailableSlotsDate] = useState<string | null>(null);
  const [availableSlotsList, setAvailableSlotsList] = useState<AvailableSlot[]>([]);
  const [availableSlotsOpen, setAvailableSlotsOpen] = useState(false);
  const [availableSlotsSelected, setAvailableSlotsSelected] = useState<AvailableSlot | null>(null);
  const [availableSlotsBooking, setAvailableSlotsBooking] = useState(false);
  const [availableSlotsDurations, setAvailableSlotsDurations] = useState<number[]>([60]);
  const [availableSlotsDuration, setAvailableSlotsDuration] = useState(60);
  const [availableSlotsLoading, setAvailableSlotsLoading] = useState(false);

  // ── UI ──
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationVariant, setCelebrationVariant] = useState<'booking' | 'swap'>('booking');

  // ── Bubble animation ──
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleTranslateX = useRef(new Animated.Value(30)).current;
  const bubbleShownForCount = useRef(0);
  const bubbleDismissed = useRef(false);

  // ── Auto-open tracking ──
  const autoOpenedIds = useRef(new Set<string>());

  // ── Accepted / expired tracking ──
  const acceptedIds = useRef(new Set<string>());
  const acceptedLoaded = useRef(false);
  const [staleDrawerKind, setStaleDrawerKind] = useState<'accepted' | 'expired' | null>(null);

  // ── Student scheduled appointments (for overlap check) ──
  const [scheduledAppointments, setScheduledAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [busySlotLabel, setBusySlotLabel] = useState<string | null>(null);

  // ── Keep ref in sync with state ──
  useEffect(() => {
    inboxRef.current = inboxItems;
  }, [inboxItems]);

  // ── Derived: unread count from persistent inbox ──
  const unreadCount = useMemo(
    () => inboxItems.filter((n) => !n.read && !n.dismissed).length,
    [inboxItems],
  );

  // ── Build NotificationItem[] from current API state (for merge into store) ──
  const buildApiItems = useCallback((): NotificationItem[] => {
    const items: NotificationItem[] = [];
    for (const c of confirmations) {
      items.push({ kind: 'confirmation', id: c.id, data: c });
    }
    for (const s of swapOffers) {
      if (!ignoredIds.current.has(s.id)) {
        items.push({ kind: 'swap', id: s.id, data: s });
      }
    }
    for (const w of waitlistOffers) {
      items.push({ kind: 'waitlist', id: w.id, data: w });
    }
    for (const p of proposals) {
      items.push({ kind: 'proposal', id: p.id, data: p });
    }
    return items;
  }, [confirmations, swapOffers, waitlistOffers, proposals]);

  // ── Persist: merge API items into store whenever they change ──
  const isMerging = useRef(false);
  useEffect(() => {
    if (!inboxLoaded.current) return;
    isMerging.current = true;
    const apiItems = buildApiItems();
    // Use ref to get latest inbox state (not stale closure)
    const merged = mergeFromApi(inboxRef.current, apiItems);
    inboxRef.current = merged;
    setInboxItems(merged);
    saveInbox(merged).then(() => {
      isMerging.current = false;
      notificationEvents.emitInboxUpdated();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmations, swapOffers, waitlistOffers, proposals]);

  // ── Reload inbox when inbox screen marks items as read/dismissed ──
  useEffect(() => {
    return notificationEvents.onInboxUpdated(() => {
      // Skip if we just emitted this event ourselves
      if (isMerging.current) return;
      loadInbox().then((items) => {
        inboxRef.current = items;
        setInboxItems(items);
      });
    });
  }, []);

  // ── SecureStore: load ignored swap IDs ──
  useEffect(() => {
    SecureStore.getItemAsync('reglo_ignored_swap_ids')
      .then((raw) => {
        if (raw) {
          try {
            const ids = JSON.parse(raw) as string[];
            for (const id of ids) ignoredIds.current.add(id);
          } catch {}
        }
        ignoredLoaded.current = true;
      })
      .catch(() => {
        ignoredLoaded.current = true;
      });
  }, []);

  // ── SecureStore: load accepted notification IDs ──
  useEffect(() => {
    SecureStore.getItemAsync('reglo_accepted_notification_ids')
      .then((raw) => {
        if (raw) {
          try {
            const ids = JSON.parse(raw) as string[];
            for (const id of ids) acceptedIds.current.add(id);
          } catch {}
        }
        acceptedLoaded.current = true;
      })
      .catch(() => {
        acceptedLoaded.current = true;
      });
  }, []);

  // ── Scope inbox per user ──
  useEffect(() => {
    setInboxUserId(user?.id ?? null);
  }, [user?.id]);

  // ── Sync server-side notifications into local inbox ──
  const syncServerNotifications = useCallback(async () => {
    try {
      const serverItems = await regloApi.getNotifications(30);
      if (!serverItems?.length) return;
      const asPersistedItems: PersistedNotification[] = serverItems.map((n) => ({
        kind: n.kind as PersistedNotification['kind'],
        id: n.id,
        data: n.data,
        receivedAt: n.createdAt,
        read: false,
        dismissed: false,
      }));
      const merged = mergeFromApi(inboxRef.current, asPersistedItems);
      inboxRef.current = merged;
      setInboxItems(merged);
      saveInbox(merged);
      notificationEvents.emitInboxUpdated();
    } catch {
      // silent — server unreachable
    }
  }, []);

  // ── Load persistent inbox + migrate legacy keys + sync server ──
  useEffect(() => {
    if (!user?.id) return;
    setInboxUserId(user.id);
    loadInbox()
      .then((items) => migrateLegacyKeys(items))
      .then((items) => {
        inboxRef.current = items;
        setInboxItems(items);
        saveInbox(items);
        inboxLoaded.current = true;
        // After local load, sync from server to catch missed notifications
        syncServerNotifications();
      })
      .catch(() => {
        inboxLoaded.current = true;
      });
  }, [user?.id, syncServerNotifications]);

  // ── Load students ──
  useEffect(() => {
    if (!isStudent) return;
    regloApi.getStudents().then(setStudents).catch(() => {});
  }, [isStudent]);

  // ── Data loaders ──

  const loadSwapOffers = useCallback(async (sid: string) => {
    try {
      const offers = await regloApi.getSwapOffers(sid);
      const filtered = offers.filter((o) => !ignoredIds.current.has(o.id));
      setSwapOffers(filtered);
    } catch {
      // silent
    }
  }, []);

  const checkMyAcceptedSwaps = useCallback(async (sid: string) => {
    try {
      const accepted = await regloApi.getMyAcceptedSwaps(sid);
      const list: ConfirmationData[] = accepted.map((a) => ({
        id: a.id,
        acceptedByName: a.acceptedByName,
        appointmentDate: a.appointmentDate,
        appointmentTime: a.appointmentTime,
        instructorName: a.instructorName,
        vehicleName: a.vehicleName,
        appointmentType: a.appointmentType,
      }));
      setConfirmations(list);
    } catch {
      // silent
    }
  }, []);

  const loadWaitlistOffers = useCallback(async (sid: string) => {
    try {
      const offers = await regloApi.getWaitlistOffers(sid);
      setWaitlistOffers(offers);
    } catch {
      // silent
    }
  }, []);

  const loadProposals = useCallback(async (sid: string) => {
    try {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const appointments = await regloApi.getAppointments({
        studentId: sid,
        from: now.toISOString(),
        to: future.toISOString(),
        limit: 10,
        light: true,
      });
      const filtered = appointments
        .filter((a) => (a.status ?? '').trim().toLowerCase() === 'proposal' && new Date(a.startsAt) >= now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      setProposals(filtered);
    } catch {
      // silent
    }
  }, []);

  const loadScheduled = useCallback(async (sid: string) => {
    try {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const appointments = await regloApi.getAppointments({
        studentId: sid,
        from: now.toISOString(),
        to: future.toISOString(),
        status: 'scheduled',
      });
      setScheduledAppointments(appointments);
    } catch {
      // silent
    }
  }, []);

  const loadAll = useCallback(
    (sid: string) => {
      loadWaitlistOffers(sid);
      loadProposals(sid);
      loadScheduled(sid);
      if (swapEnabled) {
        loadSwapOffers(sid);
        checkMyAcceptedSwaps(sid);
      }
    },
    [swapEnabled, loadSwapOffers, checkMyAcceptedSwaps, loadWaitlistOffers, loadProposals, loadScheduled],
  );

  // ── Initial load ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    const start = () => {
      if (!ignoredLoaded.current) {
        setTimeout(start, 200);
        return;
      }
      loadAll(studentId);
    };
    start();
  }, [loadAll, studentId, isStudent]);

  // ── Swap polling (15s) — only swap needs rapid polling ──
  useEffect(() => {
    if (!studentId || !isStudent || !swapEnabled) return;
    const interval = setInterval(() => {
      loadSwapOffers(studentId);
      checkMyAcceptedSwaps(studentId);
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadSwapOffers, checkMyAcceptedSwaps, studentId, isStudent, swapEnabled]);

  // ── Handlers: Available Slots ──

  const handleAvailableSlotsNotification = useCallback(async (date: string) => {
    if (!studentId) return;
    setAvailableSlotsLoading(true);
    setAvailableSlotsDate(date);
    try {
      const optionsRes = await regloApi.getBookingOptions(studentId);
      const durations = optionsRes.bookingSlotDurations ?? [60];
      setAvailableSlotsDurations(durations);
      const duration = durations[0] ?? 60;
      setAvailableSlotsDuration(duration);

      const slotsRes = await regloApi.getAvailableSlots({
        studentId,
        date,
        durationMinutes: duration,
      });
      if (!slotsRes.length) {
        setToast({ text: 'Posti gi\u00E0 esauriti per questo giorno', tone: 'info' });
        setAvailableSlotsLoading(false);
        return;
      }
      setAvailableSlotsList(slotsRes);
      setAvailableSlotsSelected(null);
      setAvailableSlotsOpen(true);
    } catch {
      setToast({ text: 'Errore nel caricamento degli slot', tone: 'danger' });
    } finally {
      setAvailableSlotsLoading(false);
    }
  }, [studentId]);

  const handleAvailableSlotsDurationChange = useCallback(async (duration: number) => {
    if (!studentId || !availableSlotsDate) return;
    setAvailableSlotsDuration(duration);
    setAvailableSlotsSelected(null);
    setAvailableSlotsLoading(true);
    try {
      const slotsRes = await regloApi.getAvailableSlots({
        studentId,
        date: availableSlotsDate,
        durationMinutes: duration,
      });
      setAvailableSlotsList(slotsRes);
      if (!slotsRes.length) {
        setToast({ text: 'Nessuno slot disponibile per questa durata', tone: 'info' });
      }
    } catch {
      setToast({ text: 'Errore nel caricamento degli slot', tone: 'danger' });
    } finally {
      setAvailableSlotsLoading(false);
    }
  }, [studentId, availableSlotsDate]);

  const handleConfirmAvailableSlot = useCallback(async () => {
    if (!studentId || !availableSlotsSelected || !availableSlotsDate || availableSlotsBooking) return;
    setAvailableSlotsBooking(true);
    setToast(null);
    try {
      const response = await regloApi.createBookingRequest({
        studentId,
        preferredDate: availableSlotsDate,
        durationMinutes: availableSlotsDuration,
        selectedStartsAt: availableSlotsSelected.startsAt,
      });
      if (response.matched) {
        setToast({ text: 'Guida prenotata', tone: 'success' });
        setCelebrationVariant('booking');
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        setAvailableSlotsOpen(false);
        setAvailableSlotsSelected(null);
        setAvailableSlotsList([]);
        notificationEvents.emitDataChanged();
      } else {
        setToast({ text: 'Richiesta inviata', tone: 'success' });
        setAvailableSlotsOpen(false);
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nella prenotazione',
        tone: 'danger',
      });
    } finally {
      setAvailableSlotsBooking(false);
    }
  }, [studentId, availableSlotsSelected, availableSlotsDate, availableSlotsBooking, availableSlotsDuration]);

  // ── Push intents ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(studentId);
        return;
      }
      if (intent === 'appointment_proposal') {
        loadProposals(studentId);
        notificationEvents.emitDataChanged();
        return;
      }
      if (intent === 'swap_offer' && swapEnabled) {
        loadSwapOffers(studentId);
        return;
      }
      if (intent === 'swap_accepted' && swapEnabled) {
        if (data) {
          const id = String(data.id ?? `swap_accepted_${Date.now()}`);
          const conf: ConfirmationData = {
            id,
            acceptedByName: String(data.acceptedByName ?? 'Un allievo'),
            appointmentDate: String(data.appointmentDate ?? ''),
            appointmentTime: String(data.appointmentTime ?? ''),
            instructorName: String(data.instructorName ?? ''),
            vehicleName: String(data.vehicleName ?? ''),
            appointmentType: String(data.appointmentType ?? ''),
          };
          setConfirmations((prev) => [...prev, conf]);
        }
        notificationEvents.emitDataChanged();
        return;
      }
      if (intent === 'available_slots') {
        const date = String(data?.date ?? '');
        if (date) {
          const notifId = `available_slots_${date}_${Date.now()}`;
          const persisted: PersistedNotification = {
            kind: 'available_slots',
            id: notifId,
            data: { date },
            receivedAt: new Date().toISOString(),
            read: false,
            dismissed: false,
          };
          const merged = mergeFromApi(inboxRef.current, [persisted]);
          inboxRef.current = merged;
          setInboxItems(merged);
          saveInbox(merged);
          notificationEvents.emitInboxUpdated();

          handleAvailableSlotsNotification(date);
        }
        return;
      }
      if (intent === 'sick_leave_cancelled') {
        const notifId = `sick_leave_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'sick_leave_cancelled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            instructorName: String(data?.instructorName ?? ''),
          },
          receivedAt: new Date().toISOString(),
          read: false,
          dismissed: false,
        };
        const merged = mergeFromApi(inboxRef.current, [persisted]);
        inboxRef.current = merged;
        setInboxItems(merged);
        saveInbox(merged);
        notificationEvents.emitInboxUpdated();
        notificationEvents.emitDataChanged();
        return;
      }
    });
    return unsub;
  }, [loadSwapOffers, loadWaitlistOffers, loadProposals, handleAvailableSlotsNotification, studentId, isStudent, swapEnabled]);

  // ── Cold start: consume pending push intent ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    consumePendingOrLaunchPushIntent().then((result) => {
      if (!result) return;
      const { intent, data } = result;
      if (intent === 'available_slots') {
        const date = String(data?.date ?? '');
        if (date) {
          const notifId = `available_slots_${date}_${Date.now()}`;
          const persisted: PersistedNotification = {
            kind: 'available_slots',
            id: notifId,
            data: { date },
            receivedAt: new Date().toISOString(),
            read: false,
            dismissed: false,
          };
          const merged = mergeFromApi(inboxRef.current, [persisted]);
          inboxRef.current = merged;
          setInboxItems(merged);
          saveInbox(merged);
          notificationEvents.emitInboxUpdated();
          handleAvailableSlotsNotification(date);
        }
      } else if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(studentId);
      } else if (intent === 'appointment_proposal') {
        loadProposals(studentId);
        notificationEvents.emitDataChanged();
      } else if (intent === 'swap_offer' && swapEnabled) {
        loadSwapOffers(studentId);
      }
    }).catch(() => undefined);
  }, [studentId, isStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AppState: reload on foreground ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      loadAll(studentId);
    });
    return () => subscription.remove();
  }, [loadAll, studentId, isStudent]);

  // ── AppState: sync server notifications on foreground (all roles) ──
  useEffect(() => {
    if (!user?.id) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      syncServerNotifications();
    });
    return () => subscription.remove();
  }, [user?.id, syncServerNotifications]);

  // ── Refresh request from screens ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    return notificationEvents.onRefreshRequested(() => {
      loadAll(studentId);
    });
  }, [loadAll, studentId, isStudent]);

  // ── Instructor push intents (weekly_absence, sick_leave_cancelled) ──
  useEffect(() => {
    if (!isInstructor) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent === 'weekly_absence') {
        const notifId = `weekly_absence_${data?.studentId ?? ''}_${data?.weekStart ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'weekly_absence',
          id: notifId,
          data: {
            studentId: String(data?.studentId ?? ''),
            studentName: String(data?.studentName ?? 'Un allievo'),
            weekStart: String(data?.weekStart ?? ''),
          },
          receivedAt: new Date().toISOString(),
          read: false,
          dismissed: false,
        };
        const merged = mergeFromApi(inboxRef.current, [persisted]);
        inboxRef.current = merged;
        setInboxItems(merged);
        saveInbox(merged);
        notificationEvents.emitInboxUpdated();
      }
      if (intent === 'sick_leave_cancelled') {
        const notifId = `sick_leave_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'sick_leave_cancelled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            instructorName: String(data?.instructorName ?? ''),
          },
          receivedAt: new Date().toISOString(),
          read: false,
          dismissed: false,
        };
        const merged = mergeFromApi(inboxRef.current, [persisted]);
        inboxRef.current = merged;
        setInboxItems(merged);
        saveInbox(merged);
        notificationEvents.emitInboxUpdated();
      }
    });
    return unsub;
  }, [isInstructor]);

  // ── Check slot overlap ──
  const checkBusy = useCallback((startsAt: string, endsAt: string | null): string | null => {
    const offerStart = new Date(startsAt).getTime();
    const offerEnd = endsAt
      ? new Date(endsAt).getTime()
      : offerStart + 30 * 60 * 1000; // default 30 min
    for (const appt of scheduledAppointments) {
      const aStart = new Date(appt.startsAt).getTime();
      const aEnd = appt.endsAt
        ? new Date(appt.endsAt).getTime()
        : aStart + 30 * 60 * 1000;
      if (offerStart < aEnd && offerEnd > aStart) {
        return `Hai già una guida ${formatDay(appt.startsAt)} alle ${formatTime(appt.startsAt)}`;
      }
    }
    return null;
  }, [scheduledAppointments]);

  // ── Open drawer for a specific notification item ──
  const openDrawerForItem = useCallback((item: NotificationItem) => {
    // Available slots: loads fresh from API, no stale check needed
    if (item.kind === 'available_slots') {
      handleAvailableSlotsNotification(item.data.date);
      return;
    }
    // Check if already accepted by the user
    if (acceptedIds.current.has(item.id)) {
      setStaleDrawerKind('accepted');
      return;
    }
    // Confirmations are always viewable (they're info-only)
    if (item.kind === 'confirmation') {
      setConfirmationData(item.data);
      setConfirmationOpen(true);
      return;
    }
    // Check if the offer is still in the current API arrays
    const stillAvailable =
      (item.kind === 'swap' && swapOffers.some((s) => s.id === item.id)) ||
      (item.kind === 'waitlist' && waitlistOffers.some((w) => w.id === item.id)) ||
      (item.kind === 'proposal' && proposals.some((p) => p.id === item.id));

    if (!stillAvailable) {
      setStaleDrawerKind('expired');
      return;
    }

    // Check overlap with scheduled appointments
    let busy: string | null = null;
    if (item.kind === 'swap') {
      busy = checkBusy(item.data.appointment.startsAt, item.data.appointment.endsAt);
    } else if (item.kind === 'waitlist') {
      busy = checkBusy(item.data.slot.startsAt, item.data.slot.endsAt);
    } else if (item.kind === 'proposal') {
      busy = checkBusy(item.data.startsAt, item.data.endsAt);
    }
    setBusySlotLabel(busy);

    switch (item.kind) {
      case 'swap':
        setSwapOffer(item.data);
        setSwapOpen(true);
        break;
      case 'waitlist':
        setWaitlistOffer(item.data);
        setWaitlistOpen(true);
        break;
      case 'proposal':
        setPendingProposal(item.data);
        setProposalOpen(true);
        break;
    }
  }, [swapOffers, waitlistOffers, proposals, checkBusy, handleAvailableSlotsNotification]);

  // ── Listen for openDrawer events from inbox screen ──
  useEffect(() => {
    return notificationEvents.onOpenDrawer((item) => {
      openDrawerForItem(item);
    });
  }, [openDrawerForItem]);

  // ── Auto-open: 1 unread → open drawer directly + mark read ──
  useEffect(() => {
    if (!inboxLoaded.current) return;
    const unread = inboxItems.filter((n) => !n.read && !n.dismissed);
    if (unread.length === 1) {
      const item = unread[0];
      if (!autoOpenedIds.current.has(item.id)) {
        autoOpenedIds.current.add(item.id);
        // Mark as read immediately so badge doesn't show
        const updated = inboxItems.map((n) => n.id === item.id ? { ...n, read: true } : n);
        inboxRef.current = updated;
        setInboxItems(updated);
        saveInbox(updated);
        openDrawerForItem({
          kind: item.kind,
          id: item.id,
          data: item.data,
        } as NotificationItem);
      }
    }
  }, [inboxItems, openDrawerForItem]);

  // ── Bubble animation: >1 unread → show "Hai N novità!" ──
  useEffect(() => {
    if (unreadCount <= 1) {
      Animated.timing(bubbleOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    if (unreadCount > bubbleShownForCount.current && !bubbleDismissed.current) {
      bubbleShownForCount.current = unreadCount;
      bubbleTranslateX.setValue(30);
      bubbleOpacity.setValue(0);
      Animated.spring(bubbleOpacity, { toValue: 1, useNativeDriver: true, stiffness: 200, damping: 15 }).start();
      Animated.spring(bubbleTranslateX, { toValue: 0, useNativeDriver: true, stiffness: 200, damping: 15 }).start();

      const timer = setTimeout(() => {
        Animated.timing(bubbleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, bubbleOpacity, bubbleTranslateX]);

  // ── Helper: persist accepted ID ──
  const markAccepted = useCallback((id: string) => {
    acceptedIds.current.add(id);
    SecureStore.setItemAsync(
      'reglo_accepted_notification_ids',
      JSON.stringify([...acceptedIds.current]),
    ).catch(() => {});
  }, []);

  // ── Handlers: Swap ──

  const handleAcceptSwap = async () => {
    if (!studentId || !swapOffer) return;
    setSwapLoading(true);
    setToast(null);
    try {
      const response = await regloApi.respondSwapOffer(swapOffer.id, {
        studentId,
        response: 'accept',
      });
      if (response.accepted) {
        markAccepted(swapOffer.id);
        setToast({ text: 'Scambio confermato!', tone: 'success' });
        setCelebrationVariant('swap');
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        setSwapOpen(false);
        setSwapOffer(null);
        setSwapOffers((prev) => prev.filter((o) => o.id !== swapOffer.id));
        notificationEvents.emitDataChanged();
      } else {
        setToast({ text: 'Offerta non più disponibile', tone: 'info' });
      }
      await loadSwapOffers(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore',
        tone: 'danger',
      });
    } finally {
      setSwapLoading(false);
    }
  };

  const handleCloseSwap = () => {
    setSwapOpen(false);
    setSwapOffer(null);
  };

  // ── Handlers: Swap Accepted Confirmation ──

  const handleCloseConfirmation = () => {
    setConfirmationOpen(false);
    if (confirmationData) {
      setConfirmations((prev) => prev.filter((c) => c.id !== confirmationData.id));
    }
    setConfirmationData(null);
  };

  // ── Handlers: Waitlist ──

  const handleAcceptWaitlist = async () => {
    if (!studentId || !waitlistOffer) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      const response = await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId,
        response: 'accept',
      });
      if (response.accepted) {
        markAccepted(waitlistOffer.id);
        setToast({ text: 'Slot accettato e guida prenotata', tone: 'success' });
        setCelebrationVariant('booking');
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        setWaitlistOpen(false);
        setWaitlistOffers((prev) => prev.filter((o) => o.id !== waitlistOffer.id));
        notificationEvents.emitDataChanged();
      } else {
        setToast({ text: 'Slot non più disponibile', tone: 'info' });
      }
      await loadWaitlistOffers(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleDeclineWaitlist = async () => {
    if (!studentId || !waitlistOffer || waitlistLoading) return;
    setWaitlistLoading(true);
    setToast(null);
    try {
      await regloApi.respondWaitlistOffer(waitlistOffer.id, {
        studentId,
        response: 'decline',
      });
      setToast({ text: 'Proposta rifiutata', tone: 'info' });
      setWaitlistOpen(false);
      setWaitlistOffers((prev) => prev.filter((o) => o.id !== waitlistOffer.id));
      await loadWaitlistOffers(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto slot',
        tone: 'danger',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  // ── Handlers: Proposal ──

  const handleAcceptProposal = async () => {
    if (!pendingProposal || !studentId) return;
    setProposalLoading(true);
    setToast(null);
    try {
      await regloApi.updateAppointmentStatus(pendingProposal.id, { status: 'scheduled' });
      markAccepted(pendingProposal.id);
      setToast({ text: 'Proposta accettata', tone: 'success' });
      setCelebrationVariant('booking');
      setCelebrationVisible(false);
      setTimeout(() => setCelebrationVisible(true), 0);
      setProposalOpen(false);
      setProposals((prev) => prev.filter((p) => p.id !== pendingProposal.id));
      setPendingProposal(null);
      notificationEvents.emitDataChanged();
      await loadProposals(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante accettazione proposta',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleDeclineProposal = async () => {
    if (!pendingProposal || !studentId || proposalLoading) return;
    setProposalLoading(true);
    setToast(null);
    try {
      await regloApi.cancelAppointment(pendingProposal.id);
      setToast({ text: 'Proposta rifiutata', tone: 'info' });
      setProposalOpen(false);
      setProposals((prev) => prev.filter((p) => p.id !== pendingProposal.id));
      setPendingProposal(null);
      notificationEvents.emitDataChanged();
      await loadProposals(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore durante rifiuto proposta',
        tone: 'danger',
      });
    } finally {
      setProposalLoading(false);
    }
  };

  const handleDismissProposal = () => {
    if (proposalLoading) return;
    if (pendingProposal) dismissedProposalId.current = pendingProposal.id;
    setProposalOpen(false);
  };

  // ── Handle bell tap — navigate to inbox ──
  const handleBellPress = () => {
    bubbleDismissed.current = true;
    Animated.timing(bubbleOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    router.push('/(tabs)/home/notifications');
  };

  if (!isStudent && !isInstructor) return null;

  return (
    <>
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <BookingCelebration
        visible={isStudent && celebrationVisible}
        variant={celebrationVariant}
        onHidden={() => setCelebrationVisible(false)}
      />

      {/* ── Bell + Badge + Bubble ── */}
      {pathname === '/home/notifications' ? null : <View style={[styles.bellContainer, { top: insets.top + 8 }]} pointerEvents="box-none">
          {/* Bubble */}
          {unreadCount > 1 ? (
            <Animated.View
              style={[
                styles.bubble,
                {
                  opacity: bubbleOpacity,
                  transform: [{ translateX: bubbleTranslateX }],
                },
              ]}
            >
              <Text style={styles.bubbleText}>
                Hai {unreadCount} novit{'\u00E0'}!
              </Text>
            </Animated.View>
          ) : null}

          {/* Bell */}
          <Pressable onPress={handleBellPress} style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>}

      {/* ── Swap Offer ── */}
      <BottomSheet
        visible={isStudent && swapOpen && !!swapOffer}
        title="Richiesta sostituzione"
        showHandle
        onClose={swapLoading ? () => {} : handleCloseSwap}
        closeDisabled={swapLoading}
        footer={
          busySlotLabel ? (
            <View style={styles.busyFooter}>
              <View style={styles.busyButton}>
                <Text style={styles.busyButtonText}>{busySlotLabel}</Text>
              </View>
            </View>
          ) : (
            <Button
              label={swapLoading ? 'Attendi...' : `${'\u{1F91D}'} Accetta sostituzione`}
              tone="primary"
              onPress={swapLoading ? undefined : handleAcceptSwap}
              disabled={swapLoading}
              fullWidth
            />
          )
        }
      >
        {swapOffer ? (
          <View style={{ gap: 16 }}>
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>{'\u{1F64B}'}</Text>
              <Text style={styles.heroName}>{swapOffer.requestingStudentName}</Text>
              <Text style={styles.heroHint}>cerca un sostituto per la guida</Text>
            </View>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u{1F4C5}'}</Text>
                <Text style={styles.detailText}>
                  {formatDay(swapOffer.appointment.startsAt)} · {formatTime(swapOffer.appointment.startsAt)}
                  {swapOffer.appointment.endsAt ? ` - ${formatTime(swapOffer.appointment.endsAt)}` : ''}
                </Text>
              </View>
              {swapOffer.appointment.instructorName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F468}\u200D\u{1F3EB}'}</Text>
                  <Text style={styles.detailText}>{swapOffer.appointment.instructorName}</Text>
                </View>
              ) : null}
              {swapOffer.appointment.vehicleName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F697}'}</Text>
                  <Text style={styles.detailText}>{swapOffer.appointment.vehicleName}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u{1F4CB}'}</Text>
                <Text style={styles.detailText}>
                  {lessonTypeLabelMap[swapOffer.appointment.type] ?? swapOffer.appointment.type}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u23F0'}</Text>
                <Text style={styles.detailText}>Rispondi entro le {formatTime(swapOffer.expiresAt)}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Swap Accepted Confirmation ── */}
      <BottomSheet
        visible={isStudent && confirmationOpen && !!confirmationData}
        title="Affare fatto!"
        showHandle
        onClose={handleCloseConfirmation}
        footer={
          <Button
            label={`Perfetto! ${'\u{1F389}'}`}
            tone="primary"
            onPress={handleCloseConfirmation}
            fullWidth
          />
        }
      >
        {confirmationData ? (
          <View style={{ gap: 20 }}>
            <View style={styles.confirmHero}>
              <Text style={styles.confirmEmoji}>{'\u{1F91D}'}</Text>
              <Text style={styles.confirmTitle}>Affare fatto!</Text>
              <Text style={styles.confirmSubtitle}>
                {confirmationData.acceptedByName} ti sostituirà{'\n'}per la tua guida
              </Text>
            </View>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u{1F4C5}'}</Text>
                <Text style={styles.detailText}>
                  {confirmationData.appointmentDate} alle {confirmationData.appointmentTime}
                </Text>
              </View>
              {confirmationData.instructorName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F468}\u200D\u{1F3EB}'}</Text>
                  <Text style={styles.detailText}>{confirmationData.instructorName}</Text>
                </View>
              ) : null}
              {confirmationData.vehicleName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F697}'}</Text>
                  <Text style={styles.detailText}>{confirmationData.vehicleName}</Text>
                </View>
              ) : null}
              {confirmationData.appointmentType ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F4CB}'}</Text>
                  <Text style={styles.detailText}>
                    {lessonTypeLabelMap[confirmationData.appointmentType] ?? confirmationData.appointmentType}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.confirmFootnote}>
              Non devi più presentarti a questa guida {'\u{1F392}'}{'\n'}
              Il tuo credito è stato rimborsato {'\u2705'}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Waitlist Offer ── */}
      <BottomSheet
        visible={isStudent && waitlistOpen && !!waitlistOffer}
        onClose={waitlistLoading ? () => {} : () => { setWaitlistOpen(false); setWaitlistOffer(null); }}
        closeDisabled={waitlistLoading}
        showHandle
        footer={
          busySlotLabel ? (
            <View style={styles.busyFooter}>
              <View style={styles.busyButton}>
                <Text style={styles.busyButtonText}>{busySlotLabel}</Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={waitlistLoading ? undefined : handleAcceptWaitlist}
              disabled={waitlistLoading}
              style={[styles.waitlistCta, waitlistLoading && { opacity: 0.5 }]}
            >
              <Text style={styles.waitlistCtaText}>
                {waitlistLoading ? 'Attendi...' : `${'\u{1F389}'} Prenota questa guida!`}
              </Text>
            </Pressable>
          )
        }
      >
        {waitlistOffer ? (
          <View style={{ gap: 16 }}>
            <View style={styles.waitlistHero}>
              <Text style={styles.waitlistHeroEmoji}>{'\u{1F552}'}</Text>
              <Text style={styles.waitlistHeroTitle}>Slot liberato!</Text>
              <Text style={styles.waitlistHeroSub}>
                Qualcuno ha disdetto e c{'\u2019'}è un posto per te
              </Text>
            </View>
            <View style={styles.waitlistCard}>
              <View style={styles.waitlistCardRow}>
                <Text style={styles.waitlistCardIcon}>{'\u{1F4C5}'}</Text>
                <Text style={styles.waitlistCardText}>
                  {formatDay(waitlistOffer.slot.startsAt)} {'\u2022'} {formatTime(waitlistOffer.slot.startsAt)}
                </Text>
              </View>
              <View style={styles.waitlistCardRow}>
                <Text style={styles.waitlistCardIcon}>{'\u23F1'}</Text>
                <Text style={styles.waitlistCardText}>Durata: 30 min</Text>
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Proposal ── */}
      <BottomSheet
        visible={isStudent && proposalOpen && !!pendingProposal}
        onClose={handleDismissProposal}
        title="Nuova proposta"
        closeDisabled={proposalLoading}
        showHandle
        footer={
          pendingProposal ? (
            busySlotLabel ? (
              <View style={styles.busyFooter}>
                <View style={styles.busyButton}>
                  <Text style={styles.busyButtonText}>{busySlotLabel}</Text>
                </View>
              </View>
            ) : (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={proposalLoading ? undefined : handleAcceptProposal}
                disabled={proposalLoading}
                style={[styles.chunkyPinkCta, proposalLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyPinkCtaText}>
                  {proposalLoading ? 'Attendi...' : `${'\u2705'} Accetta guida`}
                </Text>
              </Pressable>
              <Pressable
                onPress={proposalLoading ? undefined : handleDeclineProposal}
                disabled={proposalLoading}
                style={[styles.chunkyOutlineBtn, proposalLoading && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyOutlineBtnText}>
                  {proposalLoading ? 'Attendi...' : `${'\u{1F504}'} Chiedi cambio orario`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!proposalLoading) handleDeclineProposal();
                }}
                disabled={proposalLoading}
                style={styles.chunkyRedLink}
              >
                <Text style={styles.chunkyRedLinkText}>Rifiuta proposta</Text>
              </Pressable>
            </View>
            )
          ) : undefined
        }
      >
        {pendingProposal ? (
          <View style={{ gap: 16 }}>
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>{'\u{1F4E9}'}</Text>
              <Text style={styles.heroName}>Nuova proposta!</Text>
              <Text style={styles.heroHint}>La tua autoscuola ti ha proposto una guida</Text>
            </View>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u{1F4C5}'}</Text>
                <Text style={styles.detailText}>
                  {formatDay(pendingProposal.startsAt)} {'\u00B7'} {formatTime(pendingProposal.startsAt)}
                  {pendingProposal.endsAt ? ` - ${formatTime(pendingProposal.endsAt)}` : ''}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>{'\u23F1'}</Text>
                <Text style={styles.detailText}>
                  {Math.max(
                    30,
                    Math.round(
                      ((pendingProposal.endsAt
                        ? new Date(pendingProposal.endsAt).getTime()
                        : new Date(pendingProposal.startsAt).getTime() + 30 * 60 * 1000) -
                        new Date(pendingProposal.startsAt).getTime()) /
                        60000,
                    ),
                  )} min
                </Text>
              </View>
              {pendingProposal.instructor?.name ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F468}\u200D\u{1F3EB}'}</Text>
                  <Text style={styles.detailText}>{pendingProposal.instructor.name}</Text>
                </View>
              ) : null}
              {pendingProposal.vehicle?.name ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F697}'}</Text>
                  <Text style={styles.detailText}>{pendingProposal.vehicle.name}</Text>
                </View>
              ) : null}
              {pendingProposal.type ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>{'\u{1F4CB}'}</Text>
                  <Text style={styles.detailText}>
                    {lessonTypeLabelMap[pendingProposal.type] ?? pendingProposal.type}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Available Slots ── */}
      <BottomSheet
        visible={isStudent && availableSlotsOpen && availableSlotsList.length > 0}
        onClose={() => {
          if (!availableSlotsBooking) {
            setAvailableSlotsOpen(false);
            setAvailableSlotsSelected(null);
          }
        }}
        title="Scegli un orario"
        closeDisabled={availableSlotsBooking}
        showHandle
        footer={
          <Pressable
            onPress={availableSlotsBooking || !availableSlotsSelected ? undefined : handleConfirmAvailableSlot}
            disabled={availableSlotsBooking || !availableSlotsSelected}
            style={[
              styles.chunkyPinkCta,
              (availableSlotsBooking || !availableSlotsSelected) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.chunkyPinkCtaText}>
              {availableSlotsBooking ? 'Attendi...' : 'Prenota'}
            </Text>
          </Pressable>
        }
      >
        <Text style={styles.availableSlotsSubtitle}>
          {availableSlotsDate ? formatDay(`${availableSlotsDate}T00:00:00Z`) : ''} {'\u2022'} {availableSlotsDuration} min
        </Text>

        {availableSlotsDurations.length > 1 ? (
          <View style={styles.availableSlotsDurationRow}>
            {availableSlotsDurations.map((d) => {
              const isActive = d === availableSlotsDuration;
              return (
                <Pressable
                  key={`asd-${d}`}
                  style={[styles.availableSlotsDurationChip, isActive && styles.availableSlotsDurationChipActive]}
                  onPress={() => handleAvailableSlotsDurationChange(d)}
                >
                  <Text style={isActive ? styles.availableSlotsDurationTextActive : styles.availableSlotsDurationText}>
                    {d} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {availableSlotsLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#94A3B8' }}>Caricamento...</Text>
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.availableSlotsTimeline}>
              {availableSlotsList.map((slot, index) => {
                const isActive = availableSlotsSelected?.startsAt === slot.startsAt;
                const isLast = index === availableSlotsList.length - 1;
                return (
                  <View key={slot.startsAt} style={styles.availableSlotsTimelineRow}>
                    <View style={styles.availableSlotsTimelineLeft}>
                      <Text style={styles.availableSlotsTimelineHour}>{formatTime(slot.startsAt)}</Text>
                      {!isLast ? <View style={styles.availableSlotsTimelineLine} /> : null}
                    </View>
                    <Pressable
                      style={[styles.availableSlotsTimelineCard, isActive && styles.availableSlotsTimelineCardActive]}
                      onPress={() => setAvailableSlotsSelected(slot)}
                    >
                      <Text style={isActive ? styles.availableSlotsTimelineCardTextActive : styles.availableSlotsTimelineCardText}>
                        {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                      </Text>
                      {isActive ? (
                        <View style={styles.availableSlotsTimelineCheck}>
                          <Text style={styles.availableSlotsTimelineCheckText}>{'\u2713'}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* ── Already Accepted ── */}
      <BottomSheet
        visible={isStudent && staleDrawerKind === 'accepted'}
        onClose={() => setStaleDrawerKind(null)}
        showHandle
        footer={
          <Pressable
            onPress={() => setStaleDrawerKind(null)}
            style={styles.staleAcceptedCta}
          >
            <Text style={styles.staleCtaText}>Tutto chiaro!</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 16 }}>
          <View style={styles.staleHero}>
            <Text style={styles.staleHeroEmoji}>{'\u2705'}</Text>
            <Text style={styles.staleAcceptedTitle}>Già fatto!</Text>
            <Text style={styles.staleSub}>
              Hai già accettato questa proposta.{'\n'}Ci pensiamo noi al resto!
            </Text>
          </View>
          <View style={styles.staleAcceptedCard}>
            <Text style={styles.staleAcceptedCardText}>
              {'\u{1F4AA}'} La tua guida è confermata e ti aspetta in calendario
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ── Too Late / Expired ── */}
      <BottomSheet
        visible={isStudent && staleDrawerKind === 'expired'}
        onClose={() => setStaleDrawerKind(null)}
        showHandle
        footer={
          <Pressable
            onPress={() => setStaleDrawerKind(null)}
            style={styles.staleExpiredCta}
          >
            <Text style={styles.staleExpiredCtaText}>Capito, nessun problema</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 16 }}>
          <View style={styles.staleHero}>
            <Text style={styles.staleHeroEmoji}>{'\u{1F3C3}\u200D\u2642\uFE0F'}</Text>
            <Text style={styles.staleExpiredTitle}>Troppo tardi!</Text>
            <Text style={styles.staleSub}>
              Qualcuno ti ha battuto sul tempo{'\n'}e si è aggiudicato lo slot
            </Text>
          </View>
          <View style={styles.staleExpiredCard}>
            <Text style={styles.staleExpiredCardText}>
              {'\u{1F340}'} Non preoccuparti, ne arriveranno altre!{'\n'}Tieni d{'\u2019'}occhio le notifiche
            </Text>
          </View>
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Bell + Badge + Bubble ──
  bellContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bubble: {
    marginRight: 8,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Swap / Confirmation shared ──
  hero: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroHint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  confirmHero: {
    alignItems: 'center',
    gap: 6,
  },
  confirmEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  confirmSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmFootnote: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },

  // ── Waitlist ──
  waitlistHero: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  waitlistHeroEmoji: {
    fontSize: 44,
    marginBottom: 2,
  },
  waitlistHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  waitlistHeroSub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  waitlistCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 16,
    gap: 12,
  },
  waitlistCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waitlistCardIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  waitlistCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  waitlistCta: {
    backgroundColor: '#22C55E',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  waitlistCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Proposal ──
  chunkyYellowCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 20,
    gap: 6,
  },
  chunkyYellowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CA8A04',
  },
  chunkyYellowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CA8A04',
    textTransform: 'uppercase',
  },
  chunkyYellowTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyYellowSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  chunkyPinkCta: {
    backgroundColor: '#EC4899',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chunkyPinkCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chunkyOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyOutlineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyRedLink: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  chunkyRedLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
  },

  // ── Busy slot ──
  busyFooter: {
    alignItems: 'stretch',
  },
  busyButton: {
    backgroundColor: '#F1F5F9',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  busyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },

  // ── Stale drawers (accepted / expired) ──
  staleHero: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  staleHeroEmoji: {
    fontSize: 52,
    marginBottom: 2,
  },
  staleSub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  staleAcceptedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: -0.5,
  },
  staleAcceptedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 18,
  },
  staleAcceptedCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 22,
  },
  staleAcceptedCta: {
    backgroundColor: '#22C55E',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  staleExpiredTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#CA8A04',
    letterSpacing: -0.5,
  },
  staleExpiredCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 18,
  },
  staleExpiredCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#854D0E',
    textAlign: 'center',
    lineHeight: 22,
  },
  staleExpiredCta: {
    backgroundColor: '#FACC15',
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FACC15',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  staleCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  staleExpiredCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },

  // ── Available Slots ──
  availableSlotsSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 12,
  },
  availableSlotsDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  availableSlotsDurationChip: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSlotsDurationChipActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
  },
  availableSlotsDurationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  availableSlotsDurationTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  availableSlotsTimeline: {
    gap: 0,
  },
  availableSlotsTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 56,
  },
  availableSlotsTimelineLeft: {
    width: 50,
    alignItems: 'center',
    paddingTop: 4,
  },
  availableSlotsTimelineHour: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  availableSlotsTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
    minHeight: 20,
  },
  availableSlotsTimelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  availableSlotsTimelineCardActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#EC4899',
    shadowColor: '#EC4899',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  availableSlotsTimelineCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  availableSlotsTimelineCardTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EC4899',
    flex: 1,
  },
  availableSlotsTimelineCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSlotsTimelineCheckText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
