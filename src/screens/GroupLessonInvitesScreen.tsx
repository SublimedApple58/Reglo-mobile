import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { ClayLargeTitle, ClayNavBar, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { ClayButton, ClayEmpty, ClaySurface } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { CLAY } from '../theme/clay';
import { MORALE_ART } from '../theme/moraleArt';
import { MOTO_LESSON_TYPE_LABELS, MOTO_LESSON_TYPE_HINTS } from '../utils/motoLessonType';
import { bookingHoldMessage, resolveStudentBookingPolicy } from '../utils/studentBookingPolicy';
import type { AutoscuolaStudent, GroupLessonInvite } from '../types/regloApi';

const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const findLinkedStudent = (students: AutoscuolaStudent[], user: { name: string | null; email: string } | null) => {
  if (!user) return null;
  const byEmail = students.find((s) => normalize(s.email) === normalize(user.email));
  if (byEmail) return byEmail;
  const n = normalize(user.name);
  if (!n) return null;
  return students.find((s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === n) ?? null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const fmtDate = (startsAt: string) => {
  const d = new Date(startsAt);
  return cap(d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
};

const fmtTimeRange = (startsAt: string, endsAt: string | null) => {
  const s = new Date(startsAt);
  const start = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
  if (!endsAt) return start;
  const e = new Date(endsAt);
  const end = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
  const hours = (e.getTime() - s.getTime()) / 3600000;
  if (hours <= 0) return `${start} – ${end}`;
  const label = Number.isInteger(hours)
    ? `${hours} ${hours === 1 ? 'ora' : 'ore'}`
    : `${hours.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ore`;
  return `${start} – ${end} · ${label}`;
};

/** «1 posto libero su 4», «Ultimo posto libero». */
const seatsLabel = (inv: GroupLessonInvite) => {
  const free = Math.max(inv.openSeats ?? inv.capacity - inv.filledSeats, 0);
  if (free === 1) return `Ultimo posto libero su ${inv.capacity}`;
  return `${free} posti liberi su ${inv.capacity}`;
};

/** Testo quando l'allievo vede la guida ma non può prenderla (bookable false). */
const FALLBACK_HOLD = 'Per ora non puoi prendere questo posto dall’app. Chiedi in segreteria.';

const FADE = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);

/**
 * «Guide di gruppo» dell'allievo: i posti liberi che può prendere (REG-639
 * clay, feature «solo eccezioni»). Se la modalità dell'autoscuola non consente
 * i posti di gruppo il server restituisce già l'elenco vuoto.
 */
export const GroupLessonInvitesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { scrollY, onScroll } = useLargeTitleScroll();

  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [invites, setInvites] = useState<GroupLessonInvite[]>([]);
  const [holdText, setHoldText] = useState<string>(FALLBACK_HOLD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const studentId = useMemo(() => findLinkedStudent(students, user)?.id ?? null, [students, user]);

  useEffect(() => {
    regloApi
      .getStudents()
      .then(setStudents)
      .catch(() => {})
      .finally(() => setStudentsLoaded(true));
  }, []);

  const load = useCallback(async (sid: string) => {
    try {
      // 100 (era 20): con 3-4 guide di gruppo al giorno il cap a 20 nascondeva
      // tutto oltre ~2 settimane (segnalazione Robatto, 2026-07-06).
      const res = await regloApi.getGroupLessonInvites(sid, 100);
      setInvites(res);
      // Perché non può prenderli, a parole: lo dice il server (bookingPolicy).
      if (res.some((i) => i.bookable === false)) {
        const opts = await regloApi.getBookingOptions(sid).catch(() => null);
        const hold = resolveStudentBookingPolicy(opts)?.hold ?? null;
        setHoldText(bookingHoldMessage(hold) ?? FALLBACK_HOLD);
      }
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'Errore nel caricamento', tone: 'danger' });
    }
  }, []);

  useEffect(() => {
    // Lo scheletro resta finché non sappiamo chi è l'allievo: altrimenti lo
    // stato vuoto lampeggia mentre getStudents() è ancora in volo.
    if (!studentsLoaded) return;
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load(studentId).finally(() => setLoading(false));
  }, [studentsLoaded, studentId, load]);

  const onRefresh = useCallback(async () => {
    if (!studentId) return;
    setRefreshing(true);
    await load(studentId);
    setRefreshing(false);
  }, [studentId, load]);

  const respond = useCallback(
    async (invite: GroupLessonInvite, response: 'accept' | 'decline') => {
      if (!studentId || pendingId) return;
      setPendingId(invite.inviteId);
      try {
        const res = await regloApi.respondGroupLessonInvite(invite.inviteId, { studentId, response });
        setInvites((prev) => prev.filter((i) => i.inviteId !== invite.inviteId));
        setToast({
          text: response === 'accept' && res.accepted ? 'Ci sei! Ti abbiamo iscritto alla guida.' : 'Va bene, non te la riproponiamo.',
          tone: 'success',
        });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : 'Errore.', tone: 'danger' });
      } finally {
        setPendingId(null);
      }
    },
    [studentId, pendingId],
  );

  const renderItem = useCallback(
    ({ item }: { item: GroupLessonInvite }) => (
      <InviteCard
        invite={item}
        holdText={holdText}
        pending={pendingId === item.inviteId}
        busy={pendingId !== null}
        onRespond={respond}
      />
    ),
    [holdText, pendingId, respond],
  );

  const bookableCount = invites.filter((i) => i.bookable !== false).length;
  const subtitle = loading
    ? null
    : invites.length === 0
      ? 'Posti liberi nelle guide di gruppo'
      : bookableCount === 0
        ? 'Per ora non puoi prenderli'
        : bookableCount === 1
          ? '1 posto che puoi prendere'
          : `${bookableCount} guide con posti liberi`;

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home'));

  return (
    <View style={s.root}>
      <ClayNavBar title="Guide di gruppo" scrollY={scrollY} onBack={goBack} />
      <Animated.FlatList
        data={loading ? EMPTY : invites}
        keyExtractor={keyOf}
        renderItem={renderItem}
        extraData={pendingId}
        ListHeaderComponent={<ClayLargeTitle title="Guide di gruppo" subtitle={subtitle} />}
        ListEmptyComponent={
          loading ? (
            <InvitesSkeleton />
          ) : (
            <Animated.View entering={FADE}>
              <ClayEmpty
                icon={MORALE_ART.piantina}
                title="Nessun posto libero, per ora"
                text="Quando si libera un posto in una guida di gruppo te lo diciamo con una notifica, e lo trovi qui."
                testID="group-invites-empty"
              />
            </Animated.View>
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        initialNumToRender={4}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />}
        testID="group-invites-list"
      />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </View>
  );
};

