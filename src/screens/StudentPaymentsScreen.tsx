import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import {
  notificationAsync,
  selectionAsync,
  NotificationFeedbackType,
} from '../utils/haptics';
import { HoldRing } from '../components/HoldRing';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { GlassCloseButton } from '../components/GlassCloseButton';
import { studentPaymentsStore } from '../stores/studentPaymentsStore';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme';
import { formatTime } from '../utils/date';
import { LESSON_TYPE_LABEL_MAP } from '../utils/lessonTypes';
import {
  canToggleLessonPayment,
  isCompanyManualMode,
  isLessonUnpaid,
  isPenaltyCharged,
  isPenaltyPaid,
} from '../utils/lessonPayments';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/** Filtri del registro guide — stessi identici del dettaglio allievo web. */
type LessonFilter = 'all' | 'upcoming' | 'unpaid' | 'completed' | 'cancelled';

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

const formatEuro = (value: number) =>
  Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;

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

/**
 * Chiave "l'utente ha già capito che si tiene premuto". Si scrive alla PRIMA
 * conferma completata: da lì il suggerimento non parte più da solo (resta come
 * risposta al tocco singolo, che una risposta deve averla).
 */
const HINT_KEY = 'reg450.paymentsLongPressLearned';

/** Quanto va tenuto premuto perché la conferma scatti. */
const HOLD_MS = 900;

const SPRING = { damping: 20, stiffness: 340, mass: 0.5 } as const;
const ROW_LAYOUT = LinearTransition.springify().damping(24).stiffness(260).mass(0.6);

/* ────────────────────────────── stato della riga ────────────────────────── */

type RowTone = 'amber' | 'green' | 'violet' | 'grey';
type RowIcon = 'euro' | 'check' | 'wallet' | 'close' | 'clock' | 'exam';

const TONE: Record<RowTone, { chip: string; ink: string }> = {
  amber: { chip: '#FFF3E3', ink: '#B45309' },
  green: { chip: '#EAF7F0', ink: '#067647' },
  violet: { chip: '#F3F0FF', ink: '#6D28D9' },
  grey: { chip: '#F1F1F5', ink: '#A8A8B0' },
};

const ICON_NAME: Record<Exclude<RowIcon, 'euro'>, React.ComponentProps<typeof Ionicons>['name']> = {
  check: 'checkmark',
  wallet: 'wallet',
  close: 'close',
  clock: 'time-outline',
  exam: 'school',
};

/**
 * Pastiglia tonda di sinistra: è lei a dire lo stato a colpo d'occhio, al posto
 * della fila di badge che c'era prima. La lista si legge scorrendo la colonna.
 */
function StateGlyph({ tone, icon }: { tone: RowTone; icon: RowIcon }) {
  const { chip, ink } = TONE[tone];
  return (
    <View style={[s.glyph, { backgroundColor: chip }]}>
      {icon === 'euro' ? (
        <Text style={[s.glyphEuro, { color: ink }]}>€</Text>
      ) : (
        <Ionicons name={ICON_NAME[icon]} size={icon === 'check' ? 18 : 15} color={ink} />
      )}
    </View>
  );
}

/* ─────────────────────────────────── riga ───────────────────────────────── */

/**
 * Riga del registro (R1): glifo di stato · due righe di testo · valore a destra
 * · anello di conferma.
 *
 * **La pressione lunga È la conferma.** Non apre più un foglio: l'anello si
 * riempie mentre tieni premuto e al 100% l'azione parte. Mollare prima annulla
 * e l'anello torna indietro. Niente action sheet che spunta di scatto.
 *
 * VoiceOver non sa tenere premuto: con lo screen reader attivo il doppio tocco
 * apre il menu nativo di ripiego.
 */
