import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import { AutoscuolaSwapOfferWithDetails, AutoscuolaStudent } from '../types/regloApi';
import { colors, radii, spacing } from '../theme';
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

export const SwapOffersScreen = () => {
  const { user } = useSession();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [offers, setOffers] = useState<AutoscuolaSwapOfferWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<AutoscuolaSwapOfferWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [responding, setResponding] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  const selectedStudent = useMemo(() => findLinkedStudent(students, user), [students, user]);
  const studentId = selectedStudent?.id ?? null;

  // Load students on mount
  useEffect(() => {
    regloApi.getStudents().then(setStudents).catch(() => {});
  }, []);

  const loadOffers = useCallback(async (sid: string) => {
    try {
      const data = await regloApi.getSwapOffers(sid, 20);
      setOffers(data);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel caricamento',
        tone: 'danger',
      });
    }
  }, []);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    loadOffers(studentId).finally(() => setLoading(false));
  }, [loadOffers, studentId]);

  // Poll every 30s
  useEffect(() => {
    if (!studentId) return;
    const interval = setInterval(() => loadOffers(studentId), 30_000);
    return () => clearInterval(interval);
  }, [loadOffers, studentId]);

  // Push intent
  useEffect(() => {
    if (!studentId) return;
    const unsub = subscribePushIntent((intent) => {
      if (intent === 'swap_offer' || intent === 'swap_accepted') {
        loadOffers(studentId);
      }
    });
    return unsub;
  }, [loadOffers, studentId]);

  const handleRefresh = async () => {
    if (!studentId) return;
    setRefreshing(true);
    await loadOffers(studentId);
    setRefreshing(false);
  };

  const handleAccept = async () => {
    if (!studentId || !selectedOffer) return;
    setResponding(true);
    setToast(null);
    try {
      const res = await regloApi.respondSwapOffer(selectedOffer.id, {
        studentId: studentId,
        response: 'accept',
      });
      if (res.accepted) {
        setToast({ text: 'Scambio confermato!', tone: 'success' });
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        setSheetOpen(false);
      } else {
        setToast({ text: 'Offerta non più disponibile', tone: 'info' });
      }
      await loadOffers(studentId);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore',
        tone: 'danger',
      });
    } finally {
      setResponding(false);
    }
  };

  const openOffer = (offer: AutoscuolaSwapOfferWithDetails) => {
    setSelectedOffer(offer);
    setSheetOpen(true);
  };

  return (
    <Screen>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sostituzioni 🔄</Text>
          <Text style={styles.subtitle}>
            Qualcuno ha bisogno di un sostituto?{'\n'}Dai un'occhiata! 👀
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyTitle}>Nessuna richiesta</Text>
            <Text style={styles.emptySubtitle}>
              Quando qualcuno cerca un sostituto{'\n'}lo vedrai qui. Stay tuned! ✨
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {offers.map((offer) => (
              <Pressable
                key={offer.id}
                style={styles.card}
                onPress={() => openOffer(offer)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardAvatar}>
                    <Text style={styles.cardAvatarText}>🙋</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{offer.requestingStudentName}</Text>
                    <Text style={styles.cardHint}>cerca un sostituto</Text>
                  </View>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>🤝 Aperta</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardDetail}>
                    <Text style={styles.cardDetailIcon}>📅</Text>
                    <Text style={styles.cardDetailText}>
                      {formatDay(offer.appointment.startsAt)} · {formatTime(offer.appointment.startsAt)}
                      {offer.appointment.endsAt ? ` - ${formatTime(offer.appointment.endsAt)}` : ''}
                    </Text>
                  </View>
                  {offer.appointment.instructorName ? (
                    <View style={styles.cardDetail}>
                      <Text style={styles.cardDetailIcon}>👨‍🏫</Text>
                      <Text style={styles.cardDetailText}>{offer.appointment.instructorName}</Text>
                    </View>
                  ) : null}
                  {offer.appointment.vehicleName ? (
                    <View style={styles.cardDetail}>
                      <Text style={styles.cardDetailIcon}>🚗</Text>
                      <Text style={styles.cardDetailText}>{offer.appointment.vehicleName}</Text>
                    </View>
                  ) : null}
                  <View style={styles.cardDetail}>
                    <Text style={styles.cardDetailIcon}>📋</Text>
                    <Text style={styles.cardDetailText}>
                      {lessonTypeLabelMap[offer.appointment.type] ?? offer.appointment.type}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Ionicons name="time-outline" size={13} color="#94A3B8" />
                  <Text style={styles.cardExpiry}>
                    Rispondi entro le {formatTime(offer.expiresAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail sheet */}
      <BottomSheet
        visible={sheetOpen && !!selectedOffer}
        title="Dettaglio sostituzione"
        showHandle
        onClose={responding ? () => {} : () => setSheetOpen(false)}
        closeDisabled={responding}
        footer={
          <Button
            label={responding ? 'Attendi...' : '🤝 Accetta sostituzione'}
            tone="primary"
            onPress={responding ? undefined : handleAccept}
            disabled={responding}
            fullWidth
          />
        }
      >
        {selectedOffer ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHero}>
              <Text style={styles.sheetHeroEmoji}>🙋</Text>
              <Text style={styles.sheetHeroName}>{selectedOffer.requestingStudentName}</Text>
              <Text style={styles.sheetHeroHint}>cerca un sostituto per la guida</Text>
            </View>

            <View style={styles.sheetDetails}>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowIcon}>📅</Text>
                <Text style={styles.sheetRowText}>
                  {formatDay(selectedOffer.appointment.startsAt)} · {formatTime(selectedOffer.appointment.startsAt)}
                  {selectedOffer.appointment.endsAt ? ` - ${formatTime(selectedOffer.appointment.endsAt)}` : ''}
                </Text>
              </View>
              {selectedOffer.appointment.instructorName ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetRowIcon}>👨‍🏫</Text>
                  <Text style={styles.sheetRowText}>{selectedOffer.appointment.instructorName}</Text>
                </View>
              ) : null}
              {selectedOffer.appointment.vehicleName ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetRowIcon}>🚗</Text>
                  <Text style={styles.sheetRowText}>{selectedOffer.appointment.vehicleName}</Text>
                </View>
              ) : null}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowIcon}>📋</Text>
                <Text style={styles.sheetRowText}>
                  {lessonTypeLabelMap[selectedOffer.appointment.type] ?? selectedOffer.appointment.type}
                </Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowIcon}>⏰</Text>
                <Text style={styles.sheetRowText}>
                  Rispondi entro le {formatTime(selectedOffer.expiresAt)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  loaderWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },
  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // ── List ──
  list: {
    gap: 12,
  },
  // ── Card ──
  card: {
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: {
    fontSize: 20,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  cardBody: {
    gap: 6,
    marginBottom: 10,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDetailIcon: {
    fontSize: 14,
    width: 22,
    textAlign: 'center',
  },
  cardDetailText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  cardExpiry: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // ── Sheet ──
  sheetContent: {
    gap: 16,
  },
  sheetHero: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  sheetHeroEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  sheetHeroName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetHeroHint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sheetDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetRowIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
});