const EMPTY: GroupLessonInvite[] = [];
const keyOf = (inv: GroupLessonInvite) => inv.inviteId;

/**
 * Una guida di gruppo con posti liberi. Se l'allievo non può prenderla
 * (`bookable === false`) la card resta visibile ma spenta, senza CTA, e dice
 * perché con una frase (niente pillole).
 */
const InviteCard = React.memo(function InviteCard({
  invite: inv,
  holdText,
  pending,
  busy,
  onRespond,
}: {
  invite: GroupLessonInvite;
  holdText: string;
  pending: boolean;
  busy: boolean;
  onRespond: (invite: GroupLessonInvite, response: 'accept' | 'decline') => void;
}) {
  const blocked = inv.bookable === false;
  const details: string[] = [];
  if (inv.instructorName) details.push(`Con ${inv.instructorName}`);
  if (inv.kind === 'moto') details.push('La moto te la assegniamo noi');
  else if (inv.vehicleName) details.push(inv.vehicleName);
  if (inv.kind === 'moto' && inv.motoLessonType) {
    details.push(`${MOTO_LESSON_TYPE_LABELS[inv.motoLessonType]} · ${MOTO_LESSON_TYPE_HINTS[inv.motoLessonType]}`);
  }

  return (
    <Animated.View entering={FADE} style={s.cardWrap}>
      <ClaySurface testID={`group-invite-${inv.inviteId}`}>
        <View style={blocked ? s.off : undefined} accessibilityState={{ disabled: blocked }}>
          <Text style={s.when}>{fmtDate(inv.startsAt)}</Text>
          <Text style={s.whenSub}>{fmtTimeRange(inv.startsAt, inv.endsAt)}</Text>
          <View style={s.details}>
            {details.map((d, i) => (
              <Text key={i} style={s.detail} numberOfLines={2}>
                {d}
              </Text>
            ))}
            <Text style={s.seats}>{seatsLabel(inv)}</Text>
          </View>
        </View>

        {blocked ? (
          <Text style={s.holdText} testID={`group-invite-hold-${inv.inviteId}`}>
            {holdText}
          </Text>
        ) : (
          <View style={s.actions}>
            <ClayButton
              title="Prendi il posto"
              loading={pending}
              disabled={busy && !pending}
              onPress={() => onRespond(inv, 'accept')}
              testID={`group-invite-accept-${inv.inviteId}`}
            />
            <Pressable
              onPress={() => onRespond(inv, 'decline')}
              disabled={busy}
              hitSlop={6}
              style={({ pressed }) => [s.ghost, pressed && s.ghostPressed]}
              accessibilityRole="button"
              testID={`group-invite-decline-${inv.inviteId}`}
            >
              <Text style={s.ghostText}>Non mi interessa</Text>
            </Pressable>
          </View>
        )}
      </ClaySurface>
    </Animated.View>
  );
});

function InvitesSkeleton() {
  return (
    <View>
      {[0, 1].map((i) => (
        <View key={i} style={s.cardWrap}>
          <ClaySurface>
            <SkeletonBlock width="60%" height={22} radius={8} />
            <SkeletonBlock width="40%" height={14} radius={6} style={s.skelGap} />
            <SkeletonBlock width="70%" height={14} radius={6} style={s.skelGapLg} />
            <SkeletonBlock height={54} radius={27} style={s.skelGapLg} />
          </ClaySurface>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  cardWrap: { marginTop: 18 },

  when: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, lineHeight: 27 },
  whenSub: { fontSize: 15, color: CLAY.ink3, marginTop: 3 },
  details: { marginTop: 14, gap: 4 },
  detail: { fontSize: 15, lineHeight: 21, color: CLAY.ink2 },
  seats: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: CLAY.ink, marginTop: 2 },

  off: { opacity: 0.45 },
  holdText: { fontSize: 15, lineHeight: 21, color: CLAY.ink2, marginTop: 16 },

  actions: { marginTop: 18 },
  ghost: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ghostPressed: { opacity: 0.5 },
  ghostText: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },

  skelGap: { marginTop: 8 },
  skelGapLg: { marginTop: 18 },
});
