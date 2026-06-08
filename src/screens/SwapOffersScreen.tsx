import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingCelebration } from '../components/BookingCelebration';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { subscribePushIntent } from '../services/pushNotifications';
import { notificationEvents } from '../services/notificationEvents';
import { swapDetailStore } from '../stores/swapDetailStore';
import { AutoscuolaSwapOfferWithDetails, AutoscuolaStudent } from '../types/regloApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { formatDay, formatTime } from '../utils/date';

const COMPACT_H = 44;
const SCROLL_RANGE = 70;

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

const lessonTypeLabel = (type: string) => lessonTypeLabelMap[type] ?? type;

const formatTimeRange = (startsAt: string, endsAt: string | null) =>
  `${formatTime(startsAt)}${endsAt ? ` – ${formatTime(endsAt)}` : ''}`;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [offers, setOffers] = useState<AutoscuolaSwapOfferWithDetails[]>([]);
  const [myOffers, setMyOffers] = useState<AutoscuolaSwapOfferWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  const selectedStudent = useMemo(() => findLinkedStudent(students, user), [students, user]);
  const studentId = selectedStudent?.id ?? null;

  useEffect(() => {
    regloApi.getStudents().then(setStudents).catch(() => {});
  }, []);

  const loadOffers = useCallback(async (sid: string) => {
    try {
      const [peers, mine] = await Promise.all([
        regloApi.getSwapOffers(sid, 20),
        regloApi.getMySwapOffers(sid),
      ]);
      setOffers(peers);
      setMyOffers(mine);
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

  useEffect(() => {
    if (!studentId) return;
    const interval = setInterval(() => loadOffers(studentId), 30_000);
    return () => clearInterval(interval);
  }, [loadOffers, studentId]);

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

  const handleAccept = useCallback(async (offerId: string) => {
    if (!studentId) return;
    setToast(null);
    try {
      const res = await regloApi.respondSwapOffer(offerId, {
        studentId,
        response: 'accept',
      });
      if (res.accepted) {
        setToast({ text: 'Scambio confermato!', tone: 'success' });
        setCelebrationVisible(false);
        setTimeout(() => setCelebrationVisible(true), 0);
        notificationEvents.emitDataChanged(); // sync home agenda + swap markers
      } else {
        setToast({ text: 'Offerta non più disponibile', tone: 'info' });
      }
      await loadOffers(studentId);
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore', tone: 'danger' });
    }
  }, [studentId, loadOffers]);

  const handleRevoke = useCallback(async (offerId: string) => {
    if (!studentId) return;
    setToast(null);
    // Optimistic: remove from "Le tue richieste" immediately, snapshot for revert.
    let prevMine: AutoscuolaSwapOfferWithDetails[] = [];
    setMyOffers((list) => {
      prevMine = list;
      return list.filter((o) => o.id !== offerId);
    });
    try {
      await regloApi.cancelSwapOffer(offerId, studentId);
      setToast({ text: 'Richiesta revocata', tone: 'info' });
      notificationEvents.emitDataChanged(); // sync home swap markers
      loadOffers(studentId); // reconcile in background
    } catch (err) {
      setMyOffers(prevMine); // revert
      setToast({ text: err instanceof Error ? err.message : 'Errore', tone: 'danger' });
    }
  }, [studentId, loadOffers]);

  const openOffer = (offer: AutoscuolaSwapOfferWithDetails) => {
    swapDetailStore.set({ offer, onAccept: handleAccept });
    router.push('/(tabs)/home/swap-detail');
  };

  const openMyOffer = (offer: AutoscuolaSwapOfferWithDetails) => {
    swapDetailStore.set({ offer, mine: true, onRevoke: handleRevoke });
    router.push('/(tabs)/home/swap-detail');
  };

  const renderCard = (offer: AutoscuolaSwapOfferWithDetails, i: number, mine: boolean) => (
    <Animated.View key={offer.id} entering={FadeInDown.delay(i * 40).duration(260)}>
      <Pressable
        onPress={() => (mine ? openMyOffer(offer) : openOffer(offer))}
        style={({ pressed }) => [st.card, mine && st.myCard, pressed && st.cardPressed]}
      >
        {/* Top: who */}
        <View style={st.cardTop}>
          {mine ? (
            <View style={[st.avatar, { backgroundColor: '#E9EBF2' }]}>
              <Ionicons name="swap-horizontal" size={22} color="#14141F" />
            </View>
          ) : (
            <View style={st.avatar}>
              <Text style={st.avatarText}>{initialsOf(offer.requestingStudentName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.cardName} numberOfLines={1}>
              {mine ? 'La tua richiesta' : offer.requestingStudentName}
            </Text>
            <Text style={st.cardHint}>{mine ? 'in attesa di un sostituto' : 'cerca un sostituto'}</Text>
          </View>
          {mine ? (
            <View style={[st.openBadge, { backgroundColor: '#E9EBF2' }]}>
              <Text style={[st.openBadgeText, { color: '#14141F' }]}>In attesa</Text>
            </View>
          ) : (
            <View style={st.openBadge}>
              <View style={st.openDot} />
              <Text style={st.openBadgeText}>Aperta</Text>
            </View>
          )}
        </View>

        {/* When */}
        <View style={st.whenRow}>
          <View style={[st.chip, { backgroundColor: '#E9EBF2' }]}>
            <Ionicons name="calendar" size={17} color="#14141F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.whenDate}>{formatDay(offer.appointment.startsAt)}</Text>
            <Text style={st.whenTime}>
              {formatTimeRange(offer.appointment.startsAt, offer.appointment.endsAt)}
            </Text>
          </View>
        </View>

        {/* Meta pills */}
        <View style={st.metaRow}>
          <View style={st.metaPill}>
            <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
            <Text style={st.metaText}>{lessonTypeLabel(offer.appointment.type)}</Text>
          </View>
          {offer.appointment.instructorName ? (
            <View style={st.metaPill}>
              <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
              <Text style={st.metaText} numberOfLines={1}>
                {offer.appointment.instructorName}
              </Text>
            </View>
          ) : null}
          {offer.appointment.vehicleName ? (
            <View style={st.metaPill}>
              <Ionicons name="car-outline" size={12} color={colors.textSecondary} />
              <Text style={st.metaText} numberOfLines={1}>
                {offer.appointment.vehicleName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={st.cardFooter}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={st.cardExpiry}>
            {mine ? 'Tocca per revocare' : `Rispondi entro le ${formatTime(offer.expiresAt)}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );

  /* ── Scroll animation ── */
  const scrollY = useSharedValue(0);
  const headerH = insets.top + COMPACT_H;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_RANGE * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, SCROLL_RANGE], [0, -10], Extrapolation.CLAMP) },
    ],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [SCROLL_RANGE * 0.5, SCROLL_RANGE], [0, 1], Extrapolation.CLAMP),
  }));
  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={st.root}>
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <BookingCelebration
        visible={celebrationVisible}
        variant="swap"
        onHidden={() => setCelebrationVisible(false)}
      />

      {/* ── Sticky blur header ── */}
      <View style={[st.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, st.headerBorder, borderStyle]} />
        <View style={st.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Animated.Text style={[st.compactTitle, compactStyle]} numberOfLines={1}>
            Scambi
          </Animated.Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingTop: headerH }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            progressViewOffset={headerH}
          />
        }
      >
        {/* ── Large title ── */}
        <Animated.View style={largeTitleStyle}>
          <Text style={st.largeTitle}>Scambi</Text>
          <Text style={st.largeSub}>Guide lasciate libere dai tuoi compagni</Text>
        </Animated.View>

        {loading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : myOffers.length === 0 && offers.length === 0 ? (
          <Animated.View entering={FadeIn.duration(250)} style={st.emptyState}>
            <View style={st.emptyIconWrap}>
              <Image
                source={require('../../assets/icons/fluent-swap.png')}
                style={st.emptyIcon}
              />
            </View>
            <Text style={st.emptyTitle}>Nessuno scambio disponibile</Text>
            <Text style={st.emptySub}>
              Quando un compagno lascia libera una guida,{'\n'}la trovi qui da prenotare al volo.
            </Text>
          </Animated.View>
        ) : (
          <>
            {myOffers.length > 0 && (
              <View style={st.section}>
                <Text style={st.sectionTitle}>Le tue richieste</Text>
                <View style={st.list}>
                  {myOffers.map((offer, i) => renderCard(offer, i, true))}
                </View>
              </View>
            )}

            <View style={st.section}>
              {myOffers.length > 0 && (
                <Text style={st.sectionTitle}>Disponibili dai compagni</Text>
              )}
              {offers.length === 0 ? (
                <Text style={st.sectionNote}>
                  Nessuno scambio disponibile al momento.
                </Text>
              ) : (
                <View style={st.list}>
                  {offers.map((offer, i) => renderCard(offer, i, false))}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </Animated.ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { paddingTop: 80, alignItems: 'center' },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.textPrimary },

  /* Large title */
  largeTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  largeSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 4, marginBottom: 18 },

  /* Scroll */
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 20 },

  /* Empty */
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  emptyIcon: { width: 44, height: 44, opacity: 0.9 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  emptySub: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 8 },

  /* Sections */
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.2, textTransform: 'uppercase', marginBottom: 12 },
  sectionNote: { fontSize: 14, fontWeight: '500', color: colors.textMuted, paddingVertical: 8 },

  /* List */
  list: { gap: 18 },
  card: {
    backgroundColor: colors.surface, borderRadius: 28, padding: 18,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 28, elevation: 5,
  },
  myCard: {
    borderWidth: 1.5, borderColor: '#D6D9E6', backgroundColor: '#FDFDFD',
  },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.985 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4F3F7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#7C7A8C' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  cardHint: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 1 },
  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ECFDF5', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  openBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669', letterSpacing: 0.2 },

  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  chip: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  whenDate: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  whenTime: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 1 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F6F6F8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: '100%',
  },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, flexShrink: 1 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  cardExpiry: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.textMuted },
});
