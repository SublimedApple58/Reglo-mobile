import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { BookingCelebration } from './BookingCelebration';
import { ToastNotice, ToastTone } from './ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import { AutoscuolaSwapOfferWithDetails, AutoscuolaStudent } from '../types/regloApi';
import { colors, spacing } from '../theme';
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
  enabled: boolean;
};

export const SwapOfferOverlay = ({ enabled }: Props) => {
  const { user } = useSession();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [swapOffer, setSwapOffer] = useState<AutoscuolaSwapOfferWithDetails | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    acceptedByName: string;
    appointmentDate: string;
    appointmentTime: string;
    instructorName: string;
    vehicleName: string;
    appointmentType: string;
  } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const ignoredIds = useRef(new Set<string>());
  const ignoredLoaded = useRef(false);

  // Load ignored IDs from storage on mount
  useEffect(() => {
    SecureStore.getItemAsync('reglo_ignored_swap_ids').then((raw) => {
      if (raw) {
        try {
          const ids = JSON.parse(raw) as string[];
          for (const id of ids) ignoredIds.current.add(id);
        } catch {}
      }
      ignoredLoaded.current = true;
    }).catch(() => { ignoredLoaded.current = true; });
  }, []);

  const selectedStudent = useMemo(() => findLinkedStudent(students, user), [students, user]);
  const studentId = selectedStudent?.id ?? null;

  // Load students
  useEffect(() => {
    if (!enabled) return;
    regloApi.getStudents().then(setStudents).catch(() => {});
  }, [enabled]);

  const seenAcceptedIds = useRef(new Set<string>());

  const loadSwapOffers = useCallback(async (sid: string) => {
    try {
      const offers = await regloApi.getSwapOffers(sid, 1);
      const first = offers[0] ?? null;
      if (first && !ignoredIds.current.has(first.id)) {
        setSwapOffer(first);
      } else {
        setSwapOffer(null);
      }
    } catch {
      // silent
    }
  }, []);

  const checkMyAcceptedSwaps = useCallback(async (sid: string) => {
    try {
      const accepted = await regloApi.getMyAcceptedSwaps(sid);
      const unseen = accepted.find((a) => !seenAcceptedIds.current.has(a.id));
      if (unseen) {
        seenAcceptedIds.current.add(unseen.id);
        setConfirmationData({
          acceptedByName: unseen.acceptedByName,
          appointmentDate: unseen.appointmentDate,
          appointmentTime: unseen.appointmentTime,
          instructorName: unseen.instructorName,
          vehicleName: unseen.vehicleName,
          appointmentType: unseen.appointmentType,
        });
        setConfirmationOpen(true);
      }
    } catch {
      // silent
    }
  }, []);

  // Load seen accepted IDs from storage
  useEffect(() => {
    SecureStore.getItemAsync('reglo_seen_accepted_swap_ids').then((raw) => {
      if (raw) {
        try {
          const ids = JSON.parse(raw) as string[];
          for (const id of ids) seenAcceptedIds.current.add(id);
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // Initial load + poll every 15s (wait for ignored IDs to load first)
  useEffect(() => {
    if (!studentId || !enabled) return;
    const start = () => {
      if (!ignoredLoaded.current) {
        setTimeout(start, 200);
        return;
      }
      loadSwapOffers(studentId);
      checkMyAcceptedSwaps(studentId);
    };
    start();
    const interval = setInterval(() => {
      loadSwapOffers(studentId);
      checkMyAcceptedSwaps(studentId);
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadSwapOffers, checkMyAcceptedSwaps, studentId, enabled]);

  // Push intent
  useEffect(() => {
    if (!studentId || !enabled) return;
    const unsub = subscribePushIntent((intent, data) => {
      if (intent === 'swap_offer') {
        loadSwapOffers(studentId);
      }
      if (intent === 'swap_accepted' && data) {
        setConfirmationData({
          acceptedByName: String(data.acceptedByName ?? 'Un allievo'),
          appointmentDate: String(data.appointmentDate ?? ''),
          appointmentTime: String(data.appointmentTime ?? ''),
          instructorName: String(data.instructorName ?? ''),
          vehicleName: String(data.vehicleName ?? ''),
          appointmentType: String(data.appointmentType ?? ''),
        });
        setConfirmationOpen(true);
      }
    });
    return unsub;
  }, [loadSwapOffers, studentId, enabled]);

  // Auto-open
  useEffect(() => {
    if (!swapOffer) {
      setSwapOpen(false);
      return;
    }
    setSwapOpen(true);
  }, [swapOffer]);

  const handleAccept = async () => {
    if (!studentId || !swapOffer) return;
    setSwapLoading(true);
    setToast(null);
    try {
      const response = await regloApi.respondSwapOffer(swapOffer.id, {
        studentId,
        response: 'accept',
      });
      if (response.accepted) {
        setToast({ text: 'Scambio confermato!', tone: 'success' });
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        setSwapOpen(false);
        setSwapOffer(null);
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

  const handleClose = () => {
    if (swapOffer) {
      ignoredIds.current.add(swapOffer.id);
      SecureStore.setItemAsync(
        'reglo_ignored_swap_ids',
        JSON.stringify([...ignoredIds.current]),
      ).catch(() => {});
    }
    setSwapOpen(false);
    setSwapOffer(null);
  };

  const handleCloseConfirmation = () => {
    setConfirmationOpen(false);
    SecureStore.setItemAsync(
      'reglo_seen_accepted_swap_ids',
      JSON.stringify([...seenAcceptedIds.current]),
    ).catch(() => {});
  };

  if (!enabled) return null;

  return (
    <>
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <BookingCelebration
        visible={celebrationVisible}
        variant="swap"
        onHidden={() => setCelebrationVisible(false)}
      />
      <BottomSheet
        visible={swapOpen && !!swapOffer}
        title="Richiesta sostituzione"
        showHandle
        onClose={swapLoading ? () => {} : handleClose}
        closeDisabled={swapLoading}
        footer={
          <Button
            label={swapLoading ? 'Attendi...' : '🤝 Accetta sostituzione'}
            tone="primary"
            onPress={swapLoading ? undefined : handleAccept}
            disabled={swapLoading}
            fullWidth
          />
        }
      >
        {swapOffer ? (
          <View style={{ gap: 16 }}>
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>🙋</Text>
              <Text style={styles.heroName}>{swapOffer.requestingStudentName}</Text>
              <Text style={styles.heroHint}>cerca un sostituto per la guida</Text>
            </View>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailText}>
                  {formatDay(swapOffer.appointment.startsAt)} · {formatTime(swapOffer.appointment.startsAt)}
                  {swapOffer.appointment.endsAt ? ` - ${formatTime(swapOffer.appointment.endsAt)}` : ''}
                </Text>
              </View>
              {swapOffer.appointment.instructorName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>👨‍🏫</Text>
                  <Text style={styles.detailText}>{swapOffer.appointment.instructorName}</Text>
                </View>
              ) : null}
              {swapOffer.appointment.vehicleName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>🚗</Text>
                  <Text style={styles.detailText}>{swapOffer.appointment.vehicleName}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📋</Text>
                <Text style={styles.detailText}>
                  {lessonTypeLabelMap[swapOffer.appointment.type] ?? swapOffer.appointment.type}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>⏰</Text>
                <Text style={styles.detailText}>Rispondi entro le {formatTime(swapOffer.expiresAt)}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Swap Accepted Confirmation ── */}
      <BottomSheet
        visible={confirmationOpen && !!confirmationData}
        title="Affare fatto!"
        showHandle
        onClose={() => handleCloseConfirmation()}
        footer={
          <Button
            label="Perfetto! 🎉"
            tone="primary"
            onPress={() => handleCloseConfirmation()}
            fullWidth
          />
        }
      >
        {confirmationData ? (
          <View style={{ gap: 20 }}>
            <View style={styles.confirmHero}>
              <Text style={styles.confirmEmoji}>🤝</Text>
              <Text style={styles.confirmTitle}>Affare fatto!</Text>
              <Text style={styles.confirmSubtitle}>
                {confirmationData.acceptedByName} ti sostituirà{'\n'}per la tua guida
              </Text>
            </View>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailText}>
                  {confirmationData.appointmentDate} alle {confirmationData.appointmentTime}
                </Text>
              </View>
              {confirmationData.instructorName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>👨‍🏫</Text>
                  <Text style={styles.detailText}>{confirmationData.instructorName}</Text>
                </View>
              ) : null}
              {confirmationData.vehicleName ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>🚗</Text>
                  <Text style={styles.detailText}>{confirmationData.vehicleName}</Text>
                </View>
              ) : null}
              {confirmationData.appointmentType ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📋</Text>
                  <Text style={styles.detailText}>
                    {lessonTypeLabelMap[confirmationData.appointmentType] ?? confirmationData.appointmentType}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.confirmFootnote}>
              Non devi più presentarti a questa guida 🎒{'\n'}
              Il tuo credito è stato rimborsato ✅
            </Text>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
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
});
