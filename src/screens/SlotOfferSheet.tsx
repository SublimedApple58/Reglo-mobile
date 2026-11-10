/**
 * «Si è liberato un posto» — offerta di uno slot liberato da un annullamento
 * (prenotazione «solo eccezioni», eccezione `slotFill`; vale anche in modalità
 * aperta). Rotta `/(tabs)/home/slot-offer?offerId=…` (FORM_SHEET), aperta da
 * `NotificationOverlay` (push `slot_fill_offer` a caldo e a freddo, posta,
 * apertura automatica).
 *
 * Stati (anteprime approvate mob-6a…6f), tutti in dissolvenza (`contentKey`):
 *   loading  → scheletro della stessa forma, CTA spenta
 *   offer    → campanella, ora grande, minuti rimasti con la barra, righe, CTA
 *   overlap  → hai già una guida in quella fascia: «Chiudi»
 *   taken    → «Per un soffio!» + altri posti liberi (offerte, gruppi, ultimo minuto)
 *   expired  → «Tempo scaduto»
 *   success  → «È tua, Luca!» (sostituisce BookingCelebration in questo flusso)
 *
 * Niente optimistic update: lo stato cambia solo sulla risposta del server.
 * Il server nasconde dall'elenco le offerte scadute, prese o sovrapposte a una
 * guida: per dire PERCHÉ un'offerta non c'è più si usano i suggerimenti della
 * notifica (`startsAt`, `endsAt`, `expiresAt`) e le guide dell'allievo.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClaySurface } from '../components/clay';
import { Icon3D } from '../components/clay/Icon3D';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { useBookingOptions } from '../hooks/queries/useBookingOptions';
import { regloApi } from '../services/regloApi';
import { notificationEvents } from '../services/notificationEvents';
import { CLAY, CLAY_SHADOW } from '../theme';
import { MORALE_ART } from '../theme/moraleArt';
import { VITA_ART } from '../theme/vitaArt';
import type {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaStudent,
  AutoscuolaWaitlistOfferWithSlot,
  StudentBookingPolicy,
} from '../types/regloApi';
import { resolveStudentBookingPolicy } from '../utils/studentBookingPolicy';
import { SOFT_SWAP_IN } from '../utils/motion';
import {
  CenteredState,
  InitialsFace,
  KvList,
  KvSkeletonList,
  OFFER_BELL_ART,
  PEOPLE_ART,
  SuccessBody,
  SuccessCover,
  dayWithNumber,
  dayWord,
  findLinkedStudent,
  firstNameOf,
  hm,
  localDateKey,
  longDate,
  markOfferAccepted,
  readAcceptedOfferIds,
  useInvalidateAfterBooking,
  type KvItem,
  type SuccessInfo,
} from './bookingExceptionParts';

type Hint = { startsAt?: string; endsAt?: string; expiresAt?: string };
type Alternative = { key: string; title: string; subtitle: string; art: ImageSourcePropType; open: () => void };
type Lesson = { startsAt: string; endsAt: string | null };

type State =
  | { kind: 'loading' }
  | { kind: 'offer'; offer: AutoscuolaWaitlistOfferWithSlot }
  | { kind: 'overlap'; slot: { startsAt: string; endsAt: string | null; sentAt?: string; expiresAt?: string }; lesson: Lesson | null }
  | { kind: 'taken'; race: boolean; alternatives: Alternative[] | null }
  | { kind: 'expired' }
  | { kind: 'success'; info: SuccessInfo }
  | { kind: 'error'; message: string };

const N = ReduceMotion.Never;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const overlaps = (a: Lesson, startsAt: string, endsAt: string | null) => {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : aStart + 30 * 60_000;
  const bStart = new Date(startsAt).getTime();
  const bEnd = endsAt ? new Date(endsAt).getTime() : bStart + 30 * 60_000;
  return bStart < aEnd && bEnd > aStart;
};

export default function SlotOfferSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    offerId?: string;
    studentId?: string;
    startsAt?: string;
    endsAt?: string;
    expiresAt?: string;
    accepted?: string;
  }>();
  const { user } = useSession();

  const [offerId, setOfferId] = useState(() => str(params.offerId) ?? '');
  const [hint, setHint] = useState<Hint>(() => ({
    startsAt: str(params.startsAt),
    endsAt: str(params.endsAt),
    expiresAt: str(params.expiresAt),
  }));
  const [student, setStudent] = useState<AutoscuolaStudent | null>(null);
  const [studentId, setStudentId] = useState<string | null>(() => str(params.studentId) ?? null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const offersRef = useRef<AutoscuolaWaitlistOfferWithSlot[]>([]);

  const optionsQuery = useBookingOptions(studentId);
  const policy = useMemo(() => resolveStudentBookingPolicy(optionsQuery.data), [optionsQuery.data]);
  const invalidateAfterBooking = useInvalidateAfterBooking();

  // Allievo collegato: dall'overlay arriva già l'id; il profilo (nome, patente)
  // serve per il successo e si carica in parallelo.
  useEffect(() => {
    let alive = true;
    regloApi
      .getStudents()
      .then((list) => {
        if (!alive) return;
        const linked = findLinkedStudent(list, user);
        setStudent(linked);
        setStudentId((prev) => prev ?? linked?.id ?? null);
        if (!linked && !str(params.studentId)) setState({ kind: 'error', message: 'Profilo allievo non trovato.' });
      })
      .catch(() => {
        if (alive && !str(params.studentId)) setState({ kind: 'error', message: 'Controlla la connessione e riprova.' });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const studentLessonsAround = useCallback(
    async (sid: string, startsAt: string) => {
      const day = new Date(startsAt);
      const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const to = new Date(from.getTime() + 86_400_000);
      const list = await regloApi.getAppointments({
        studentId: sid,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 50,
      });
      return list.filter((a) => a.status !== 'cancelled' && a.type !== 'exam');
    },
    [],
  );

  const successFrom = useCallback(
    (appt: Pick<AutoscuolaAppointmentWithRelations, 'startsAt' | 'endsAt'> & Partial<AutoscuolaAppointmentWithRelations>, locationName?: string | null): SuccessInfo => ({
      firstName: student?.firstName ?? firstNameOf(user?.name),
      startsAt: appt.startsAt,
      endsAt: appt.endsAt ?? null,
      instructorName: appt.instructor?.name ?? null,
      vehicleName: appt.vehicle?.name ?? null,
      vehicleColor: appt.vehicle?.color ?? null,
      locationName: appt.location?.name ?? locationName ?? null,
      licenseCategory: appt.vehicle?.licenseCategory ?? student?.licenseCategory ?? null,
    }),
    [student, user?.name],
  );

  // ── Altri posti liberi («Per un soffio!») ──
  const loadAlternatives = useCallback(
    async (sid: string, exclude: string, pol: StudentBookingPolicy | null) => {
      const out: Alternative[] = [];
      const freshOffers = await regloApi.getWaitlistOffers(sid, 10).catch(() => offersRef.current);
      offersRef.current = freshOffers;
      for (const o of freshOffers) {
        if (o.id === exclude) continue;
        out.push({
          key: `offer-${o.id}`,
          title: `${dayWithNumber(o.slot.startsAt)} · ${hm(o.slot.startsAt)}`,
          subtitle: 'Si è liberato un posto',
          art: OFFER_BELL_ART,
          open: () => {
            setOfferId(o.id);
            setHint({ startsAt: o.slot.startsAt, endsAt: o.slot.endsAt, expiresAt: o.expiresAt });
            setState({ kind: 'offer', offer: o });
          },
        });
      }
      const groupsOn = !pol || (!pol.hold && (pol.mode === 'open' || (pol.mode === 'exceptions' && pol.exceptions.groupSeats)));
      if (groupsOn) {
        const invites = await regloApi.getGroupLessonInvites(sid, 5).catch(() => []);
        for (const g of invites) {
          if (g.bookable === false || g.openSeats <= 0) continue;
          out.push({
            key: `group-${g.inviteId ?? g.groupLessonId}`,
            title: `${dayWithNumber(g.startsAt)} · ${hm(g.startsAt)}`,
            subtitle: g.kind === 'moto' ? 'Guida di gruppo moto' : 'Guida di gruppo',
            art: PEOPLE_ART,
            open: () => {
              router.back();
              setTimeout(() => router.push('/(tabs)/home/group-lesson-invites'), 350);
            },
          });
        }
      }
      const lastMinuteOn = !!pol && !pol.hold && pol.mode === 'exceptions' && pol.exceptions.lastMinute;
      if (lastMinuteOn) {
        const durations = optionsQuery.data?.bookingSlotDurations ?? [60];
        const slots = await regloApi
          .getAvailableSlots({ studentId: sid, date: localDateKey(new Date()), durationMinutes: durations[0] ?? 60 })
          .catch(() => []);
        const first = slots.find((sl) => new Date(sl.startsAt).getTime() > Date.now());
        if (first) {
          out.push({
            key: `lm-${first.startsAt}`,
            title: `Oggi · ${hm(first.startsAt)}`,
            subtitle: first.locationName ? `Ultimo minuto · ${first.locationName}` : 'Ultimo minuto',
            art: VITA_ART.orologio,
            open: () => router.replace('/(tabs)/home/last-minute'),
          });
        }
      }
      return out.slice(0, 3);
    },
    [optionsQuery.data?.bookingSlotDurations, router],
  );

  const showTaken = useCallback(
    (sid: string, race: boolean) => {
      setState({ kind: 'taken', race, alternatives: null });
      loadAlternatives(sid, offerId, policy)
        .then((alternatives) =>
          setState((prev) => (prev.kind === 'taken' ? { ...prev, alternatives } : prev)),
        )
        .catch(() => setState((prev) => (prev.kind === 'taken' ? { ...prev, alternatives: [] } : prev)));
    },
    [loadAlternatives, offerId, policy],
  );

  // ── Caricamento dell'offerta ──
  const load = useCallback(async () => {
    if (!studentId || !offerId) return;
    setInlineError(null);
    try {
      const [offers, accepted] = await Promise.all([
        regloApi.getWaitlistOffers(studentId, 20),
        readAcceptedOfferIds(),
      ]);
      offersRef.current = offers;
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        if (new Date(offer.expiresAt).getTime() <= Date.now()) setState({ kind: 'expired' });
        else setState({ kind: 'offer', offer });
        return;
      }
      // Non è più nell'elenco: scaduta, presa, sovrapposta o già accettata da te.
      if ((accepted.has(offerId) || params.accepted === '1') && hint.startsAt) {
        const lessons = await studentLessonsAround(studentId, hint.startsAt);
        const mine = lessons.find((l) => l.startsAt === hint.startsAt) ?? lessons.find((l) => overlaps(l, hint.startsAt!, hint.endsAt ?? null));
        if (mine) {
          setState({ kind: 'success', info: successFrom(mine) });
          return;
        }
      }
      if (hint.expiresAt && new Date(hint.expiresAt).getTime() <= Date.now()) {
        setState({ kind: 'expired' });
        return;
      }
      if (hint.startsAt) {
        const lessons = await studentLessonsAround(studentId, hint.startsAt).catch(() => []);
        const clash = lessons.find((l) => overlaps(l, hint.startsAt!, hint.endsAt ?? null));
        if (clash) {
          setState({
            kind: 'overlap',
            slot: { startsAt: hint.startsAt, endsAt: hint.endsAt ?? null, expiresAt: hint.expiresAt },
            lesson: { startsAt: clash.startsAt, endsAt: clash.endsAt },
          });
          return;
        }
      }
      showTaken(studentId, false);
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error && err.message !== 'Request failed' ? err.message : 'Controlla la connessione e riprova.' });
    }
  }, [studentId, offerId, hint, params.accepted, studentLessonsAround, successFrom, showTaken]);

  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!studentId || !offerId) return;
    const key = `${studentId}|${offerId}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void load();
  }, [studentId, offerId, load]);

  // ── Prendi questa guida ──
  const accept = useCallback(async () => {
    if (state.kind !== 'offer' || !studentId || accepting || declining) return;
    const offer = state.offer;
    setAccepting(true);
    setInlineError(null);
    try {
      const res = await regloApi.respondWaitlistOffer(offer.id, { studentId, response: 'accept' });
      if (!res.accepted) {
        showTaken(studentId, true);
        return;
      }
      await markOfferAccepted(offer.id);
      // Dettagli veri (istruttore, veicolo, luogo) dalla guida appena creata.
      let info = successFrom(res.appointment, offer.locationName);
      try {
        const lessons = await studentLessonsAround(studentId, res.appointment.startsAt);
        const created = lessons.find((l) => l.id === res.appointment.id);
        if (created) info = successFrom(created, offer.locationName);
      } catch {
        // il successo resta con i dati della risposta
      }
      await invalidateAfterBooking();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setState({ kind: 'success', info });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/già una guida/i.test(msg)) {
        const lessons = await studentLessonsAround(studentId, offer.slot.startsAt).catch(() => []);
        const clash = lessons.find((l) => overlaps(l, offer.slot.startsAt, offer.slot.endsAt));
        setState({
          kind: 'overlap',
          slot: { startsAt: offer.slot.startsAt, endsAt: offer.slot.endsAt, sentAt: offer.sentAt, expiresAt: offer.expiresAt },
          lesson: clash ? { startsAt: clash.startsAt, endsAt: clash.endsAt } : null,
        });
      } else if (/non più valida|non trovata/i.test(msg)) {
        if (new Date(offer.expiresAt).getTime() <= Date.now() + 5_000) setState({ kind: 'expired' });
        else showTaken(studentId, true);
      } else if (/slot non disponibile/i.test(msg)) {
        showTaken(studentId, true);
      } else {
        setInlineError(msg && msg !== 'Request failed' ? msg : 'Non è andata. Controlla la connessione e riprova.');
      }
    } finally {
      setAccepting(false);
    }
  }, [state, studentId, accepting, declining, showTaken, successFrom, studentLessonsAround, invalidateAfterBooking]);

  // ── No, grazie ──
  const decline = useCallback(async () => {
    if (state.kind !== 'offer' || !studentId || accepting || declining) return;
    setDeclining(true);
    setInlineError(null);
    try {
      await regloApi.respondWaitlistOffer(state.offer.id, { studentId, response: 'decline' });
      notificationEvents.requestRefresh();
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/non più valida|non trovata|già risposto/i.test(msg)) {
        router.back();
        return;
      }
      setInlineError(msg && msg !== 'Request failed' ? msg : 'Non è andata. Controlla la connessione e riprova.');
    } finally {
      setDeclining(false);
    }
  }, [state, studentId, accepting, declining, router]);

  const onExpire = useCallback(() => {
    setState((prev) => (prev.kind === 'offer' && !accepting ? { kind: 'expired' } : prev));
  }, [accepting]);

  // ── Righe dell'offerta: solo quello che il server sa prima dell'assegnazione ──
  const offerRows = useMemo<KvItem[]>(() => {
    if (state.kind !== 'offer') return [];
    const rows: KvItem[] = [];
    const opts = optionsQuery.data;
    if (opts?.isLockedToInstructor && opts.assignedInstructorName) {
      rows.push({
        key: 'instr',
        label: 'Istruttore',
        value: (
          <>
            <InitialsFace name={opts.assignedInstructorName} />
            <Text style={s.kvValue} numberOfLines={1}>
              {opts.assignedInstructorName}
            </Text>
          </>
        ),
      });
    }
    if (state.offer.locationName) rows.push({ key: 'loc', label: 'Luogo', value: state.offer.locationName });
    return rows;
  }, [state, optionsQuery.data]);

  const busy = accepting || declining;
  const titled = state.kind === 'loading' || state.kind === 'offer' || state.kind === 'overlap' || state.kind === 'error';

  // ── Testata, centro, CTA per stato ──
  let subtitle: React.ReactNode;
  let body: React.ReactNode;
  let cta: React.ReactNode;
  let leading: React.ReactNode;

  switch (state.kind) {
    case 'loading':
      subtitle = <SkeletonBlock width={230} height={12} radius={6} style={s.skSub} />;
      body = (
        <View testID="slot-offer-skeleton">
          <ClaySurface padded={false} style={s.hero}>
            <SkeletonBlock width={78} height={78} radius={24} />
            <View style={s.heroMain}>
              <SkeletonBlock width={130} height={12} radius={6} />
              <SkeletonBlock width={150} height={30} radius={10} style={{ marginTop: 10 }} />
              <SkeletonBlock height={6} radius={3} style={{ marginTop: 14 }} />
            </View>
          </ClaySurface>
          <KvSkeletonList labels={['Istruttore', 'Veicolo', 'Luogo']} widths={[120, 104, 170]} style={s.gap} />
        </View>
      );
      cta = (
        <View pointerEvents="none" style={s.ctaDim}>
          <ClayButton title="Prendi questa guida" />
          <View style={s.textBtn}>
            <Text style={s.textBtnTx}>No, grazie</Text>
          </View>
        </View>
      );
      break;
    case 'offer':
      subtitle = 'Vince chi conferma per primo';
      body = (
        <View testID="slot-offer">
          <OfferHero
            startsAt={state.offer.slot.startsAt}
            endsAt={state.offer.slot.endsAt}
            sentAt={state.offer.sentAt}
            expiresAt={state.offer.expiresAt}
            onExpire={onExpire}
          />
          <KvList items={offerRows} style={s.gap} />
          {inlineError ? <Text style={s.error}>{inlineError}</Text> : null}
        </View>
      );
      cta = (
        <View>
          <ClayButton
            title="Prendi questa guida"
            onPress={accept}
            loading={accepting}
            disabled={declining}
            testID="slot-offer-accept"
          />
          <Pressable
            onPress={decline}
            disabled={busy}
            style={({ pressed }) => [s.textBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityState={{ busy: declining }}
            testID="slot-offer-decline"
          >
            {declining ? <ActivityIndicator color={CLAY.ink3} /> : <Text style={s.textBtnTx}>No, grazie</Text>}
          </Pressable>
        </View>
      );
      break;
    case 'overlap': {
      subtitle = 'Vince chi conferma per primo';
      const l = state.lesson;
      const text = l
        ? `${dayWord(l.startsAt)} sei già in guida dalle ${hm(l.startsAt)}${l.endsAt ? ` alle ${hm(l.endsAt)}` : ''}, quindi questo posto non puoi prenderlo.`
        : 'A quell’ora sei già in guida, quindi questo posto non puoi prenderlo.';
      body = (
        <View testID="slot-offer-overlap">
          <OfferHero
            startsAt={state.slot.startsAt}
            endsAt={state.slot.endsAt}
            sentAt={state.slot.sentAt}
            expiresAt={state.slot.expiresAt}
          />
          <ClaySurface padded={false} style={[s.gap, s.warn]}>
            <Icon3D source={VITA_ART.calendario} size={44} />
            <Text style={s.warnTx}>{text}</Text>
          </ClaySurface>
        </View>
      );
      cta = <ClayButton title="Chiudi" variant="secondary" onPress={() => router.back()} />;
      break;
    }
    case 'taken': {
      const alts = state.alternatives;
      const count = alts?.length ?? 0;
      const lead = state.race ? "Un altro allievo l'ha preso qualche secondo prima di te." : "Un altro allievo l'ha preso prima di te.";
      const more =
        alts === null
          ? ''
          : count === 0
            ? ' Al prossimo ti avvisiamo subito.'
            : count === 1
              ? " Ma c'è ancora un posto libero:"
              : ` Ma ci sono ancora ${count === 2 ? 'due' : 'tre'} posti liberi:`;
      body = (
        <View testID="slot-offer-taken">
          <CenteredState art={MORALE_ART.espresso} artSize={96} title="Per un soffio!" text={`${lead}${more}`} />
          {alts === null ? (
            <View style={{ height: 8 }} />
          ) : count ? (
            <ClayList style={{ marginTop: 18 }}>
              {alts.map((a) => (
                <ClayListRow
                  key={a.key}
                  leading={<Icon3D source={a.art} size={36} />}
                  title={a.title}
                  subtitle={a.subtitle}
                  onPress={a.open}
                />
              ))}
            </ClayList>
          ) : null}
        </View>
      );
      cta = <ClayButton title="Chiudi" variant="secondary" onPress={() => router.back()} />;
      break;
    }
    case 'expired':
      body = (
        <CenteredState
          art={VITA_ART.orologio}
          title="Tempo scaduto"
          text="Un posto liberato resta aperto 15 minuti, e questo è passato. Al prossimo ti avvisiamo subito: tieni attive le notifiche."
          testID="slot-offer-expired"
        />
      );
      cta = <ClayButton title="Ho capito" variant="secondary" onPress={() => router.back()} />;
      break;
    case 'success':
      leading = <SuccessCover licenseCategory={state.info.licenseCategory} vehicleColor={state.info.vehicleColor} />;
      body = <SuccessBody info={state.info} />;
      cta = <ClayButton title="Fatto" onPress={() => router.back()} testID="slot-offer-done" />;
      break;
    case 'error':
      subtitle = undefined;
      body = (
        <View testID="slot-offer-error">
          <Text style={s.stateTitle}>Offerta non caricata</Text>
          <Text style={s.stateTx}>{state.message}</Text>
        </View>
      );
      cta = (
        <ClayButton
          title="Riprova"
          variant="secondary"
          onPress={() => {
            setState({ kind: 'loading' });
            loadedFor.current = null;
            void load();
          }}
        />
      );
      break;
  }

  return (
    <FormSheet
      title={
        titled ? (
          <Animated.Text entering={SOFT_SWAP_IN} style={s.title} numberOfLines={2}>
            Si è liberato un posto
          </Animated.Text>
        ) : undefined
      }
      subtitle={typeof subtitle === 'string' ? <Text style={s.subtitle}>{subtitle}</Text> : subtitle}
      leading={leading}
      contentKey={state.kind}
      cta={cta}
      busy={busy}
      testID="slot-offer-sheet"
    >
      {body}
    </FormSheet>
  );
}

/**
 * Campanella + ora grande + minuti rimasti. Solo questa parte si ridisegna
 * col tempo (una volta al secondo per il testo); la barra scende da sola sul
 * thread UI, lineare fino alla scadenza.
 */