function LessonRow({
  lesson,
  actionable,
  busy,
  paid,
  title,
  subtitle,
  value,
  tone,
  icon,
  showSeparator,
  screenReader,
  onCommit,
  onFallbackMenu,
  onNudge,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  actionable: boolean;
  busy: boolean;
  paid: boolean;
  title: string;
  subtitle: string;
  value: string | null;
  tone: RowTone;
  icon: RowIcon;
  showSeparator: boolean;
  screenReader: boolean;
  onCommit: (lesson: AutoscuolaAppointmentWithRelations) => void;
  onFallbackMenu: (lesson: AutoscuolaAppointmentWithRelations) => void;
  onNudge: () => void;
}) {
  const progress = useSharedValue(0);
  const press = useSharedValue(0);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 1 - press.value * 0.04,
    transform: [{ scale: 1 - press.value * 0.008 }],
  }));

  const commit = useCallback(() => {
    void notificationAsync(NotificationFeedbackType.Success).catch(() => {});
    onCommit(lesson);
  }, [lesson, onCommit]);

  const startHold = useCallback(() => {
    press.value = withTiming(1, { duration: 90 });
    void selectionAsync().catch(() => {});
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) {
        progress.value = 0;
        runOnJS(commit)();
      }
    });
  }, [commit, press, progress]);

  const endHold = useCallback(() => {
    press.value = withTiming(0, { duration: 140 });
    cancelAnimation(progress);
    progress.value = withSpring(0, SPRING);
  }, [press, progress]);

  const body = (
    <View style={s.row}>
      <StateGlyph tone={tone} icon={icon} />
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      {value ? (
        <Text style={[s.rowValue, { color: TONE[tone].ink }]} numberOfLines={1}>{value}</Text>
      ) : null}
      {busy ? (
        <ActivityIndicator size="small" color="#1A1A2E" style={s.rowRing} />
      ) : actionable ? (
        <View style={s.rowRing}>
          <HoldRing progress={progress} color={paid ? '#B45309' : '#067647'} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View>
      {showSeparator ? <View style={s.sep} /> : null}
      {actionable ? (
        <Animated.View style={rowStyle}>
          <Pressable
            disabled={busy}
            onPressIn={screenReader ? undefined : startHold}
            onPressOut={screenReader ? undefined : endHold}
            onPress={() => {
              if (screenReader) {
                onFallbackMenu(lesson);
                return;
              }
              // Tocco breve: l'anello è appena partito e già rientrato. Non
              // resta muto — il suggerimento torna a dire cosa fare.
              onNudge();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${subtitle}. ${value ?? ''}`}
            accessibilityHint={paid ? 'Tieni premuto per segnare da pagare' : 'Tieni premuto per segnare pagata'}
          >
            {body}
          </Pressable>
        </Animated.View>
      ) : (
        body
      )}
    </View>
  );
}

/* ────────────────────────────────── filtri ──────────────────────────────── */

type FilterDef = { value: LessonFilter; label: string; count: number };

/**
 * Barra filtri con la pastiglia che **scivola** da un filtro all'altro invece
 * di riapparire altrove, e i contatori in cross-fade invece di saltare al
 * numero nuovo.
 */
function FilterBar({
  defs,
  active,
  onChange,
}: {
  defs: FilterDef[];
  active: LessonFilter;
  onChange: (f: LessonFilter) => void;
}) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = useSharedValue(0);

  const onLayoutFor = (value: LessonFilter) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) =>
      prev[value]?.x === lx && prev[value]?.w === width ? prev : { ...prev, [value]: { x: lx, w: width } },
    );
  };

  useEffect(() => {
    const l = layouts[active];
    if (!l) return;
    if (ready.value === 0) {
      // Primo posizionamento: la pastiglia si trova già dov'è, non scivola dal nulla.
      x.value = l.x;
      w.value = l.w;
      ready.value = 1;
      return;
    }
    x.value = withSpring(l.x, SPRING);
    w.value = withSpring(l.w, SPRING);
  }, [active, layouts, ready, w, x]);

  const pill = useAnimatedStyle(() => ({
    opacity: ready.value,
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.filterRow}
      style={s.filterScroll}
    >
      <Animated.View style={[s.filterPill, pill]} pointerEvents="none" />
      {defs.map((f) => {
        const on = f.value === active;
        return (
          <Pressable
            key={f.value}
            onLayout={onLayoutFor(f.value)}
            onPress={() => {
              if (f.value === active) return;
              void selectionAsync().catch(() => {});
              onChange(f.value);
            }}
            style={s.filterItem}
          >
            <Text style={[s.filterText, on && s.filterTextOn]}>{f.label}</Text>
            {f.count > 0 ? (
              <Animated.Text
                key={`${f.value}-${f.count}`}
                entering={FadeIn.duration(200)}
                style={[s.filterCount, on && s.filterCountOn]}
              >
                {f.count}
              </Animated.Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ────────────────────────────────── schermo ─────────────────────────────── */

export const StudentPaymentsScreen = () => {
  const router = useRouter();
  const data = useSyncExternalStore(studentPaymentsStore.subscribe, studentPaymentsStore.get);

  const [filter, setFilter] = useState<LessonFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  /**
   * Scritture già confermate dal BE, applicate qui senza rileggere tutto lo
   * storico (niente optimistic update: si scrive solo ciò che il server ha
   * risposto). La scheda sotto si riallinea da sé via `onChanged`.
   */
  const [patched, setPatched] = useState<Record<string, string | null>>({});
  const [hintVisible, setHintVisible] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const learned = useRef(false);

  const showHint = useCallback((ms: number) => {
    setHintVisible(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintVisible(false), ms);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY)
      .then((v) => {
        learned.current = v === '1';
        if (!learned.current) showHint(5200);
      })
      .catch(() => {});
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [showHint]);

  const nudge = useCallback(() => showHint(2600), [showHint]);

  const markLearned = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintVisible(false);
    if (learned.current) return;
    learned.current = true;
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
  }, []);

  const manualMode = isCompanyManualMode(data?.settings);

  const lessons = useMemo(() => {
    const list = (data?.lessons ?? []).map((l) =>
      l.id in patched ? { ...l, manualPaymentStatus: patched[l.id] } : l,
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
        completed: (l) => DONE.includes(normalize(l.status)),
        cancelled: (l) => MISSED.includes(normalize(l.status)),
      };
    }, [manualMode]);

  // Il segmento "Da pagare" ha senso solo in modalità manuale, come sul web.
  const filterDefs: FilterDef[] = useMemo(
    () =>
      [
        { value: 'all' as const, label: 'Tutte' },
        { value: 'upcoming' as const, label: 'Future' },
        ...(manualMode ? [{ value: 'unpaid' as const, label: 'Da pagare' }] : []),
        { value: 'completed' as const, label: 'Completate' },
        { value: 'cancelled' as const, label: 'Annullate' },
      ].map((f) => ({ ...f, count: lessons.filter(predicates[f.value]).length })),
    [manualMode, lessons, predicates],
  );

  const activeFilter = filterDefs.some((f) => f.value === filter) ? filter : 'all';
  const unpaidCount = lessons.filter(predicates.unpaid).length;

  /** Righe raggruppate per mese: l'ordine di lettura naturale su mobile. */
  const sections = useMemo(() => {
    const out: { key: string; label: string; items: AutoscuolaAppointmentWithRelations[] }[] = [];
    for (const l of lessons.filter(predicates[activeFilter])) {
      const key = monthKey(l.startsAt);
      let sec = out[out.length - 1];
      if (!sec || sec.key !== key) {
        sec = { key, label: monthLabel(l.startsAt), items: [] };
        out.push(sec);
      }
      sec.items.push(l);
    }
    return out;
  }, [lessons, predicates, activeFilter]);

  const applyStatus = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations, status: 'paid' | 'unpaid') => {
      if (savingId) return;
      setSavingId(lesson.id);
      try {
        const res = await regloApi.setManualPaymentStatus(lesson.id, status);
        setPatched((prev) => ({ ...prev, [lesson.id]: res.manualPaymentStatus }));
        setToast({
          text: status === 'paid' ? 'Guida segnata come pagata.' : 'Guida segnata come da pagare.',
          tone: 'success',
        });
        await data?.onChanged?.();
      } catch (e) {
        void notificationAsync(NotificationFeedbackType.Error).catch(() => {});
        setToast({ text: e instanceof Error ? e.message : 'Errore nel salvataggio.', tone: 'danger' });
      } finally {
        setSavingId(null);
      }
    },
    [savingId, data],
  );

  /** La pressione lunga è arrivata in fondo: si scrive, senza altre domande. */
  const commit = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      markLearned();
      void applyStatus(lesson, lesson.manualPaymentStatus === 'paid' ? 'unpaid' : 'paid');
    },
    [applyStatus, markLearned],
  );

  /**
   * Ripiego per VoiceOver, che non sa tenere premuto: menu nativo
   * (`ActionSheetIOS` / `Alert`) aperto dal doppio tocco.
   */
  const openFallbackMenu = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      markLearned();
      const paid = lesson.manualPaymentStatus === 'paid';
      const action = paid ? 'Segna da pagare' : 'Segna pagata';
      const next: 'paid' | 'unpaid' = paid ? 'unpaid' : 'paid';
      const start = new Date(lesson.startsAt);
      const title = `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} · ${formatTime(lesson.startsAt)}`;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title, options: [action, 'Annulla'], cancelButtonIndex: 1 },
          (i) => {
            if (i === 0) void applyStatus(lesson, next);
          },
        );
      } else {
        Alert.alert(title, undefined, [
          { text: action, onPress: () => void applyStatus(lesson, next) },
          { text: 'Annulla', style: 'cancel' },
        ]);
      }
    },
    [applyStatus, markLearned],
  );

  if (!data) return <View style={s.sheet} />;

  return (
    <View style={s.sheet}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'close'} size={20} color="#1A1A2E" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.pad}>
          <Text style={s.title}>Pagamenti</Text>
          {data.studentName ? <Text style={s.subtitle}>{data.studentName}</Text> : null}

          {manualMode ? (
            <Animated.View entering={FadeIn.duration(320)} style={s.hero}>
              {unpaidCount > 0 ? (
                <>
                  <Text style={s.heroNum}>{unpaidCount}</Text>
                  <Text style={s.heroLabel}>
                    {unpaidCount === 1 ? 'guida da pagare' : 'guide da pagare'}
                  </Text>
                </>
              ) : (
                <>
                  <View style={s.heroOk}>
                    <Ionicons name="checkmark" size={17} color="#15803D" />
                  </View>
                  <Text style={s.heroLabelOk}>Tutto saldato</Text>
                </>
              )}
            </Animated.View>
          ) : (
            <Text style={s.note}>
              L&apos;autoscuola incassa dalla sezione Pagamenti: qui le guide sono in sola lettura.
            </Text>
          )}
        </View>

        <FilterBar defs={filterDefs} active={activeFilter} onChange={setFilter} />

        {hintVisible ? (
          <Animated.View
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(200)}
            style={[s.pad, s.hint]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="hand-left-outline" size={13} color={colors.textMuted} />
            <Text style={s.hintText}>Tieni premuta una guida finché il cerchio si chiude</Text>
          </Animated.View>
        ) : null}

        {sections.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="receipt-outline" size={24} color="#B4B4BD" />
            </View>
            <Text style={s.emptyTitle}>Nessuna guida</Text>
            <Text style={s.emptyText}>Non ci sono guide per questo filtro.</Text>
          </View>
        ) : (
          <Animated.View layout={ROW_LAYOUT}>
            {sections.map((section) => (
              <Animated.View key={section.key} layout={ROW_LAYOUT}>
                <Text style={[s.pad, s.month]}>{section.label}</Text>
                {section.items.map((lesson, i) => {
                  const status = normalize(lesson.status);
                  const done = DONE.includes(status);
                  const missed = MISSED.includes(status);
                  const isExam = normalize(lesson.type) === 'esame';
                  const isGroup = normalize(lesson.type) === 'group_lesson' || !!lesson.groupLessonId;
                  const penaltyCharged = isPenaltyCharged(lesson);
                  const unpaid = isLessonUnpaid(lesson, manualMode);
                  const covered = !!lesson.creditApplied;
                  const paid =
                    !covered && lesson.manualPaymentStatus === 'paid' && (manualMode || isPenaltyPaid(lesson));

                  const actionable =
                    data.canManagePayments && canToggleLessonPayment(lesson, data.settings);
                  const busy = savingId === lesson.id;

                  // Lo stato decide colore, glifo e valore a destra: una sola
                  // lettura, non quattro badge da mettere insieme.
                  let tone: RowTone = 'grey';
                  let icon: RowIcon = 'clock';
                  let value: string | null;
                  if (unpaid) {
                    tone = 'amber';
                    icon = 'euro';
                    value =
                      penaltyCharged && lesson.penaltyAmount != null
                        ? formatEuro(lesson.penaltyAmount)
                        : 'Da pagare';
                  } else if (covered) {
                    tone = 'violet';
                    icon = 'wallet';
                    value = 'A credito';
                  } else if (paid) {
                    tone = 'green';
                    icon = 'check';
                    value = 'Pagata';
                  } else if (missed) {
                    tone = 'grey';
                    icon = 'close';
                    value = statusLabel(lesson.status);
                  } else if (isExam) {
                    tone = 'violet';
                    icon = 'exam';
                    value = 'Esame';
                  } else if (done) {
                    tone = 'green';
                    icon = 'check';
                    value = 'Completata';
                  } else {
                    tone = 'grey';
                    icon = 'clock';
                    value = 'Programmata';
                  }

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
                  const subtitle = [what, lesson.instructor?.name ?? null].filter(Boolean).join(' · ');

                  return (
                    <Animated.View
                      key={lesson.id}
                      entering={FadeIn.duration(220)}
                      exiting={FadeOut.duration(140)}
                      layout={ROW_LAYOUT}
                    >
                      <LessonRow
                        lesson={lesson}
                        actionable={actionable}
                        busy={busy}
                        paid={paid}
                        title={title}
                        subtitle={subtitle}
                        value={value}
                        tone={tone}
                        icon={icon}
                        showSeparator={i > 0}
                        screenReader={screenReader}
                        onCommit={commit}
                        onFallbackMenu={openFallbackMenu}
                        onNudge={nudge}
                      />
                    </Animated.View>
                  );
                })}
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const PAD = 18;
/** Rientro dei divisori: larghezza del glifo + il suo gap. Stile lista iOS. */
const SEP_INSET = PAD + 36 + 13;

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingLeft: 30, paddingRight: 16, paddingTop: 20, paddingBottom: 4,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#DDDDDD',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingTop: 4, paddingBottom: 60 },
  pad: { paddingHorizontal: PAD },

  title: { fontSize: 28, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '400', color: colors.textMuted, marginTop: 4 },
  note: { fontSize: 13, fontWeight: '400', color: colors.textMuted, lineHeight: 19, marginTop: 18 },

  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 22 },
  heroNum: { fontSize: 40, fontWeight: '600', color: '#1A1A2E', letterSpacing: -1.4 },
  heroLabel: { fontSize: 15, fontWeight: '400', color: colors.textSecondary },
  heroOk: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#ECFDF3',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  heroLabelOk: { fontSize: 17, fontWeight: '500', color: '#15803D', alignSelf: 'center' },

  filterScroll: { marginTop: 20 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingBottom: 2 },
  filterPill: {
    position: 'absolute', top: 0, bottom: 2, left: 0,
    borderRadius: 999, backgroundColor: '#1A1A2E',
  },
  filterItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
  },
  filterText: { fontSize: 14, fontWeight: '400', color: '#595959' },
  filterTextOn: { color: '#FFFFFF', fontWeight: '500' },
  filterCount: { fontSize: 12, fontWeight: '500', color: '#9A9AA2' },
  filterCountOn: { color: 'rgba(255,255,255,0.65)' },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  hintText: { fontSize: 12.5, fontWeight: '400', color: colors.textMuted },

  month: {
    fontSize: 12, fontWeight: '600', color: '#AEAEB6', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 26, marginBottom: 2,
  },

  // Lista flat sullo sfondo + divisori rientrati sotto il glifo (stile iOS).
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: PAD, paddingVertical: 11 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECECF0', marginLeft: SEP_INSET },
  glyph: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  glyphEuro: { fontSize: 15, fontWeight: '600' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '400', color: '#1A1A2E', letterSpacing: -0.1 },
  rowSub: { fontSize: 13, fontWeight: '400', color: '#9A9AA2', marginTop: 1 },
  rowValue: { fontSize: 13, fontWeight: '400', textAlign: 'right' },
  rowRing: { width: 26, height: 26, marginLeft: 9, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 6 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F1F5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  emptyText: { fontSize: 13, fontWeight: '400', color: colors.textMuted, textAlign: 'center' },
});
