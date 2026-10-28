import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';

import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from '../utils/haptics';
import { FormSheet, useSheetAnticipate } from '../components/SheetScaffold';
import { PaymentsFilterSegmented } from '../components/PaymentsFilter';
import {
  CLAY_ROW_PRESSED,
  ClayEmpty,
  ClayList,
  Icon3D,
  ClaySection,
  ClaySegmented,
  clayRowPadding,
  markClayRow,
} from '../components/clay';
import type { ClayRowPosition } from '../components/clay';
import { studentPaymentsStore } from '../stores/studentPaymentsStore';
import { paymentHistoryStore } from '../stores/paymentHistoryStore';
import { regloApi } from '../services/regloApi';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';

import { formatTime } from '../utils/date';
import { LESSON_TYPE_LABEL_MAP } from '../utils/lessonTypes';
import {
  canToggleLessonPayment,
  isCompanyManualMode,
  isLessonUnpaid,
  isPenaltyCharged,
  isPenaltyPaid,
} from '../utils/lessonPayments';
import { formatEuro } from '../components/ledger/LedgerUI';
import type { AutoscuolaAppointmentWithRelations, PaymentHistoryEvent } from '../types/regloApi';

/**
 * Filtri di Pagamenti (REG-639, scelto da Tiziano il 28/10: segmentato nativo
 * a tre voci). Predicati gemelli del dettaglio allievo web.
 */