const OfferHero = memo(function OfferHero({
  startsAt,
  endsAt,
  sentAt,
  expiresAt,
  onExpire,
}: {
  startsAt: string;
  endsAt: string | null;
  sentAt?: string;
  expiresAt?: string;
  onExpire?: () => void;
}) {
  return (
    <ClaySurface padded={false} style={s.hero}>
      <Icon3D source={OFFER_BELL_ART} size={78} />
      <View style={s.heroMain}>
        <Text style={s.when}>{longDate(startsAt)}</Text>
        <Text style={s.hour}>
          {hm(startsAt)}
          {endsAt ? <Text style={s.hourEnd}>{`  – ${hm(endsAt)}`}</Text> : null}
        </Text>
        {expiresAt ? <Countdown sentAt={sentAt} expiresAt={expiresAt} onExpire={onExpire} /> : null}
      </View>
    </ClaySurface>
  );
});

function Countdown({ sentAt, expiresAt, onExpire }: { sentAt?: string; expiresAt: string; onExpire?: () => void }) {
  const end = new Date(expiresAt).getTime();
  const start = sentAt ? new Date(sentAt).getTime() : end - 15 * 60_000;
  const total = Math.max(1, end - start);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, end - now);
  const progress = useSharedValue(Math.min(1, left / total));

  useEffect(() => {
    const remaining = Math.max(0, end - Date.now());
    progress.value = Math.min(1, remaining / total);
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear, reduceMotion: N });
  }, [end, total, progress]);

  const firedRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left > 0 || firedRef.current) return;
    firedRef.current = true;
    onExpire?.();
  }, [left, onExpire]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const minutes = Math.ceil(left / 60_000);
  const label = left < 60_000 ? 'meno di un minuto' : minutes === 1 ? '1 minuto' : `${minutes} minuti`;

  return (
    <>
      <Text style={s.left}>
        Ancora <Text style={s.leftStrong}>{label}</Text>
      </Text>
      <View style={s.track}>
        <Animated.View style={[s.fill, bar]} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, lineHeight: 20 },
  skSub: { marginTop: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 18 },
  heroMain: { flex: 1, minWidth: 0 },
  when: { fontSize: 13.5, color: CLAY.ink3 },
  hour: { fontSize: 34, fontWeight: '600', letterSpacing: -1.2, lineHeight: 38, color: CLAY.ink, fontVariant: ['tabular-nums'] },
  hourEnd: { fontSize: 16, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.2 },
  left: { fontSize: 13, color: CLAY.ink3, marginTop: 8 },
  leftStrong: { color: CLAY.ink, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', overflow: 'hidden', marginTop: 6, ...CLAY_SHADOW.sink },
  fill: { flex: 1, backgroundColor: CLAY.ink, borderRadius: 2, transformOrigin: 'left' },
  gap: { marginTop: 14 },
  kvValue: { flexShrink: 1, fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  warnTx: { flex: 1, fontSize: 15, lineHeight: 21, color: CLAY.ink },
  error: { fontSize: 14, lineHeight: 19, color: CLAY.ink2, marginTop: 12, textAlign: 'center' },
  ctaDim: { opacity: 0.35 },
  textBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  textBtnTx: { fontSize: 16, fontWeight: '500', color: CLAY.ink3 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  stateTx: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
});
