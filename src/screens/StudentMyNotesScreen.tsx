import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarRating } from '../components/StarRating';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaStudent } from '../types/regloApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { formatDay, formatTime } from '../utils/date';

const COMPACT_H = 44;
const SCROLL_RANGE = 70;

const TYPE_THEME: Record<string, { bg: string; fg: string; label: string }> = {
  manovre: { bg: '#DCFCE7', fg: '#15803D', label: 'Manovre' },
  parcheggio: { bg: '#E9EBF2', fg: '#14141F', label: 'Parcheggio' },
  urbano: { bg: '#DBEAFE', fg: '#2563EB', label: 'Urbano' },
  extraurbano: { bg: '#CCFBF1', fg: '#0D9488', label: 'Extraurbano' },
  notturna: { bg: '#E0E7FF', fg: '#4F46E5', label: 'Notturna' },
  autostrada: { bg: '#EDE9FE', fg: '#7C3AED', label: 'Autostrada' },
};

const typeTheme = (t: string) =>
  TYPE_THEME[t.trim().toLowerCase()] ?? {
    bg: '#F3F4F6',
    fg: '#6A6A6A',
    label: t.charAt(0).toUpperCase() + t.slice(1),
  };

const timeRange = (startsAt: string, endsAt?: string | null) =>
  `${formatTime(startsAt)}${endsAt ? ` – ${formatTime(endsAt)}` : ''}`;

const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);
  const byEmail = students.find((s) => normalize(s.email) === normalizedEmail);
  if (byEmail) return byEmail;
  if (!normalizedName) return null;
  const byName = students.find(
    (s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === normalizedName
  );
  return byName ?? null;
};

export const StudentMyNotesScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const students = await regloApi.getStudents();
      const linked = findLinkedStudent(students, user);
      if (!linked) {
        setAppointments([]);
        return;
      }
      const appts = await regloApi.getAppointments({ studentId: linked.id, limit: 500 });
      const withNotes = appts
        .filter(
          (a) =>
            a.notes?.trim() && (a.status ?? '').trim().toLowerCase() !== 'cancelled'
        )
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setAppointments(withNotes);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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

  const renderCard = (appt: AutoscuolaAppointmentWithRelations, i: number) => {
    const isGroup = (appt.type ?? '').trim().toLowerCase() === 'group_lesson';
    const isExam = (appt.type ?? '').trim().toLowerCase() === 'esame';
    const allTypes = (appt.types?.length ? appt.types : appt.type ? [appt.type] : []).filter(
      (t: string) => t !== 'guida' && t !== 'esame' && t !== 'group_lesson'
    );
    const instructorName = appt.instructor?.name ?? 'Istruttore';

    return (
      <Animated.View key={appt.id} entering={FadeInDown.delay(i * 40).duration(260)}>
        <View style={[st.card, isExam && st.examCard, isGroup && st.groupCard]}>
          {/* Top: date + rating */}
          <View style={st.cardTop}>
            <View style={[st.dateChip, isExam && { backgroundColor: '#EDE9FE' }, isGroup && { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="calendar" size={13} color={isExam ? '#7C3AED' : isGroup ? '#0F766E' : '#14141F'} />
              <Text style={[st.dateChipText, isExam && { color: '#7C3AED' }, isGroup && { color: '#0F766E' }]}>
                {formatDay(appt.startsAt)}
              </Text>
            </View>
            {appt.rating != null ? <StarRating value={appt.rating} readOnly size={14} /> : null}
          </View>

          <Text style={st.cardTime}>{timeRange(appt.startsAt, appt.endsAt)}</Text>

          {/* Group-lesson badge / exam badge / type chips */}
          {isGroup ? (
            <View style={st.chipsRow}>
              <View style={st.groupBadge}>
                <Ionicons name="people" size={13} color="#0F766E" />
                <Text style={st.groupBadgeText}>Guida di gruppo</Text>
              </View>
            </View>
          ) : isExam ? (
            <View style={st.chipsRow}>
              <View style={st.examBadge}>
                <Ionicons name="school" size={13} color="#7C3AED" />
                <Text style={st.examBadgeText}>Esame</Text>
              </View>
            </View>
          ) : allTypes.length > 0 ? (
            <View style={st.chipsRow}>
              {allTypes.map((t: string, idx: number) => {
                const th = typeTheme(t);
                return (
                  <View key={idx} style={[st.typeChip, { backgroundColor: th.bg }]}>
                    <Text style={[st.typeChipText, { color: th.fg }]}>{th.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Note */}
          <Text style={st.note}>{appt.notes?.trim()}</Text>

          {/* Instructor footer */}
          <View style={st.footer}>
            <Ionicons name="person" size={13} color={colors.textMuted} />
            <Text style={st.footerText} numberOfLines={1}>
              {instructorName}
              {appt.vehicle?.name ? ` · ${appt.vehicle.name}` : ''}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={st.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* ── Sticky blur header ── */}
      <View style={[st.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, st.headerBorder, borderStyle]} />
        <View style={st.headerRow}>
          <Animated.Text style={[st.compactTitle, compactStyle]} numberOfLines={1}>
            Le mie note
          </Animated.Text>
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
          <Text style={st.largeTitle}>Le mie note</Text>
          <Text style={st.largeSub}>Note rilasciate dai tuoi istruttori</Text>
        </Animated.View>

        {loading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : appointments.length === 0 ? (
          <Animated.View entering={FadeIn.duration(250)} style={st.emptyState}>
            <View style={st.emptyIconWrap}>
              <Image source={require('../../assets/icons/fluent-memo.png')} style={st.emptyIcon} />
            </View>
            <Text style={st.emptyTitle}>Nessuna nota</Text>
            <Text style={st.emptySub}>
              Le note rilasciate dagli istruttori{'\n'}dopo le guide appariranno qui.
            </Text>
          </Animated.View>
        ) : (
          <View style={st.list}>{appointments.map(renderCard)}</View>
        )}

        <View style={{ height: 110 }} />
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
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  compactTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },

  /* Large title */
  largeTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  largeSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 4, marginBottom: 18 },

  /* Scroll */
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 20 },

  /* List */
  list: { gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 4,
  },
  examCard: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  groupCard: { borderLeftWidth: 3, borderLeftColor: '#10B981' },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E9EBF2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateChipText: { fontSize: 12, fontWeight: '700', color: '#14141F', letterSpacing: -0.1 },
  cardTime: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 10 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  typeChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  typeChipText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  examBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  examBadgeText: { fontSize: 12, fontWeight: '700', color: '#7C3AED', letterSpacing: 0.2 },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  groupBadgeText: { fontSize: 12, fontWeight: '700', color: '#0F766E', letterSpacing: 0.2 },

  note: { fontSize: 15, fontWeight: '400', color: colors.textPrimary, lineHeight: 22, marginTop: 14 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  /* Empty */
  emptyState: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyIcon: { width: 46, height: 46 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
});