type LessonFilter = 'all' | 'upcoming' | 'unpaid' | 'paid' | 'cancelled';

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const DONE = ['completed', 'checked_in'];
const MISSED = ['cancelled', 'no_show'];
const FUTURE = ['scheduled', 'confirmed'];

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** «gio 1 ottobre» (con l'anno se non è quello in corso). */
const oldestLabel = (iso: string) => {
  const d = new Date(iso);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${WEEKDAYS[d.getDay()].toLowerCase()} ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}${year}`;
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    ? MONTHS[d.getMonth()]
    : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Annullamento oltre la soglia di preavviso. Stessa condizione del dettaglio
 * allievo web: non basta che la guida sia annullata, deve esserlo DOPO il
 * `penaltyCutoffAt`.
 */
const isLate = (l: AutoscuolaAppointmentWithRelations) => {
  if (!l.cancelledAt || !l.penaltyCutoffAt) return false;
  return new Date(l.cancelledAt).getTime() > new Date(l.penaltyCutoffAt).getTime();
};

/** Etichetta di stato della guida, con lo stesso vocabolario del web. */
const statusLabel = (status: string) => {
  switch (normalize(status)) {
    case 'completed':
    case 'checked_in':
      return 'Completata';
    case 'cancelled':
      return 'Annullata';
    case 'no_show':
      return 'Assente';
    case 'proposal':
      return 'Proposta';
    default:
      return 'Programmata';
  }
};

/* ──────────────────────────────── movimento ─────────────────────────────── */

/**
 * Feedback di «segna pagata» (Tiziano 28/10: la riga spariva di botto e il
 * toast compariva in mezzo al foglio). Modello Promemoria di iOS: la casella
 * si riempie di nero, la riga resta il tempo di vederla piena, poi si chiude
 * e le altre salgono senza salti; numero e salvadanaio cambiano nello stesso
 * tempo. VELOCE e fluido (Tiziano: si vede il movimento, niente attese):
 * ~200–250 ms, easing morbido, niente rimbalzi; «Riduci movimento» non spegne
 * niente (§0). Annullare: si ritocca la casella finché è lì, o da «Pagate».
 */
const NEVER = ReduceMotion.Never;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
/** Quanto resta la riga spuntata prima di uscire dal filtro. */
const HOLD_MS = 200;
const COLLAPSE_MS = 240;
/** Cambio del numero e del salvadanaio: esce + entra = durata del collapse. */
const SWAP_OUT_MS = 90;
const SWAP_IN_MS = COLLAPSE_MS - SWAP_OUT_MS;

/** Casella che si riempie: da 0.6 a 1 con la spunta, senza rimbalzo. */
const checkFill = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
    animations: {
      opacity: withTiming(1, { duration: 110, reduceMotion: NEVER }),
      transform: [{ scale: withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }) }],
    },
  };
};

/**
 * Chiude il contenuto in altezza (e in dissolvenza) quando `collapsing`:
 * l'altezza cambia fotogramma per fotogramma, così tutto quello che sta sotto
 * (righe, fondo della card, mesi, piede) sale insieme, senza salti.
 */
function Collapse({
  collapsing,
  onCollapsed,
  children,
}: {
  collapsing: boolean;
  onCollapsed?: () => void;
  children: React.ReactNode;
}) {
  const measured = useRef(0);
  const anticipate = useSheetAnticipate();
  const height = useSharedValue(-1);
  const opacity = useSharedValue(1);
  const done = useRef(onCollapsed);
  done.current = onCollapsed;
  const finish = useCallback(() => done.current?.(), []);

  useEffect(() => {
    if (!collapsing) return;
    // Il foglio si accorcia insieme alla riga, non a collapse finito.
    anticipate(measured.current);
    opacity.value = withTiming(0, { duration: COLLAPSE_MS * 0.55, easing: EASE, reduceMotion: NEVER });
    height.value = withSequence(
      withTiming(measured.current, { duration: 0, reduceMotion: NEVER }),
      withTiming(0, { duration: COLLAPSE_MS, easing: EASE, reduceMotion: NEVER }, (ok) => {
        if (ok) runOnJS(finish)();
      }),
    );
  }, [collapsing, finish, height, opacity, anticipate]);

  const style = useAnimatedStyle(() =>
    height.value < 0 ? { opacity: opacity.value } : { height: height.value, opacity: opacity.value, overflow: 'hidden' },
  );
  return (
    <Animated.View
      style={style}
      onLayout={(e) => {
        if (!collapsing) measured.current = e.nativeEvent.layout.height;
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Cambio di contenuto in dissolvenza incrociata «di passaggio»: il vecchio
 * esce (opacità, un filo verso l'alto), il nuovo entra dal basso. Per il
 * numero grande dell'hero e per il passaggio a «Tutto saldato».
 */
function FadeSwap({ swapKey, children, style }: { swapKey: string; children: React.ReactNode; style?: object }) {
  const [shown, setShown] = useState({ key: swapKey, node: children });
  const latest = useRef({ key: swapKey, node: children });
  latest.current = { key: swapKey, node: children };
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);

  const swapIn = useCallback(() => {
    setShown(latest.current);
    shift.value = 5;
    opacity.value = withTiming(1, { duration: SWAP_IN_MS, easing: EASE, reduceMotion: NEVER });
    shift.value = withTiming(0, { duration: SWAP_IN_MS, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
  }, [opacity, shift]);

  useEffect(() => {
    if (swapKey === shown.key) return;
    opacity.value = withTiming(0, { duration: SWAP_OUT_MS, easing: EASE, reduceMotion: NEVER }, (ok) => {
      if (ok) runOnJS(swapIn)();
    });
    shift.value = withTiming(-3, { duration: SWAP_OUT_MS, easing: EASE, reduceMotion: NEVER });
  }, [swapKey, shown.key, opacity, shift, swapIn]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: shift.value }] }));
  // Stesso contenuto, valori aggiornati (es. la data della più vecchia).
  const node = swapKey === shown.key ? children : shown.node;
  return <Animated.View style={[style, anim]}>{node}</Animated.View>;
}

/* ─────────────────────────────────── riga ───────────────────────────────── */

/**
 * Riga di Pagamenti (REG-639, giro dopo la prova di Tiziano): dentro una
 * `ClayList` come le altre liste. UN solo segnale di stato:
 * - guida che si può segnare → la casella a destra: vuota = da pagare, nera
 *   con la spunta = pagata. Si tocca e scrive: in attesa del BE un piccolo
 *   spinner nella casella, alla risposta si riempie (niente toast);
 * - guida che non si segna (annullata, futura, a credito, sola lettura) → lo
 *   stato a parole, in grigio («Da pagare» in nero: è quella che conta).
 * Il tocco sulla riga apre il foglio «Guida» con chi/quando e lo storico: via
 * il pallino colorato e il chip «⏱ 2 ›» sotto la riga.
 */
const PaymentRow = markClayRow(function PaymentRow({
  title,
  subtitle,
  state,
  stateStrong,
  dim,
  check,
  busy,
  fill,
  collapsing,
  onCollapsed,
  onPress,
  onToggle,
  testID,
  divider,
  ...pos
}: ClayRowPosition & {
  title: string;
  subtitle: string;
  /** Stato a parole: solo quando non c'è la casella. */
  state: string | null;
  stateStrong?: boolean;
  dim?: boolean;
  /** Casella: `paid`/`unpaid`, assente se la guida non si segna. */
  check?: 'paid' | 'unpaid' | null;
  busy?: boolean;
  /** La casella si è appena riempita/svuotata per un tocco: si anima. */
  fill?: boolean;
  /** La riga esce dal filtro: si chiude in altezza. */
  collapsing?: boolean;
  onCollapsed?: () => void;
  onPress: () => void;
  onToggle?: () => void;
  testID?: string;
}) {
  const paid = check === 'paid';
  return (
    <Collapse collapsing={!!collapsing} onCollapsed={onCollapsed}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, clayRowPadding(pos, 13), pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. ${check ? (paid ? 'Pagata' : 'Da pagare') : (state ?? '')}`}
      accessibilityHint="Apre il dettaglio della guida"
      testID={testID}
    >
      {divider ? <View style={s.divider} /> : null}
      <View style={s.rowBody}>
        <Text style={[s.rowTitle, dim && s.rowTitleDim]} numberOfLines={1}>{title}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      {check ? (
        <Pressable
          onPress={busy ? undefined : onToggle}
          hitSlop={12}
          style={s.checkHit}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: paid, busy: !!busy }}
          accessibilityLabel={paid ? 'Pagata. Tocca per segnare da pagare' : 'Da pagare. Tocca per segnare pagata'}
          testID={testID ? `${testID}-check` : undefined}
        >
          {busy ? (
            // In attesa del BE (niente optimistic update): la casella resta
            // lì, con lo spinner dentro.
            <View style={[s.check, paid ? s.checkOn : s.checkBusy]}>
              <ActivityIndicator size="small" color={paid ? '#FFFFFF' : CLAY.ink} style={s.checkSpin} />
            </View>
          ) : paid ? (
            <Animated.View key="on" entering={fill ? checkFill : undefined} style={[s.check, s.checkOn]}>
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
            </Animated.View>
          ) : (
            <Animated.View
              key="off"
              entering={fill ? FadeIn.duration(140).reduceMotion(NEVER) : undefined}
              style={s.check}
            />
          )}
        </Pressable>
      ) : state ? (
        <Text style={[s.rowState, stateStrong && s.rowStateStrong]} numberOfLines={1}>{state}</Text>
      ) : null}
    </Pressable>
    </Collapse>
  );
});

