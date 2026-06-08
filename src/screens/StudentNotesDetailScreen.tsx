import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StarRating } from '../components/StarRating';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations, AutoscuolaCase } from '../types/regloApi';
import { colors } from '../theme';
import { formatDay, formatTime } from '../utils/date';

const FLUENT_GRADUATE = require('../../assets/icons/fluent-graduate.png');
const REQUIRED_LESSONS = 6;

const TYPE_TINT: Record<string, { bg: string; fg: string }> = {
  manovre: { bg: '#DCFCE7', fg: '#15803D' },
  parcheggio: { bg: '#E9EBF2', fg: '#0D0D16' },
  urbano: { bg: '#DBEAFE', fg: '#1D4ED8' },
  extraurbano: { bg: '#CCFBF1', fg: '#0F766E' },
  notturna: { bg: '#E0E7FF', fg: '#4338CA' },
  autostrada: { bg: '#EDE9FE', fg: '#6D28D9' },
};
const tintFor = (t: string) => TYPE_TINT[t.toLowerCase()] ?? { bg: '#F1F5F9', fg: '#475569' };

const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const formatExamDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
};

export const StudentNotesDetailScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name: string }>();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      const [appts, allCases] = await Promise.all([
        regloApi.getAppointments({ studentId, limit: 500 }),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
      ]);
      const filtered = appts
        .filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled')
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      setAppointments(filtered);
      setCases(allCases.filter((c) => c.studentId === studentId));
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const phone = useMemo(() => {
    for (const appt of appointments) if (appt.student?.phone) return appt.student.phone;
    return null;
  }, [appointments]);

  const completedCount = useMemo(
    () => appointments.filter((a) => {
      const s = (a.status ?? '').trim().toLowerCase();
      return s === 'completed' || s === 'checked_in';
    }).length,
    [appointments],
  );
  const isCompleted = completedCount >= REQUIRED_LESSONS;

  const avgRating = useMemo(() => {
    const rated = appointments.filter((a) => a.rating != null);
    if (!rated.length) return null;
    const avg = rated.reduce((s, a) => s + (a.rating as number), 0) / rated.length;
    return avg.toFixed(1).replace('.', ',');
  }, [appointments]);

  const totalHours = useMemo(() => {
    const mins = appointments
      .filter((a) => { const st = (a.status ?? '').trim().toLowerCase(); return st === 'completed' || st === 'checked_in'; })
      .reduce((s, a) => {
        const start = new Date(a.startsAt).getTime();
        const end = a.endsAt ? new Date(a.endsAt).getTime() : start + 60 * 60 * 1000;
        return s + Math.max(0, Math.round((end - start) / 60000));
      }, 0);
    return Math.round(mins / 60);
  }, [appointments]);

  const upcomingExam = useMemo(() => {
    const now = new Date();
    for (const c of cases) {
      if (c.drivingExamAt && new Date(c.drivingExamAt) > now) return { type: 'guida', date: c.drivingExamAt };
      if (c.theoryExamAt && new Date(c.theoryExamAt) > now) return { type: 'teoria', date: c.theoryExamAt };
    }
    for (const appt of appointments) {
      if ((appt.type ?? '').toLowerCase() === 'esame' && new Date(appt.startsAt) > now) {
        return { type: 'guida', date: appt.startsAt };
      }
    }
    return null;
  }, [cases, appointments]);

  const student = useMemo(() => appointments.find((a) => a.student)?.student ?? null, [appointments]);
  const displayName = (name ?? 'Allievo').toString();
  const fullName = student ? `${student.firstName} ${student.lastName}`.trim() : displayName;
  const firstName = student?.firstName ?? displayName.split(' ')[0];
  const email = student?.email ?? null;
  const initials = (firstName[0] ?? displayName[0] ?? '?').toUpperCase();
  const cleanPhone = phone?.replace(/\s+/g, '').replace(/^\+/, '');

  // Flip card (front = summary, back = personal info)
  const flip = useSharedValue(0);
  const toggleFlip = () => { flip.value = withTiming(flip.value < 0.5 ? 1 : 0, { duration: 520, easing: Easing.inOut(Easing.cubic) }); };
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden',
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden',
    opacity: flip.value < 0.5 ? 0 : 1,
  }));

  return (
    <View style={s.sheet}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Top bar — close */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: phone ? 110 : 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile flip card — real layout always; data fades in */}
        <Pressable onPress={toggleFlip} style={s.flipWrap}>
          {/* FRONT */}
          <Animated.View style={[s.face, s.faceFront, frontStyle]}>
            <View style={s.profileLeft}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
              <Text style={s.profileName} numberOfLines={1}>{firstName}</Text>
            </View>
            {loading ? (
              <View style={s.profileStats}>
                {[0, 1, 2].map((i) => (
                  <View key={i}>
                    {i > 0 ? <View style={s.statHr} /> : null}
                    <View style={s.statBlock}>
                      <SkeletonBlock width={36} height={20} radius={6} />
                      <SkeletonBlock width={62} height={12} radius={5} style={{ marginTop: 7 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Animated.View entering={FadeIn.duration(350)} style={s.profileStats}>
                <View style={s.statBlock}><Text style={s.statNum}>{completedCount}</Text><Text style={s.statLbl}>completate</Text></View>
                <View style={s.statHr} />
                <View style={s.statBlock}><Text style={s.statNum}>{avgRating ?? '—'}</Text><Text style={s.statLbl}>voto medio</Text></View>
                <View style={s.statHr} />
                <View style={s.statBlock}><Text style={s.statNum}>{totalHours}h</Text><Text style={s.statLbl}>ore guidate</Text></View>
              </Animated.View>
            )}
            <View style={s.flipHint}><Ionicons name="sync-outline" size={14} color="#CBD5E1" /></View>
          </Animated.View>

          {/* BACK */}
          <Animated.View style={[s.face, s.faceBack, backStyle]}>
            <Text style={s.backTitle}>Dati personali</Text>
            <View style={s.backRow}>
              <Ionicons name="person-outline" size={16} color="#94A3B8" />
              <View style={{ flex: 1 }}><Text style={s.backLabel}>Nome</Text><Text style={s.backValue} numberOfLines={1}>{fullName}</Text></View>
            </View>
            <View style={s.backRow}>
              <Ionicons name="mail-outline" size={16} color="#94A3B8" />
              <View style={{ flex: 1 }}><Text style={s.backLabel}>Email</Text><Text style={s.backValue} numberOfLines={1}>{email ?? '—'}</Text></View>
            </View>
            <View style={s.backRow}>
              <Ionicons name="call-outline" size={16} color="#94A3B8" />
              <View style={{ flex: 1 }}><Text style={s.backLabel}>Telefono</Text><Text style={s.backValue} numberOfLines={1}>{phone ?? '—'}</Text></View>
            </View>
            <View style={s.flipHint}><Ionicons name="sync-outline" size={14} color="#CBD5E1" /></View>
          </Animated.View>
        </Pressable>

        <View style={s.below}>
          {/* Obbligo guide — flat (frame always, data fades in) */}
          <View style={s.flatBlock}>
            <View style={s.obbligoTop}>
              <Text style={s.flatLabel}>OBBLIGO GUIDE</Text>
              {loading ? (
                <SkeletonBlock width={44} height={22} radius={6} />
              ) : (
                <Animated.View entering={FadeIn.duration(350)} style={s.obbligoCountRow}>
                  <Text style={s.obbligoCount}>{Math.min(completedCount, REQUIRED_LESSONS)}</Text>
                  <Text style={s.obbligoTotal}>/{REQUIRED_LESSONS}</Text>
                </Animated.View>
              )}
            </View>
            <View style={s.segments}>
              {Array.from({ length: REQUIRED_LESSONS }).map((_, i) => (
                <View key={i} style={[s.segment, !loading && i < completedCount && s.segmentFilled]} />
              ))}
            </View>
            {loading ? (
              <SkeletonBlock width={150} height={13} radius={6} style={{ marginTop: 12 }} />
            ) : (
              <Animated.View entering={FadeIn.duration(350)} style={s.obbligoStatusRow}>
                {isCompleted ? <Ionicons name="checkmark-circle" size={15} color="#16A34A" /> : null}
                <Text style={[s.obbligoStatus, isCompleted && { color: '#16A34A' }]}>
                  {isCompleted ? 'Obbligo completato' : `Mancano ${REQUIRED_LESSONS - completedCount} guide`}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Exam — flat icon row */}
          {!loading && upcomingExam ? (
            <Animated.View entering={FadeIn.duration(350)} style={s.examRow}>
              <Image source={FLUENT_GRADUATE} style={s.examIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.examTitle}>Esame {upcomingExam.type === 'teoria' ? 'di teoria' : 'di guida'}</Text>
                <Text style={s.examDate}>{formatExamDate(upcomingExam.date)}</Text>
              </View>
              <View style={s.examBadge}><Text style={s.examBadgeText}>In arrivo</Text></View>
            </Animated.View>
          ) : null}

          <View style={s.divider} />

          {/* Storico guide — flat timeline (skeleton → fade) */}
          <Text style={s.sectionLabel}>STORICO GUIDE</Text>
          {loading ? (
            <View>
              {[0, 1, 2].map((i) => (
                <View key={i} style={s.tlRow}>
                  <View style={s.tlLeft}>
                    <View style={s.tlDot} />
                    {i < 2 ? <View style={s.tlLine} /> : null}
                  </View>
                  <View style={[s.tlBody, i < 2 && s.tlBodyBorder]}>
                    <SkeletonBlock width="52%" height={15} radius={6} />
                    <SkeletonBlock width="38%" height={12} radius={6} style={{ marginTop: 8 }} />
                    <SkeletonBlock width="80%" height={12} radius={6} style={{ marginTop: 8 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : appointments.length === 0 ? (
            <Text style={s.emptyText}>Nessuna guida registrata con questo allievo.</Text>
          ) : (
            <Animated.View entering={FadeIn.duration(350)}>
              {appointments.map((appt, idx) => {
                  const isLast = idx === appointments.length - 1;
                  const isExam = (appt.type ?? '').trim().toLowerCase() === 'esame';
                  const allTypes = (appt.types?.length ? appt.types : (appt.type ? [appt.type] : [])).filter((t: string) => t !== 'guida');
                  return (
                    <View key={appt.id} style={s.tlRow}>
                      <View style={s.tlLeft}>
                        <View style={[s.tlDot, isExam && s.tlDotExam]} />
                        {!isLast ? <View style={s.tlLine} /> : null}
                      </View>
                      <View style={[s.tlBody, !isLast && s.tlBodyBorder, !isExam && !appt.notes?.trim() && { opacity: 0.65 }]}>
                        <View style={s.tlTopRow}>
                          <Text style={s.tlDate}>{formatDay(appt.startsAt)}</Text>
                          <Text style={s.tlTime}>
                            {formatTime(appt.startsAt)}{appt.endsAt ? ` – ${formatTime(appt.endsAt)}` : ''}
                          </Text>
                          {appt.rating != null ? <StarRating value={appt.rating} readOnly size={13} /> : null}
                        </View>
                        {isExam ? (
                          <View style={[s.tlChip, { backgroundColor: '#EDE9FE', alignSelf: 'flex-start' }]}>
                            <Text style={[s.tlChipText, { color: '#6D28D9' }]}>Esame</Text>
                          </View>
                        ) : allTypes.length ? (
                          <View style={s.tlChips}>
                            {allTypes.map((t: string, i: number) => {
                              const { bg, fg } = tintFor(t);
                              return (
                                <View key={i} style={[s.tlChip, { backgroundColor: bg }]}>
                                  <Text style={[s.tlChipText, { color: fg }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                        {!isExam ? (
                          <Text style={s.tlMeta}>{appt.instructor?.name ?? 'Istruttore'} · {appt.vehicle?.name ?? 'Veicolo n/d'}</Text>
                        ) : null}
                        <Text style={[s.tlNote, !appt.notes?.trim() && s.tlNoteEmpty]}>
                          {appt.notes?.trim() || 'Nessuna nota'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            )}
        </View>
      </ScrollView>

      {/* Sticky contact footer */}
      {phone && !loading ? (
        <Animated.View entering={FadeIn.duration(300)} style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone}`)}
            style={({ pressed }) => [s.callBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="call" size={20} color="#1A1A2E" />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(`https://wa.me/${cleanPhone}`)}
            style={({ pressed }) => [s.waBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
            <Text style={s.waBtnText}>Scrivi su WhatsApp</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 30, paddingRight: 16, paddingTop: 20, paddingBottom: 4 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingTop: 4 },
  below: { paddingHorizontal: 8 }, // guide + note narrower than the profile card

  // Profile flip card (single allowed card)
  flipWrap: { marginHorizontal: 4, marginTop: 18, marginBottom: 26 },
  face: {
    backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 22, paddingHorizontal: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.09, shadowRadius: 18, elevation: 5,
  },
  faceFront: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  faceBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', gap: 16 },
  profileLeft: { flex: 1, alignItems: 'center', gap: 4, paddingRight: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E9EBF2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  profileName: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, textAlign: 'center' },
  profileStats: { width: 108, alignSelf: 'center' },
  statBlock: { paddingVertical: 6 },
  statNum: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  statLbl: { fontSize: 12, color: colors.textMuted },
  statHr: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  flipHint: { position: 'absolute', top: 12, right: 12 },

  // Back face
  backTitle: { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backLabel: { fontSize: 11, fontWeight: '500', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  backValue: { fontSize: 15, fontWeight: '400', color: '#1A1A2E', marginTop: 1 },

  // Flat blocks
  flatBlock: { marginBottom: 22 },
  flatLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase' },
  obbligoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  obbligoCountRow: { flexDirection: 'row', alignItems: 'baseline' },
  obbligoCount: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.5 },
  obbligoTotal: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  segments: { flexDirection: 'row', gap: 6, marginTop: 12 },
  segment: { flex: 1, height: 9, borderRadius: 5, backgroundColor: '#E5E7EB' },
  segmentFilled: { backgroundColor: '#1A1A2E' },
  obbligoStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  obbligoStatus: { fontSize: 13, fontWeight: '500', color: colors.textMuted },

  examRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  examIcon: { width: 40, height: 40 },
  examTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  examDate: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  examBadge: { backgroundColor: '#EDE9FE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  examBadgeText: { fontSize: 11, fontWeight: '700', color: '#6D28D9' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },

  tlRow: { flexDirection: 'row', gap: 14 },
  tlLeft: { width: 12, alignItems: 'center', paddingTop: 18 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CBD5E1' },
  tlDotExam: { backgroundColor: '#8B5CF6' },
  tlLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 6, minHeight: 16 },
  tlBody: { flex: 1, paddingVertical: 14, gap: 6 },
  tlBodyBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tlTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tlDate: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  tlTime: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  tlChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tlChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  tlChipText: { fontSize: 11, fontWeight: '700' },
  tlMeta: { fontSize: 13, color: '#94A3B8' },
  tlNote: { fontSize: 14, color: '#1A1A2E', lineHeight: 20 },
  tlNoteEmpty: { color: '#9CA3AF', fontStyle: 'italic' },

  // Floating contact buttons (no bar — each floats with its own shadow)
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 30, paddingTop: 8,
  },
  callBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 8,
  },
  waBtn: {
    height: 56, borderRadius: 28, backgroundColor: '#1A1A2E', paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  waBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
