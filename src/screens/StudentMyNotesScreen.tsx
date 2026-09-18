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
  FadeOut,
  LinearTransition,
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
import {
  aggregateStudentEvaluations,
  evaluationSummary,
  evaluationSummaryLabel,
} from '../utils/evaluationSheet';

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
    bg: '#F2F2F2',
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
  /** Blocco pagellino aggregato: a riposo è una riga sola, come dall'istruttore. */
  const [pagellinoOpen, setPagellinoOpen] = useState(false);
  /** Guida con il pagellino espanso nella lista (una alla volta). */
  const [openEvalId, setOpenEvalId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const students = await regloApi.getStudents();
      const linked = findLinkedStudent(students, user);
      if (!linked) {
        setAppointments([]);
        return;
      }
      const appts = await regloApi.getAppointments({ studentId: linked.id, limit: 500 });
      // Prima passavano solo le guide con una nota scritta: da quando esiste il
      // pagellino, una guida può essere valutata senza testo e sparirebbe.
      const withNotes = appts
        .filter((a) => {
          if ((a.status ?? '').trim().toLowerCase() === 'cancelled') return false;
          return Boolean(a.notes?.trim()) || Boolean(a.evaluations?.length);
        })
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

  /** Media per voce su tutto lo storico: stesso aggregatore dell'istruttore,
   *  quindi l'allievo legge esattamente i numeri che legge la scuola. */
  const pagellino = useMemo(
    () => aggregateStudentEvaluations(appointments),
    [appointments],
  );

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
            {appt.rating != null && !appt.evaluations?.length ? (
              // Stellina storica: solo sulle guide SENZA pagellino (quelle
              // precedenti alla feature), dove è l'unica valutazione esistente.
              <StarRating value={appt.rating} readOnly size={14} />
            ) : null}
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
          {appt.notes?.trim() ? <Text style={st.note}>{appt.notes.trim()}</Text> : null}

          {/* Pagellino della singola guida: la chip riassume e apre le voci,
              come nella scheda che vede l'istruttore. */}
          {(() => {
            const summary = evaluationSummary(appt.evaluations);
            if (!summary) return null;
            const label = evaluationSummaryLabel(summary);
            const open = openEvalId === appt.id;
            const rows = (appt.evaluations ?? []).filter(
              (row) => row.notApplicable || row.score != null,
            );
            return (
              <Animated.View layout={LinearTransition.springify().damping(18)}>
                <Pressable
                  onPress={() => setOpenEvalId((cur) => (cur === appt.id ? null : appt.id))}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  style={({ pressed }) => [
                    st.pagChip,
                    open && st.pagChipOpen,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="star" size={11} color={open ? '#A16207' : '#FACC15'} />
                  <Text style={[st.pagChipText, open && st.pagChipTextOpen]}>{label}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={open ? '#A16207' : colors.textMuted}
                  />
                </Pressable>
                {open ? (
                  <Animated.View
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(120)}
                    style={st.pagVoci}
                  >
                    {rows.map((row, i) => (
                      <View key={row.itemId} style={[st.pagVoce, i > 0 && st.pagVoceBorder]}>
                        <Text style={st.pagVoceName} numberOfLines={2}>{row.label}</Text>
                        {row.notApplicable || row.score == null ? (
                          <Text style={st.pagVoceNa}>— non valutabile</Text>
                        ) : (
                          <StarRating
                            value={row.score}
                            total={row.scaleMax}
                            readOnly
                            size={13}
                            tone="gold"
                          />
                        )}
                      </View>
                    ))}
                  </Animated.View>
                ) : null}
              </Animated.View>
            );
          })()}

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
          <Text style={st.largeSub}>Valutazioni e note dei tuoi istruttori</Text>
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
            <Text style={st.emptyTitle}>Ancora niente</Text>
            <Text style={st.emptySub}>
              Le valutazioni e le note dei tuoi{'\n'}istruttori appariranno qui dopo le guide.
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Pagellino — media per voce su tutte le guide. Stessa lettura che
                ha l'istruttore nel dettaglio allievo. */}
            {pagellino ? (
              <Animated.View entering={FadeIn.duration(350)} style={st.pagBlock}>
                <Pressable
                  onPress={() => setPagellinoOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: pagellinoOpen }}
                  style={({ pressed }) => [st.pagHeadRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={st.pagLabel}>Pagellino</Text>
                    <Text style={st.pagInsight}>
                      {pagellino.lessonCount === 1
                        ? '1 guida valutata'
                        : `${pagellino.lessonCount} guide valutate`}
                    </Text>
                  </View>
                  <View style={st.sparkRow}>
                    {pagellino.items.slice(0, 6).map((item) => (
                      <View key={item.itemId} style={st.sparkTrack}>
                        <View
                          style={[
                            st.sparkFill,
                            { height: `${Math.max(12, (item.average / item.scaleMax) * 100)}%` },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={st.pagBig}>
                    {pagellino.average != null ? (
                      <>
                        <Text style={st.pagBigNum}>
                          {pagellino.average.toFixed(1).replace('.', ',')}
                        </Text>
                        <Text style={st.pagBigTot}>/{pagellino.scaleMax}</Text>
                      </>
                    ) : (
                      <Text style={st.pagBigTot}>{pagellino.items.length} voci</Text>
                    )}
                  </View>
                  <Ionicons
                    name={pagellinoOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>

                {pagellinoOpen ? (
                  <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
                    {pagellino.items.map((item) => (
                      <View key={item.itemId} style={st.pagRow}>
                        <View style={st.pagRowTop}>
                          <Text style={st.pagName} numberOfLines={1}>{item.label}</Text>
                          <Text style={st.pagVal}>
                            <Text style={st.pagValNum}>
                              {item.average.toFixed(1).replace('.', ',')}
                            </Text>
                            /{item.scaleMax} · {item.count === 1 ? '1 guida' : `${item.count} guide`}
                          </Text>
                        </View>
                        <View style={st.pagTrack}>
                          <View
                            style={[
                              st.pagFill,
                              { width: `${(item.average / item.scaleMax) * 100}%` },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                    {pagellino.weakest ? (
                      <Text style={st.pagFoot}>
                        Voce più bassa:{' '}
                        <Text style={st.pagFootStrong}>{pagellino.weakest.label}</Text>
                        {` (${pagellino.weakest.average
                          .toFixed(1)
                          .replace('.', ',')}/${pagellino.weakest.scaleMax})`}
                      </Text>
                    ) : null}
                  </Animated.View>
                ) : null}
              </Animated.View>
            ) : null}

            <View style={st.list}>{appointments.map(renderCard)}</View>
          </>
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

  /* Pagellino aggregato */
  pagBlock: { marginBottom: 22 },
  pagLabel: {
    fontSize: 11, fontWeight: '700', color: '#929292',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  pagHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  pagInsight: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted, marginTop: 3 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 26 },
  sparkTrack: {
    width: 6, height: '100%', borderRadius: 3, backgroundColor: '#EFEFF2',
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  sparkFill: { width: '100%', borderRadius: 3, backgroundColor: '#FACC15' },
  pagBig: { flexDirection: 'row', alignItems: 'baseline' },
  pagBigNum: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.5 },
  pagBigTot: { fontSize: 15, fontWeight: '600', color: '#929292' },
  pagRow: { marginTop: 14 },
  pagRowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  pagName: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#1A1A2E' },
  pagVal: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pagValNum: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  pagTrack: { height: 6, borderRadius: 3, backgroundColor: '#EFEFF2', marginTop: 7, overflow: 'hidden' },
  pagFill: { height: '100%', borderRadius: 3, backgroundColor: '#FACC15' },
  pagFoot: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted, marginTop: 16 },
  pagFootStrong: { fontWeight: '600', color: '#1A1A2E' },

  /* Pagellino della singola guida */
  pagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 10, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, backgroundColor: '#F2F2F4',
  },
  pagChipText: { fontSize: 11.5, fontWeight: '700', color: '#1A1A2E' },
  pagChipOpen: { backgroundColor: '#FEF9C3' },
  pagChipTextOpen: { color: '#A16207' },
  pagVoci: { marginTop: 6, paddingLeft: 2 },
  pagVoce: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingVertical: 7,
  },
  pagVoceBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F4F4F6' },
  pagVoceName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#6A6A6A' },
  pagVoceNa: { fontSize: 11.5, fontWeight: '500', color: '#A3A3AD' },

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