/* ────────────────────────────────── schermo ─────────────────────────────── */

const FILTER_LABEL: Record<LessonFilter, string> = {
  all: 'Tutte',
  upcoming: 'Future',
  unpaid: 'Da pagare',
  paid: 'Pagate',
  cancelled: 'Annullate',
};

/** Come la riga racconta una guida: stato, casella, sottotitolo. */
type RowModel = {
  lesson: AutoscuolaAppointmentWithRelations;
  title: string;
  subtitle: string;
  /** Stato a parole (sempre: serve al foglio «Guida»). */
  stateLabel: string;
  stateStrong: boolean;
  dim: boolean;
  check: 'paid' | 'unpaid' | null;
};

export const StudentPaymentsScreen = () => {
  const router = useRouter();
  const segments = useSegments();
  const stack = (segments as string[]).includes('notes') ? 'notes' : 'home';
  const data = useSyncExternalStore(studentPaymentsStore.subscribe, studentPaymentsStore.get);

  // REG-639 «memorabile»: si apre su ciò che c'è da fare. Con guide da pagare
  // il filtro parte da «Da pagare», altrimenti da «Tutte».
  const [filter, setFilter] = useState<LessonFilter>(() => {
    const seed = studentPaymentsStore.get();
    const manual = isCompanyManualMode(seed?.settings);
    return manual && (seed?.lessons ?? []).some((l) => isLessonUnpaid(l, manual)) ? 'unpaid' : 'all';
  });
  /** Mesi vecchi senza niente da riscuotere: piegati finché non si aprono. */
  const [showOld, setShowOld] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  /** Ultima casella toccata: solo lei si anima (non tutte all'apertura). */
  const [filledId, setFilledId] = useState<string | null>(null);
  /**
   * Righe spuntate che non stanno più nel filtro attivo (es. pagata in «Da
   * pagare»): restano un attimo (`hold`, si possono ritoccare), poi si chiudono
   * (`collapse`) e solo allora escono dalla lista.
   */
  const [leaving, setLeaving] = useState<Record<string, 'hold' | 'collapse'>>({});
  const holdTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(holdTimers.current).forEach(clearTimeout), []);
  /**
   * Scritture già confermate dal BE, applicate qui senza rileggere tutto lo
   * storico (niente optimistic update: si scrive solo ciò che il server ha
   * risposto). La scheda sotto si riallinea da sé via `onChanged`.
   */
  const [patched, setPatched] = useState<
    Record<string, { status: string | null; events: PaymentHistoryEvent[] }>
  >({});

  const manualMode = isCompanyManualMode(data?.settings);

  const lessons = useMemo(() => {
    // REG-637: gli eventi scritti qui vanno in testa allo storico del seed.
    const list = (data?.lessons ?? []).map((l) =>
      l.id in patched
        ? {
            ...l,
            manualPaymentStatus: patched[l.id].status,
            paymentHistory: [...patched[l.id].events, ...(l.paymentHistory ?? [])],
          }
        : l,
    );
    return list.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [data?.lessons, patched]);

  /**
   * Predicati dei filtri: copia esatta del dettaglio allievo web. "Da pagare"
   * sono SOLO le guide effettuate non saldate (o le penali tardive addebitate),
   * mai le future programmate e mai quelle coperte da credito.
   */
  const predicates: Record<LessonFilter, (l: AutoscuolaAppointmentWithRelations) => boolean> =
    useMemo(() => {
      const now = Date.now();
      return {
        all: () => true,
        upcoming: (l) => FUTURE.includes(normalize(l.status)) && new Date(l.startsAt).getTime() > now,
        unpaid: (l) => isLessonUnpaid(l, manualMode),
        paid: (l) => !l.creditApplied && l.manualPaymentStatus === 'paid',
        cancelled: (l) => MISSED.includes(normalize(l.status)),
      };
    }, [manualMode]);

  // Tre voci al massimo, così il segmentato sta in larghezza. In modalità
  // manuale Tutte · Da pagare · Pagate (future e annullate restano in «Tutte»,
  // una «Programmata» e una grigia); in sola lettura non si paga niente, quindi
  // Tutte · Future · Annullate.
  const filterDefs = useMemo(() => {
    const values: LessonFilter[] = manualMode ? ['all', 'unpaid', 'paid'] : ['all', 'upcoming', 'cancelled'];
    return values.map((value) => ({ value, label: FILTER_LABEL[value], count: lessons.filter(predicates[value]).length }));
  }, [manualMode, lessons, predicates]);

  const activeFilter = filterDefs.some((f) => f.value === filter) ? filter : 'all';
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;
  const unpaidLessons = lessons.filter(predicates.unpaid);
  // Il numero grande cambia quando la riga comincia a uscire, non prima:
  // numero e righe dicono sempre la stessa cosa.
  const holding = activeFilter === 'unpaid'
    ? Object.entries(leaving).filter(([, phase]) => phase === 'hold').length
    : 0;
  const unpaidCount = unpaidLessons.length + holding;
  const leavingCount = Object.keys(leaving).length;
  /** La più vecchia da riscuotere (lessons è dal più recente), contando chi aspetta di uscire. */
  const dueForHero = activeFilter === 'unpaid'
    ? lessons.filter((l) => predicates.unpaid(l) || leaving[l.id] === 'hold')
    : unpaidLessons;
  const oldestUnpaid = dueForHero[dueForHero.length - 1] ?? null;
  const firstName = (data?.studentName ?? '').trim().split(/\s+/)[0] || null;
  const canTick = !!data?.canManagePayments;

  const rowModel = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations): RowModel => {
      const status = normalize(lesson.status);
      const done = DONE.includes(status);
      const missed = MISSED.includes(status);
      const isExam = normalize(lesson.type) === 'esame';
      const isGroup = normalize(lesson.type) === 'group_lesson' || !!lesson.groupLessonId;
      const penaltyCharged = isPenaltyCharged(lesson);
      const unpaid = isLessonUnpaid(lesson, manualMode);
      const covered = !!lesson.creditApplied;
      const paid = !covered && lesson.manualPaymentStatus === 'paid' && (manualMode || isPenaltyPaid(lesson));
      const actionable = !!data?.canManagePayments && canToggleLessonPayment(lesson, data?.settings ?? null);

      let stateLabel: string;
      if (unpaid) stateLabel = 'Da pagare';
      else if (covered) stateLabel = 'A credito';
      else if (paid) stateLabel = 'Pagata';
      else if (missed) stateLabel = statusLabel(lesson.status);
      else if (isExam) stateLabel = 'Esame';
      else if (done) stateLabel = 'Completata';
      else stateLabel = 'Programmata';

      const start = new Date(lesson.startsAt);
      const title = `${WEEKDAYS[start.getDay()]} ${start.getDate()} · ${formatTime(lesson.startsAt)}`;
      const types = (lesson.types?.length ? lesson.types : [lesson.type])
        .filter((t) => t && t !== 'guida' && t !== 'group_lesson')
        .map((t) => LESSON_TYPE_LABEL_MAP[t] ?? t);
      const what = isGroup
        ? 'Guida di gruppo'
        : missed && isLate(lesson)
          ? 'Annullata tardi'
          : types.join(' · ') || 'Guida';
      // La penale è un importo, non uno stato: sta nel sottotitolo.
      const penalty = penaltyCharged && lesson.penaltyAmount != null ? `Penale ${formatEuro(lesson.penaltyAmount)}` : null;
      const subtitle = [what, penalty, lesson.instructor?.name ?? null].filter(Boolean).join(' · ');

      return {
        lesson,
        title,
        subtitle,
        stateLabel,
        stateStrong: unpaid,
        dim: missed && !penaltyCharged,
        check: actionable ? (paid ? 'paid' : 'unpaid') : null,
      };
    },
    [data?.canManagePayments, data?.settings, manualMode],
  );

  /** Righe raggruppate per mese: l'ordine di lettura naturale su mobile. */
  const sections = useMemo(() => {
    const out: { key: string; label: string; rows: RowModel[] }[] = [];
    for (const l of lessons.filter((x) => x.id in leaving || predicates[activeFilter](x))) {
      const key = monthKey(l.startsAt);
      let sec = out[out.length - 1];
      if (!sec || sec.key !== key) {
        sec = { key, label: monthLabel(l.startsAt), rows: [] };
        out.push(sec);
      }
      sec.rows.push(rowModel(l));
    }
    return out;
  }, [lessons, predicates, activeFilter, rowModel, leaving]);
  /** Stanno uscendo tutte le righe rimaste: si chiude anche il piede. */
  const allGoing =
    sections.length > 0 && sections.every((sec) => sec.rows.every((r) => leaving[r.lesson.id] === 'collapse'));

  /**
   * In «Tutte» i mesi prima del mese scorso che non hanno niente da riscuotere
   * sono solo righe grigie (Programmata, A credito…): si piegano in una riga
   * «Mostra agosto e prima» in fondo.
   */
  const { shown: shownSections, folded } = useMemo(() => {
    if (activeFilter !== 'all' || showOld) return { shown: sections, folded: [] as typeof sections };
    const now = new Date();
    const limit = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const cut = sections.findIndex((sec) => new Date(sec.rows[0].lesson.startsAt).getTime() < limit);
    if (cut < 1) return { shown: sections, folded: [] as typeof sections };
    const rest = sections.slice(cut);
    if (rest.some((sec) => sec.rows.some((r) => r.stateStrong))) return { shown: sections, folded: [] as typeof sections };
    return { shown: sections.slice(0, cut), folded: rest };
  }, [sections, activeFilter, showOld]);

  const applyStatus = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations, status: 'paid' | 'unpaid'): Promise<boolean> => {
      if (savingId || leaving[lesson.id] === 'collapse') return false;
      setSavingId(lesson.id);
      try {
        const res = await regloApi.setManualPaymentStatus(lesson.id, status);
        // Uscita dal filtro: «Da pagare» perde la pagata, «Pagate» la tolta.
        // Ritoccata mentre aspetta di uscire → resta (è l'annullamento).
        const filterNow = activeFilterRef.current;
        const leavesFilter =
          (filterNow === 'unpaid' && res.manualPaymentStatus === 'paid') ||
          (filterNow === 'paid' && res.manualPaymentStatus !== 'paid');
        clearTimeout(holdTimers.current[lesson.id]);
        setLeaving((prev) => {
          const next = { ...prev };
          if (leavesFilter) next[lesson.id] = 'hold';
          else delete next[lesson.id];
          return next;
        });
        if (leavesFilter) {
          holdTimers.current[lesson.id] = setTimeout(
            () => setLeaving((prev) => (prev[lesson.id] === 'hold' ? { ...prev, [lesson.id]: 'collapse' } : prev)),
            HOLD_MS,
          );
        }
        setFilledId(lesson.id);
        setPatched((prev) => ({
          ...prev,
          [lesson.id]: {
            status: res.manualPaymentStatus,
            events: res.paymentEvent
              ? [res.paymentEvent, ...(prev[lesson.id]?.events ?? [])]
              : (prev[lesson.id]?.events ?? []),
          },
        }));
        void notificationAsync(NotificationFeedbackType.Success).catch(() => {});
        await data?.onChanged?.();
        return true;
      } catch (e) {
        void notificationAsync(NotificationFeedbackType.Error).catch(() => {});
        // Errore: avviso nativo, la casella resta com'era.
        Alert.alert('Non salvato', e instanceof Error ? e.message : 'Riprova tra un attimo.');
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [savingId, data, leaving],
  );

  const toggle = useCallback(
    (row: RowModel) => {
      void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
      void applyStatus(row.lesson, row.check === 'paid' ? 'unpaid' : 'paid');
    },
    [applyStatus],
  );

  /** Chiusa la riga: esce davvero dalla lista. */
  const dropLeaving = useCallback((ids: string[]) => {
    setLeaving((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  }, []);

  /** Cambio filtro: chi stava uscendo esce subito (si vede già il nuovo filtro). */
  const changeFilter = useCallback((value: LessonFilter) => {
    Object.values(holdTimers.current).forEach(clearTimeout);
    holdTimers.current = {};
    setLeaving({});
    setFilter(value);
  }, []);

  /** Foglio «Guida»: stato, chi/quando (storico) e la CTA per cambiarlo. */
  const openDetail = useCallback(
    (row: RowModel) => {
      const start = new Date(row.lesson.startsAt);
      paymentHistoryStore.set({
        lessonLabel: `${WEEKDAYS[start.getDay()]} ${start.getDate()} ${MONTHS[start.getMonth()].toLowerCase()} · ${formatTime(row.lesson.startsAt)}`,
        lessonSubtitle: row.subtitle,
        stateLabel: row.stateLabel,
        events: row.lesson.paymentHistory ?? [],
        action: row.check
          ? {
              label: row.check === 'paid' ? 'Segna da pagare' : 'Segna pagata',
              run: () => applyStatus(row.lesson, row.check === 'paid' ? 'unpaid' : 'paid'),
            }
          : null,
      });
      router.push(`/(tabs)/${stack}/payment-history`);
    },
    [applyStatus, router, stack],
  );

  if (!data) return <View style={s.sheet} />;

  // Form sheet nativo alto quanto il contenuto (FORM_SHEET + FormSheet): testata
  // fissa e opaca con la X, scorre solo il centro.
  return (
    <FormSheet title="Pagamenti" subtitle={data.studentName || undefined} testID="student-payments-sheet">
      {manualMode ? (
        // Hero (REG-639 «memorabile»): il salvadanaio dice a colpo d'occhio a
        // che punto è l'allievo. Il numero cambia di passaggio (esce e rientra)
        // quando la riga spuntata comincia a uscire; all'ultima passa a «Tutto
        // saldato» col salvadanaio pieno (l'haptic lo dà la scrittura).
        <View
          style={s.hero}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            unpaidCount > 0 ? `${unpaidCount} da pagare` : `Tutto saldato${firstName ? `: ${firstName} è in pari` : ''}`
          }
        >
          <FadeSwap swapKey={String(unpaidCount)} style={s.heroText}>
            {unpaidCount > 0 ? (
              <>
                <View style={s.heroLine}>
                  <Text style={s.heroNum}>{unpaidCount}</Text>
                  <Text style={s.heroLabel}>{unpaidCount === 1 ? 'guida da pagare' : 'guide da pagare'}</Text>
                </View>
                {oldestUnpaid ? (
                  <Text style={s.heroSub}>
                    {unpaidCount === 1 ? 'È quella di ' : 'La più vecchia è di '}
                    {oldestLabel(oldestUnpaid.startsAt)}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={s.heroOk}>Tutto saldato</Text>
                <Text style={s.heroSub}>
                  {firstName ? `${firstName} è in pari, niente da riscuotere.` : 'Niente da riscuotere.'}
                </Text>
              </>
            )}
          </FadeSwap>
          <FadeSwap swapKey={unpaidCount > 0 ? 'due' : 'ok'}>
            <Icon3D source={unpaidCount > 0 ? VITA_ART.salvadanaio : VITA_ART.salvadanaioPieno} size={76} />
          </FadeSwap>
        </View>
      ) : (
        <Text style={s.note}>
          L&apos;autoscuola incassa dalla sezione Pagamenti: qui le guide sono in sola lettura.
        </Text>
      )}

      <View style={s.segment}>
        <PaymentsFilterSegmented
          options={filterDefs}
          value={activeFilter}
          onChange={changeFilter}
          fallback={
            <ClaySegmented
              options={filterDefs.map((f) => ({ value: f.value, label: f.label }))}
              value={activeFilter}
              onChange={changeFilter}
            />
          }
        />
      </View>

      <Animated.View key={activeFilter} entering={FadeIn.duration(180)}>
        {manualMode && canTick && (unpaidCount > 0 || leavingCount > 0) && activeFilter !== 'paid' ? (
          // Spuntata l'ultima, la frase si chiude insieme alla riga.
          <Collapse collapsing={unpaidCount === 0}>
            <Text style={s.hint}>
              Spunta la casella quando {firstName ?? "l'allievo"} ti paga.
            </Text>
          </Collapse>
        ) : null}
        {shownSections.map((section) => {
            const ids = section.rows.map((r) => r.lesson.id);
            const monthGoing = ids.every((id) => leaving[id] === 'collapse');
            return (
            <Collapse key={section.key} collapsing={monthGoing} onCollapsed={() => dropLeaving(ids)}>
            <ClaySection title={section.label}>
              <ClayList>
                {section.rows.map((row) => (
                  <PaymentRow
                    key={row.lesson.id}
                    title={row.title}
                    subtitle={row.subtitle}
                    state={row.stateLabel}
                    stateStrong={row.stateStrong}
                    dim={row.dim}
                    check={row.check}
                    busy={savingId === row.lesson.id}
                    fill={filledId === row.lesson.id}
                    collapsing={!monthGoing && leaving[row.lesson.id] === 'collapse'}
                    onCollapsed={() => dropLeaving([row.lesson.id])}
                    onPress={() => openDetail(row)}
                    onToggle={() => toggle(row)}
                    testID={`payment-row-${row.lesson.id}`}
                  />
                ))}
              </ClayList>
            </ClaySection>
            </Collapse>
            );
          })}
        {sections.length === 0 && activeFilter !== 'unpaid' ? (
          <ClayEmpty title="Nessuna guida" text="Non ci sono guide per questo filtro." />
        ) : null}
        {/* «Da pagare» vuoto: niente stato vuoto, lo dice già l'hero («Tutto
            saldato», salvadanaio pieno). Così, all'ultima spuntata, il foglio
            si accorcia in un solo movimento mentre la riga si chiude. */}
        {folded.length > 0 ? (
          <Pressable
            onPress={() => setShowOld(true)}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [s.more, pressed && { opacity: 0.55 }]}
            testID="payments-show-old"
          >
            <Text style={s.moreTx}>Mostra {folded[0].label.toLowerCase()} e prima</Text>
            <Ionicons name="chevron-down" size={15} color={CLAY.ink3} />
          </Pressable>
        ) : null}
      </Animated.View>
      {manualMode && sections.length > 0 && canTick ? (
        <Collapse collapsing={allGoing}>
          <Text style={s.foot}>Tocca una guida per vedere chi l&apos;ha segnata e quando.</Text>
        </Collapse>
      ) : null}
    </FormSheet>
  );
};

const CHECK = 26;

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: CLAY.bg },
  note: { fontSize: 14, lineHeight: 20, color: CLAY.ink3, marginTop: 4 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  heroText: { flex: 1, minWidth: 0 },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  heroNum: { fontSize: 44, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  heroLabel: { fontSize: 17, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.3 },
  heroOk: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6 },
  heroSub: { fontSize: 14.5, lineHeight: 20, color: CLAY.ink3, marginTop: 3, letterSpacing: -0.1 },
  hint: { fontSize: 14.5, lineHeight: 20, color: CLAY.ink3, marginTop: 14, marginBottom: -4, paddingHorizontal: 4 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  moreTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.2 },

  segment: { marginTop: 18 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 60 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25, fontVariant: ['tabular-nums'] },
  rowTitleDim: { color: CLAY.ink4 },
  rowSub: { fontSize: 13.5, color: CLAY.ink3, marginTop: 2 },
  rowState: { fontSize: 15, color: CLAY.ink4, letterSpacing: -0.2 },
  rowStateStrong: { color: CLAY.ink, fontWeight: '600' },

  checkHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -3 },
  check: {
    width: CHECK, height: CHECK, borderRadius: CHECK / 2,
    borderWidth: 1.5, borderColor: '#C4C4C4', alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: CLAY.ink, borderColor: CLAY.ink },
  checkBusy: { borderColor: CLAY.ink },
  checkSpin: { transform: [{ scale: 0.7 }] },

  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4 },
});
