import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';

import { notificationAsync, NotificationFeedbackType } from '../utils/haptics';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { FormSheet } from '../components/SheetScaffold';
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

/* ─────────────────────────────────── riga ───────────────────────────────── */

/**
 * Riga di Pagamenti (REG-639, giro dopo la prova di Tiziano): dentro una
 * `ClayList` come le altre liste. UN solo segnale di stato:
 * - guida che si può segnare → la casella a destra: vuota = da pagare, nera
 *   con la spunta = pagata. Si tocca e scrive (risposta del BE, poi toast);
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
  onPress: () => void;
  onToggle?: () => void;
  testID?: string;
}) {
  const paid = check === 'paid';
  return (
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
            <ActivityIndicator size="small" color={CLAY.ink} />
          ) : paid ? (
            <Animated.View key="on" entering={FadeIn.duration(160)} style={[s.check, s.checkOn]}>
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
            </Animated.View>
          ) : (
            <Animated.View key="off" entering={FadeIn.duration(160)} style={s.check} />
          )}
        </Pressable>
      ) : state ? (
        <Text style={[s.rowState, stateStrong && s.rowStateStrong]} numberOfLines={1}>{state}</Text>
      ) : null}
    </Pressable>
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
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
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
  const unpaidLessons = lessons.filter(predicates.unpaid);
  const unpaidCount = unpaidLessons.length;
  /** La più vecchia da riscuotere (lessons è dal più recente). */
  const oldestUnpaid = unpaidLessons[unpaidLessons.length - 1] ?? null;
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
    for (const l of lessons.filter(predicates[activeFilter])) {
      const key = monthKey(l.startsAt);
      let sec = out[out.length - 1];
      if (!sec || sec.key !== key) {
        sec = { key, label: monthLabel(l.startsAt), rows: [] };
        out.push(sec);
      }
      sec.rows.push(rowModel(l));
    }
    return out;
  }, [lessons, predicates, activeFilter, rowModel]);

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
      if (savingId) return false;
      setSavingId(lesson.id);
      try {
        const res = await regloApi.setManualPaymentStatus(lesson.id, status);
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
        setToast({
          text: status === 'paid' ? 'Guida segnata come pagata.' : 'Guida segnata come da pagare.',
          tone: 'success',
        });
        await data?.onChanged?.();
        return true;
      } catch (e) {
        void notificationAsync(NotificationFeedbackType.Error).catch(() => {});
        setToast({ text: e instanceof Error ? e.message : 'Errore nel salvataggio.', tone: 'danger' });
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [savingId, data],
  );

  const toggle = useCallback(
    (row: RowModel) => void applyStatus(row.lesson, row.check === 'paid' ? 'unpaid' : 'paid'),
    [applyStatus],
  );

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
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {manualMode ? (
        // Hero (REG-639 «memorabile»): il salvadanaio dice a colpo d'occhio a
        // che punto è l'allievo; spuntata l'ultima guida passa in dissolvenza a
        // «Tutto saldato» col salvadanaio pieno (l'haptic lo dà la scrittura).
        <Animated.View
          key={unpaidCount > 0 ? 'due' : 'ok'}
          entering={FadeIn.duration(320)}
          style={s.hero}
          accessible
          accessibilityLabel={
            unpaidCount > 0 ? `${unpaidCount} da pagare` : `Tutto saldato${firstName ? `: ${firstName} è in pari` : ''}`
          }
        >
          <View style={s.heroText}>
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
          </View>
          <Icon3D source={unpaidCount > 0 ? VITA_ART.salvadanaio : VITA_ART.salvadanaioPieno} size={76} />
        </Animated.View>
      ) : (
        <Text style={s.note}>
          L&apos;autoscuola incassa dalla sezione Pagamenti: qui le guide sono in sola lettura.
        </Text>
      )}

      <View style={s.segment}>
        <PaymentsFilterSegmented
          options={filterDefs}
          value={activeFilter}
          onChange={setFilter}
          fallback={
            <ClaySegmented
              options={filterDefs.map((f) => ({ value: f.value, label: f.label }))}
              value={activeFilter}
              onChange={setFilter}
            />
          }
        />
      </View>

      <Animated.View key={activeFilter} entering={FadeIn.duration(180)}>
        {manualMode && canTick && unpaidCount > 0 && activeFilter !== 'paid' ? (
          <Text style={s.hint}>
            Spunta la casella quando {firstName ?? "l'allievo"} ti paga.
          </Text>
        ) : null}
        {sections.length === 0 ? (
          activeFilter === 'unpaid' ? (
            // Il salvadanaio pieno è già nell'hero: qui basta la frase.
            <ClayEmpty title="Niente da riscuotere" text="Le guide saldate sono in «Pagate»." />
          ) : (
            <ClayEmpty title="Nessuna guida" text="Non ci sono guide per questo filtro." />
          )
        ) : (
          shownSections.map((section) => (
            <ClaySection key={section.key} title={section.label}>
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
                    onPress={() => openDetail(row)}
                    onToggle={() => toggle(row)}
                    testID={`payment-row-${row.lesson.id}`}
                  />
                ))}
              </ClayList>
            </ClaySection>
          ))
        )}
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
        <Text style={s.foot}>Tocca una guida per vedere chi l&apos;ha segnata e quando.</Text>
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

  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4 },
});
