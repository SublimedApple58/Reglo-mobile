import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/queries/queryKeys';
import { ToastNotice, ToastTone } from './ToastNotice';
import { useSession } from '../context/SessionContext';
import { useStudentPhase } from '../hooks/useStudentPhase';
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
  AutoscuolaStudent,
} from '../types/regloApi';
import { NotificationItem, ConfirmationData, AvailableSlotsData, PersistedNotification } from '../types/notifications';
import { colors } from '../theme';
import { readAcceptedOfferIds } from '../screens/bookingExceptionParts';

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
  isOwner?: boolean;
  swapEnabled: boolean;
};

export const NotificationOverlay = ({ isStudent, isInstructor = false, isOwner = false, swapEnabled }: Props) => {
  const { user, activeCompanyId } = useSession();
  const { phase: studentPhase } = useStudentPhase();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

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
  const ignoredIds = useRef(new Set<string>());
  const ignoredLoaded = useRef(false);

  // ── Swap accepted confirmations (tracked for inbox/badge only; no drawer —
  // swap-accepted notifications route to the Scambi section) ──
  const [confirmations, setConfirmations] = useState<ConfirmationData[]>([]);

  // ── Waitlist (all) ── offerte attive: badge, posta e apertura automatica.
  // Il foglio dell'offerta è la rotta `/(tabs)/home/slot-offer` (FORM_SHEET,
  // `SlotOfferSheet`); i posti liberi del giorno / dell'ultimo minuto sono
  // `/(tabs)/home/last-minute` (`LastMinuteSheet`). Prima erano BottomSheet
  // fatti a mano qui («Slot liberato!», «Scegli un orario», «Già fatto!»).
  const [waitlistOffers, setWaitlistOffers] = useState<AutoscuolaWaitlistOfferWithSlot[]>([]);

  // ── UI ──
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // ── Bubble animation ──
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleTranslateX = useRef(new Animated.Value(30)).current;
  const bubbleShownForCount = useRef(0);
  const bubbleDismissed = useRef(false);

  // ── Auto-open tracking ──
  const autoOpenedIds = useRef(new Set<string>());

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
    return items;
  }, [confirmations, swapOffers, waitlistOffers]);

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
  }, [confirmations, swapOffers, waitlistOffers]);

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

  // Offerte già accettate: le legge `openSlotOffer` al momento (SecureStore,
  // chiave condivisa con `SlotOfferSheet`, che la scrive dopo un «sì»).

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

  const loadAll = useCallback(
    (sid: string) => {
      loadWaitlistOffers(sid);
      if (swapEnabled) {
        loadSwapOffers(sid);
        checkMyAcceptedSwaps(sid);
      }
    },
    [swapEnabled, loadSwapOffers, checkMyAcceptedSwaps, loadWaitlistOffers],
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

  // ── Fogli dell'allievo: offerta di uno slot liberato e posti liberi ──
  // Push e apertura automatica possono chiedere lo stesso foglio due volte
  // (notifica ricevuta in primo piano + tocco sulla notifica): una volta sola.
  const lastOpened = useRef<{ key: string; at: number } | null>(null);
  const shouldOpen = useCallback((key: string) => {
    const now = Date.now();
    if (lastOpened.current && lastOpened.current.key === key && now - lastOpened.current.at < 60_000) return false;
    lastOpened.current = { key, at: now };
    return true;
  }, []);

  const openSlotOffer = useCallback(async (hint: { offerId: string; startsAt?: string; endsAt?: string; expiresAt?: string }) => {
    if (!hint.offerId || !shouldOpen(`offer_${hint.offerId}`)) return;
    const accepted = await readAcceptedOfferIds();
    const params: Record<string, string> = { offerId: hint.offerId };
    if (studentId) params.studentId = studentId;
    if (hint.startsAt) params.startsAt = hint.startsAt;
    if (hint.endsAt) params.endsAt = hint.endsAt;
    if (hint.expiresAt) params.expiresAt = hint.expiresAt;
    if (accepted.has(hint.offerId)) params.accepted = '1';
    router.push({ pathname: '/(tabs)/home/slot-offer', params });
  }, [router, shouldOpen, studentId]);

  /**
   * Push `available_slots`: con `lastMinute` (prenotazione «solo eccezioni»)
   * il foglio «Posti liberi a breve» sulla finestra dell'ultimo minuto; senza
   * (prenotazione aperta) lo stesso foglio sul giorno della notifica. Il flusso
   * di prenotazione completo della home (`booking-flow`) vive nello store della
   * home e chiede durata, tipo, istruttore: per «si sono liberati posti
   * giovedì» basta scegliere l'orario, come faceva il vecchio «Scegli un orario».
   */
  const openFreeSlots = useCallback((data: { date?: string; lastMinute?: boolean }) => {
    const key = data.lastMinute ? 'last_minute' : `free_${data.date ?? ''}`;
    if (!shouldOpen(key)) return;
    const params: Record<string, string> = {};
    if (studentId) params.studentId = studentId;
    if (!data.lastMinute && data.date) params.date = data.date;
    router.push({ pathname: '/(tabs)/home/last-minute', params });
  }, [router, shouldOpen, studentId]);

  /** Salva in posta la push `available_slots` (anche `lastMinute`). */
  const persistAvailableSlots = useCallback((date: string, lastMinute: boolean) => {
    const persisted: PersistedNotification = {
      kind: 'available_slots',
      id: `available_slots_${date}_${Date.now()}`,
      data: { date, ...(lastMinute ? { lastMinute: true } : {}) },
      receivedAt: new Date().toISOString(),
      read: false,
      dismissed: false,
    };
    const merged = mergeFromApi(inboxRef.current, [persisted]);
    inboxRef.current = merged;
    setInboxItems(merged);
    saveInbox(merged);
    notificationEvents.emitInboxUpdated();
  }, []);

  // ── Push intents ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(studentId);
        const offerId = String(data?.offerId ?? '');
        if (offerId) {
          openSlotOffer({
            offerId,
            startsAt: data?.startsAt ? String(data.startsAt) : undefined,
            endsAt: data?.endsAt ? String(data.endsAt) : undefined,
            expiresAt: data?.expiresAt ? String(data.expiresAt) : undefined,
          });
        }
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
        const lastMinute = data?.lastMinute === true || data?.lastMinute === 'true';
        if (date || lastMinute) {
          persistAvailableSlots(date || new Date().toISOString().slice(0, 10), lastMinute);
          openFreeSlots({ date, lastMinute });
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
      if (intent === 'appointment_rescheduled') {
        const notifId = `reschedule_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'appointment_rescheduled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            startsAt: String(data?.startsAt ?? ''),
            oldStartsAt: String(data?.oldStartsAt ?? ''),
            // REG-604: dicono all'inbox se è un esame e se l'orario esiste.
            isExam: data?.isExam === true,
            timeSet: data?.timeSet !== false,
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
      if (intent === 'appointment_cancelled') {
        const notifId = `cancelled_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'appointment_cancelled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            startsAt: String(data?.startsAt ?? ''),
            isExam: data?.isExam === true,
            timeSet: data?.timeSet !== false,
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
      /**
       * REG-604: esame fissato, o con l'orario appena definito.
       *
       * Solo posta, nessun drawer: non c'è niente da accettare o rifiutare,
       * è una notizia. Lo stesso trattamento di `appointment_rescheduled`.
       */
      if (intent === 'exam_scheduled') {
        const notifId = `exam_scheduled_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'exam_scheduled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            startsAt: String(data?.startsAt ?? ''),
            timeSet: data?.timeSet !== false,
            reason: data?.reason === 'time_set' ? 'time_set' : 'created',
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
      if (intent === 'appointment_location_changed') {
        const notifId = `location_changed_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'appointment_location_changed',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            startsAt: String(data?.startsAt ?? ''),
            oldLocationName: String(data?.oldLocationName ?? ''),
            newLocationName: String(data?.newLocationName ?? ''),
            isExam: data?.isExam === true,
            timeSet: data?.timeSet !== false,
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
      if (intent === 'holiday_declared') {
        const notifId = `holiday_${data?.date ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'holiday_declared',
          id: notifId,
          data: {
            date: String(data?.date ?? ''),
            label: data?.label ? String(data.label) : undefined,
            appointmentsCancelled: Boolean(data?.appointmentsCancelled),
            cancelledCount: data?.cancelledCount ? Number(data.cancelledCount) : undefined,
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
      if (intent === 'availability_published') {
        const notifId = `availability_published_${data?.instructorId ?? ''}_${data?.weekStart ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'availability_published',
          id: notifId,
          data: {
            instructorId: String(data?.instructorId ?? ''),
            instructorName: String(data?.instructorName ?? 'Istruttore'),
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
        return;
      }
    });
    return unsub;
  }, [loadSwapOffers, loadWaitlistOffers, openSlotOffer, openFreeSlots, persistAvailableSlots, studentId, isStudent, swapEnabled]);

  // ── Cold start: consume pending push intent ──
  useEffect(() => {
    if (!studentId || !isStudent) return;
    consumePendingOrLaunchPushIntent().then((result) => {
      if (!result) return;
      const { intent, data } = result;
      if (intent === 'available_slots') {
        const date = String(data?.date ?? '');
        const lastMinute = data?.lastMinute === true || data?.lastMinute === 'true';
        if (date || lastMinute) {
          persistAvailableSlots(date || new Date().toISOString().slice(0, 10), lastMinute);
          openFreeSlots({ date, lastMinute });
        }
      } else if (intent === 'slot_fill_offer') {
        loadWaitlistOffers(studentId);
        const offerId = String(data?.offerId ?? '');
        if (offerId) {
          openSlotOffer({
            offerId,
            startsAt: data?.startsAt ? String(data.startsAt) : undefined,
            endsAt: data?.endsAt ? String(data.endsAt) : undefined,
            expiresAt: data?.expiresAt ? String(data.expiresAt) : undefined,
          });
        }
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

  // ── Student phase change push: persist in inbox + invalidate phase query ──
  // Triggered when the owner advances the student (e.g. AWAITING→TEORIA via
  // "Assegna quiz", or TEORIA→PRATICA via the phase dialog). We immediately
  // invalidate the studentPhase query so the home screen flips to the right
  // home component (AwaitingScreen → TheoryHome → AllievoHome → Licensed)
  // without waiting for the AWAITING-only 30s poll to fire.
  useEffect(() => {
    if (!isStudent) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent !== 'student_phase_change') return;
      const toPhase = String(data?.toPhase ?? '');
      const fromPhase = String(data?.fromPhase ?? '');
      const validPhases = new Set(['AWAITING', 'TEORIA', 'PRATICA', 'PATENTATO']);
      if (!validPhases.has(toPhase) || !validPhases.has(fromPhase)) return;
      const notifId = `student_phase_change_${fromPhase}_${toPhase}_${Date.now()}`;
      const persisted: PersistedNotification = {
        kind: 'student_phase_change',
        id: notifId,
        data: {
          fromPhase: fromPhase as 'AWAITING' | 'TEORIA' | 'PRATICA' | 'PATENTATO',
          toPhase: toPhase as 'AWAITING' | 'TEORIA' | 'PRATICA' | 'PATENTATO',
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
      // Invalidate the phase query so the home routing reflects the new
      // phase on the next render.
      queryClient.invalidateQueries({ queryKey: queryKeys.studentPhase(activeCompanyId) });
    });
    return unsub;
  }, [isStudent, queryClient, activeCompanyId]);

  // ── REG-458: nuovo percorso patente avviato dall'autoscuola ──
  // Stesso trattamento del cambio fase, e per lo stesso motivo: insieme al
  // percorso cambia la FASE (da PATENTATO torna a PRATICA), quindi la query va
  // invalidata o la home resta sulla schermata di fine percorso finché l'app
  // non viene riaperta.
  useEffect(() => {
    if (!isStudent) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent !== 'license_path_started') return;
      const raw = data?.licenseCategory;
      const licenseCategory = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
      const persisted: PersistedNotification = {
        kind: 'license_path_started',
        id: `license_path_started_${licenseCategory ?? 'na'}_${Date.now()}`,
        data: { licenseCategory },
        receivedAt: new Date().toISOString(),
        read: false,
        dismissed: false,
      };
      const merged = mergeFromApi(inboxRef.current, [persisted]);
      inboxRef.current = merged;
      setInboxItems(merged);
      saveInbox(merged);
      notificationEvents.emitInboxUpdated();
      queryClient.invalidateQueries({ queryKey: queryKeys.studentPhase(activeCompanyId) });
    });
    return unsub;
  }, [isStudent, queryClient, activeCompanyId]);

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
      if (intent === 'appointment_rescheduled') {
        const notifId = `reschedule_${data?.appointmentId ?? ''}_${Date.now()}`;
        const persisted: PersistedNotification = {
          kind: 'appointment_rescheduled',
          id: notifId,
          data: {
            appointmentId: String(data?.appointmentId ?? ''),
            startsAt: String(data?.startsAt ?? ''),
            oldStartsAt: String(data?.oldStartsAt ?? ''),
            // REG-604: dicono all'inbox se è un esame e se l'orario esiste.
            isExam: data?.isExam === true,
            timeSet: data?.timeSet !== false,
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

  // ── Owner push intents (exam_ready_nudge) ──
  // Il titolare PURO (OWNER, non INSTRUCTOR_OWNER) non passa da isInstructor:
  // gestiamo qui il nudge "allievi pronti per l'esame". Id stabile (companyId)
  // così push e recovery non creano doppioni in inbox.
  useEffect(() => {
    if (!isOwner) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent === 'exam_ready_nudge') {
        const persisted: PersistedNotification = {
          kind: 'exam_ready_nudge',
          id: `exam_ready_nudge_${data?.companyId ?? 'current'}`,
          data: { count: Number(data?.count ?? 0) },
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
  }, [isOwner]);

  // ── Open the sheet for a notification item (inbox tap, auto-open) ──
  // L'offerta si apre SEMPRE nel suo foglio, anche se non è più nell'elenco:
  // è il foglio a dire «già presa», «scaduta», «sovrapposta» o «è tua»
  // (prima: toast «Offerta non più disponibile» o il drawer «Già fatto!»).
  const openDrawerForItem = useCallback((item: NotificationItem) => {
    // Swap offers / confirmations → sezione «Scambi» (la posta naviga lì).
    if (item.kind === 'swap' || item.kind === 'confirmation') return;
    if (item.kind === 'available_slots') {
      const data = item.data as AvailableSlotsData & { lastMinute?: boolean };
      openFreeSlots({ date: data.date, lastMinute: data.lastMinute === true });
      return;
    }
    // Solo i kind con un foglio: gli altri (annullate, festivi, …) sono notizie.
    if (item.kind !== 'waitlist') return;
    // Dalla push l'id in posta è l'offerta; dal recupero server è `waitlist_<id>`.
    const data = item.data as Partial<AutoscuolaWaitlistOfferWithSlot>;
    const offerId = data.id ?? item.id.replace(/^waitlist_/, '');
    openSlotOffer({
      offerId,
      startsAt: data.slot?.startsAt,
      endsAt: data.slot?.endsAt,
      expiresAt: data.expiresAt,
    });
  }, [openFreeSlots, openSlotOffer]);

  // ── Listen for openDrawer events from inbox screen ──
  useEffect(() => {
    return notificationEvents.onOpenDrawer((item) => {
      openDrawerForItem(item);
    });
  }, [openDrawerForItem]);

  // ── Auto-open: 1 unread → open drawer directly + mark read ──
  // IMPORTANT: skip auto-open for offers that are no longer in the live arrays
  // (swap/waitlist/proposal). Otherwise the user would randomly see "Troppo tardi!"
  // on app open just because an old, stale notification is still in the local inbox.
  // The "Troppo tardi!" drawer should appear ONLY when the user explicitly taps
  // the item in the inbox screen.
  useEffect(() => {
    if (!inboxLoaded.current) return;
    const unread = inboxItems.filter((n) => !n.read && !n.dismissed);
    if (unread.length === 1) {
      const item = unread[0];
      if (autoOpenedIds.current.has(item.id)) return;
      // Swap offers & swap-accepted confirmations never auto-open a drawer —
      // leave them unread so the user taps through to the "Scambi" section.
      if (item.kind === 'swap' || item.kind === 'confirmation') return;

      // For offer-type items, verify they are still live before auto-opening.
      const isOfferKind = item.kind === 'waitlist';
      if (isOfferKind) {
        const offerId = (item.data as { id?: string }).id ?? item.id;
        const stillAvailable =
          item.kind === 'waitlist' && waitlistOffers.some((w) => w.id === offerId);
        if (!stillAvailable) {
          // Silently mark as read without opening any drawer.
          autoOpenedIds.current.add(item.id);
          const updated = inboxItems.map((n) => n.id === item.id ? { ...n, read: true } : n);
          inboxRef.current = updated;
          setInboxItems(updated);
          saveInbox(updated);
          return;
        }
      }

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
  }, [inboxItems, openDrawerForItem, waitlistOffers]);

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

  // ── Handle bell tap — navigate to inbox ──
  const handleBellPress = () => {
    bubbleDismissed.current = true;
    Animated.timing(bubbleOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    // Istruttore: niente tab Notifiche (REG-638) → push nello stack Agenda.
    router.push(isInstructor ? '/(tabs)/home/notifications' : '/(tabs)/inbox');
  };

  if (!isStudent && !isInstructor && !isOwner) return null;

  return (
    <>
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
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
    backgroundColor: '#C13515',
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
    backgroundColor: '#222222',
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
    backgroundColor: '#F7F7F7',
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
});
