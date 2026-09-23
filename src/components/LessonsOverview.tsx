import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SheetScaffold } from './SheetScaffold';
import { useAppointments } from '../hooks/queries/useAppointments';
import { formatDay, formatTime } from '../utils/date';
import { lessonArtSource } from '../utils/lessonArt';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * Vista "Le tue guide" dell'allievo: quattro filtri — Tutte, Programmate,
 * Svolte, Annullate.
 *
 * Riusata da due punti d'accesso:
 *  - home sheet `all-lessons` → riceve `seededUpcoming` + `onOpenDetail` (card tappabili).
 *  - Profilo route `more/le-tue-guide` → autonoma (card non tappabili).
 *
 * **Perché una query sola e non una per filtro (REG-510).** Prima le guide
 * passate non si vedevano da nessuna parte: "Programmate" partiva da adesso e
 * "Annullate" filtrava per stato, così chi importava lo storico dal vecchio
 * gestionale non lo ritrovava in app. Servendo tutto con una richiesta sola
 * (poche decine di righe per un allievo) il cambio filtro diventa **istantaneo**
 * — ed è la condizione per poterlo animare davvero: con le query pigre di prima
 * ogni transizione sarebbe stata interrotta dalla comparsa di uno spinner.
 */
type Props = {
  studentId: string | null;
  /** Programmate seedate dalla home: dipinte subito, mentre arriva lo storico. */
  seededUpcoming?: AutoscuolaAppointmentWithRelations[];
  /** Se presente, le card programmate sono tappabili e aprono il dettaglio. */
  onOpenDetail?: (lesson: AutoscuolaAppointmentWithRelations) => void;
};

type Tab = 'all' | 'upcoming' | 'done' | 'cancelled';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'Tutte' },
  { key: 'upcoming', label: 'Programmate' },
  { key: 'done', label: 'Svolte' },
  { key: 'cancelled', label: 'Annullate' },
];

const UPCOMING_STATUSES = ['scheduled', 'confirmed', 'checked_in', 'pending_review'];

/** Quanto indietro si guarda: un percorso patente non supera i 3 anni. */
const HISTORY_MONTHS_BACK = 36;
/** Tetto di sicurezza. Un allievo non arriva a 400 guide nemmeno lontanamente. */
const HISTORY_LIMIT = 400;

/** Riferimento stabile: `?? []` inline creerebbe un array nuovo a ogni render. */
const EMPTY: AutoscuolaAppointmentWithRelations[] = [];

const CARD_COLORS = [
  { bg: '#F4F5F9', accent: '#1A1A2E' },
  { bg: '#EFF6FF', accent: '#3B82F6' },
  { bg: '#F0FDF4', accent: '#22C55E' },
  { bg: '#FFFBEB', accent: '#F59E0B' },
  { bg: '#F5F3FF', accent: '#8B5CF6' },
] as const;

const monthLabel = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatEuro = (value: number) => {
  const n = Number(value);
  return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`;
};

const isUpcoming = (l: AutoscuolaAppointmentWithRelations, now: number) =>
  UPCOMING_STATUSES.includes((l.status ?? '').toLowerCase()) &&
  new Date(l.startsAt).getTime() >= now;

const isDone = (l: AutoscuolaAppointmentWithRelations) =>
  (l.status ?? '').toLowerCase() === 'completed';

const isNoShow = (l: AutoscuolaAppointmentWithRelations) =>
  (l.status ?? '').toLowerCase() === 'no_show';

/**
 * Solo gli annullamenti decisi dall'allievo. Restano fuori le rimozioni
 * amministrative (`record_cleanup`) e gli annullamenti organizzativi della
 * scuola: era già così prima di REG-510 e non è una decisione da cambiare qui.
 */
const isCancelledByStudent = (l: AutoscuolaAppointmentWithRelations) =>
  l.cancellationKind === 'manual_cancel';

/** Raggruppa per mese mantenendo l'ordine della lista in ingresso. */
function groupByMonth(list: AutoscuolaAppointmentWithRelations[]) {
  const out: { month: string; items: AutoscuolaAppointmentWithRelations[] }[] = [];
  for (const l of list) {
    const m = monthLabel(l.startsAt);
    let sec = out[out.length - 1];
    if (!sec || sec.month !== m) {
      sec = { month: m, items: [] };
      out.push(sec);
    }
    sec.items.push(l);
  }
  return out;
}

export function LessonsOverview({ studentId, seededUpcoming, onOpenDetail }: Props) {
  const [tab, setTab] = useState<Tab>('upcoming');

  // ── Storico completo, una richiesta sola ──
  const historyParams = useMemo(() => {
    if (!studentId) return null;
    const from = new Date();
    from.setMonth(from.getMonth() - HISTORY_MONTHS_BACK);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 84);
    to.setHours(23, 59, 59, 999);
    return {
      studentId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: HISTORY_LIMIT,
      light: true,
    };
  }, [studentId]);
  const historyQuery = useAppointments(historyParams);

  // Stabili di proposito: ricalcolarli a ogni render invaliderebbe tutti i
  // useMemo qui sotto, e la lista si rigenererebbe a ogni tocco.
  const all = historyQuery.data ?? EMPTY;
  const now = useMemo(() => Date.now(), [historyQuery.data]);

  // Finché lo storico non è arrivato, le programmate seedate dalla home
  // evitano lo sfarfallio: la lista è già piena al primo frame.
  const upcoming = useMemo(() => {
    const source = historyQuery.data ? all.filter((l) => isUpcoming(l, now)) : (seededUpcoming ?? []);
    return [...source].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [historyQuery.data, all, seededUpcoming, now]);

  const doneSections = useMemo(
    () => groupByMonth(
      all.filter(isDone).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    ),
    [all],
  );

  const cancelledSections = useMemo(
    () => groupByMonth(
      all.filter(isCancelledByStudent).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    ),
    [all],
  );

  // "Tutte" = tutto ciò che l'allievo può vedere, dalla più recente.
  const allSections = useMemo(
    () => groupByMonth(
      all
        .filter((l) => isUpcoming(l, now) || isDone(l) || isNoShow(l) || isCancelledByStudent(l))
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    ),
    [all, now],
  );

  const counts = {
    all: allSections.reduce((acc, s2) => acc + s2.items.length, 0),
    upcoming: upcoming.length,
    done: doneSections.reduce((acc, s2) => acc + s2.items.length, 0),
    cancelled: cancelledSections.reduce((acc, s2) => acc + s2.items.length, 0),
  };

  // ── Indicatore scorrevole dei filtri ──
  const pillLayouts = useRef<Partial<Record<Tab, { x: number; width: number }>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorReady = useSharedValue(0);

  const moveIndicator = useCallback(
    (next: Tab) => {
      const layout = pillLayouts.current[next];
      if (!layout) return;
      // Spring del design system (damping 22 / stiffness 240): stesso tempo di
      // risposta degli sheet, così l'app ha un solo "carattere" di movimento.
      indicatorX.value = withSpring(layout.x, { damping: 22, stiffness: 240 });
      indicatorW.value = withSpring(layout.width, { damping: 22, stiffness: 240 });
      indicatorReady.value = 1;
    },
    [indicatorReady, indicatorW, indicatorX],
  );

  const onPillLayout = useCallback(
    (key: Tab) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      pillLayouts.current[key] = { x, width };
      if (key === tab) {
        // Primo posizionamento senza molla: l'indicatore non deve "arrivare"
        // da sinistra all'apertura dello sheet.
        if (!indicatorReady.value) {
          indicatorX.value = x;
          indicatorW.value = width;
          indicatorReady.value = 1;
        } else {
          moveIndicator(key);
        }
      }
    },
    [tab, indicatorReady, indicatorW, indicatorX, moveIndicator],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
    opacity: indicatorReady.value,
  }));

  const selectTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      void Haptics.selectionAsync();
      moveIndicator(next);
      setTab(next);
    },
    [tab, moveIndicator],
  );

  const subtitle = (() => {
    if (tab === 'upcoming') return `${counts.upcoming} ${counts.upcoming === 1 ? 'guida' : 'guide'} in programma`;
    if (tab === 'done') return `${counts.done} ${counts.done === 1 ? 'guida svolta' : 'guide svolte'}`;
    if (tab === 'cancelled') return 'Le guide che hai annullato';
    return `${counts.all} ${counts.all === 1 ? 'guida' : 'guide'} in totale`;
  })();

  const loading = historyQuery.isLoading && !historyQuery.data;

  return (
    <>
      <View style={s.header}>
        <Text style={s.title}>Le tue guide</Text>
        {/* La chiave forza il rimontaggio: il sottotitolo cambia in dissolvenza
            invece di scattare da un conteggio all'altro. */}
        <Animated.Text key={subtitle} entering={FadeIn.duration(180)} style={s.subtitle}>
          {subtitle}
        </Animated.Text>
      </View>

      <View style={s.filterRow}>
        <Animated.View style={[s.indicator, indicatorStyle]} pointerEvents="none" />
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onLayout={onPillLayout(t.key)}
            onPress={() => selectTab(t.key)}
            style={({ pressed }) => [s.pill, pressed && s.pillPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[s.pillText, tab === t.key && s.pillTextActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SheetScaffold fill>
        {loading ? (
          <View style={s.centerState}>
            <ActivityIndicator color="#1A1A2E" />
          </View>
        ) : (
          // La chiave è il filtro: cambiandolo la lista si rimonta ed entra in
          // dissolvenza, invece di sostituirsi di colpo.
          <Animated.View key={tab} entering={FadeIn.duration(200)}>
            {tab === 'upcoming' ? (
              <UpcomingList lessons={upcoming} onOpenDetail={onOpenDetail} />
            ) : (
              <HistoryList
                sections={tab === 'all' ? allSections : tab === 'done' ? doneSections : cancelledSections}
                emptyFor={tab}
              />
            )}
          </Animated.View>
        )}
      </SheetScaffold>
    </>
  );
}

/* ─────────────────────────────── Programmate ─────────────────────────────── */

function UpcomingList({
  lessons,
  onOpenDetail,
}: {
  lessons: AutoscuolaAppointmentWithRelations[];
  onOpenDetail?: (lesson: AutoscuolaAppointmentWithRelations) => void;
}) {
  if (lessons.length === 0) {
    return (
      <EmptyState icon="calendar-outline" title="Nessuna guida in programma" />
    );
  }
  return (
    <View style={s.list}>
      {lessons.map((lesson, idx) => {
        const bg = CARD_COLORS[idx % CARD_COLORS.length];
        const inner = (
          <>
            <Image source={lessonArtSource(lesson.vehicle?.licenseCategory)} style={s.cardIcon} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.cardTime} numberOfLines={1}>
                {formatTime(lesson.startsAt)}{lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}
              </Text>
              <Text style={s.cardDate} numberOfLines={1}>{formatDay(lesson.startsAt)}</Text>
              <Text style={s.cardInstructor} numberOfLines={1}>
                {lesson.instructor?.name ?? 'Da assegnare'}
              </Text>
            </View>
            {onOpenDetail ? (
              <View style={[s.cardArrow, { backgroundColor: bg.accent }]}>
                <Ionicons name="chevron-forward" size={14} color="#FFF" />
              </View>
            ) : null}
          </>
        );
        return (
          <StaggeredRow key={lesson.id} index={idx}>
            {onOpenDetail ? (
              <Pressable
                onPress={() => onOpenDetail(lesson)}
                style={({ pressed }) => [s.card, { backgroundColor: bg.bg }, pressed && s.cardPressed]}
              >
                {inner}
              </Pressable>
            ) : (
              <View style={[s.card, { backgroundColor: bg.bg }]}>{inner}</View>
            )}
          </StaggeredRow>
        );
      })}
    </View>
  );
}

/* ──────────────────────── Tutte · Svolte · Annullate ─────────────────────── */

function HistoryList({
  sections,
  emptyFor,
}: {
  sections: { month: string; items: AutoscuolaAppointmentWithRelations[] }[];
  emptyFor: Tab;
}) {
  if (sections.length === 0) {
    if (emptyFor === 'cancelled') {
      return (
        <EmptyState
          icon="close-circle-outline"
          title="Nessuna guida annullata"
          text="Le guide che annulli compariranno qui."
        />
      );
    }
    if (emptyFor === 'done') {
      return (
        <EmptyState
          icon="checkmark-circle-outline"
          title="Nessuna guida svolta"
          text="Qui trovi le guide che hai già fatto."
        />
      );
    }
    return <EmptyState icon="calendar-outline" title="Nessuna guida" />;
  }

  let row = 0;
  return (
    <View style={s.list}>
      {sections.map((section) => (
        <View key={section.month} style={{ gap: 11 }}>
          <Text style={s.month}>{section.month}</Text>
          {section.items.map((lesson) => (
            <StaggeredRow key={lesson.id} index={row++}>
              <HistoryCard lesson={lesson} />
            </StaggeredRow>
          ))}
        </View>
      ))}
    </View>
  );
}

function HistoryCard({ lesson }: { lesson: AutoscuolaAppointmentWithRelations }) {
  const cancelled = isCancelledByStudent(lesson);
  const cancelledAt = lesson.cancelledAt ? new Date(lesson.cancelledAt) : null;
  const cutoff = lesson.penaltyCutoffAt ? new Date(lesson.penaltyCutoffAt) : null;
  const isLate = !!cancelledAt && !!cutoff && cancelledAt.getTime() > cutoff.getTime();
  const charged = lesson.lateCancellationAction === 'charged';
  const dismissed = lesson.lateCancellationAction === 'dismissed';
  const dim = cancelled || isNoShow(lesson);

  return (
    <View style={s.historyCard}>
      <Image
        source={lessonArtSource(lesson.vehicle?.licenseCategory)}
        style={[s.cardIcon, dim && s.cardIconDim]}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.cxTime} numberOfLines={1}>
          {formatTime(lesson.startsAt)}{lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}
        </Text>
        <Text style={s.cardDate} numberOfLines={1}>{formatDay(lesson.startsAt)}</Text>
        <Text style={s.cardInstructor} numberOfLines={1}>
          {lesson.instructor?.name ?? 'Da assegnare'}
        </Text>
        <View style={s.badges}>
          {isDone(lesson) ? (
            <View style={[s.badge, s.badgeDone]}>
              <Text style={[s.badgeText, s.badgeDoneText]}>Svolta</Text>
            </View>
          ) : null}
          {isNoShow(lesson) ? (
            <View style={[s.badge, s.badgeNoShow]}>
              <Text style={[s.badgeText, s.badgeNoShowText]}>Non presentato</Text>
            </View>
          ) : null}
          {isUpcoming(lesson, Date.now()) ? (
            <View style={[s.badge, s.badgeUpcoming]}>
              <Text style={[s.badgeText, s.badgeUpcomingText]}>In programma</Text>
            </View>
          ) : null}
          {cancelled ? (
            isLate ? (
              <>
                <View style={[s.badge, s.badgeLate]}>
                  <Text style={[s.badgeText, s.badgeLateText]}>Annullamento tardivo</Text>
                </View>
                {charged ? (
                  <View style={[s.badge, s.badgeCharged]}>
                    <Text style={[s.badgeText, s.badgeChargedText]}>
                      Addebitata{lesson.penaltyAmount != null ? ` ${formatEuro(lesson.penaltyAmount)}` : ''}
                    </Text>
                  </View>
                ) : dismissed ? (
                  <View style={[s.badge, s.badgeRefunded]}>
                    <Text style={[s.badgeText, s.badgeRefundedText]}>Non addebitata</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[s.badge, s.badgeCancelled]}>
                <Text style={[s.badgeText, s.badgeCancelledText]}>Annullata</Text>
              </View>
            )
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────── Pezzi comuni ───────────────────────────── */

/**
 * Entrata a cascata. Il ritardo si ferma a 10 righe: oltre, l'ultima card
 * arriverebbe mezzo secondo dopo la prima e sembrerebbe lentezza, non ritmo.
 */
function StaggeredRow({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 28).duration(260)}>
      {children}
    </Animated.View>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  text?: string;
}) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={s.centerState}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={24} color="#B4B4BD" />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 4 },

  // Quattro filtri in una riga sola: pillole compatte che si dividono lo
  // spazio, niente scorrimento orizzontale (una voce fuori schermo è una voce
  // che nessuno trova).
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: 16,
    backgroundColor: '#EEF0F3',
    borderRadius: 999,
    padding: 4,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 999,
    backgroundColor: '#1A1A2E',
  },
  pill: { flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center' },
  pillPressed: { opacity: 0.7 },
  pillText: { fontSize: 13, fontWeight: '500', color: '#595959' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  list: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 11 },
  month: { fontSize: 12, fontWeight: '600', color: '#A2A2AC', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6, marginLeft: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 14, paddingRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  cardIcon: { width: 38, height: 38 },
  cardIconDim: { opacity: 0.55 },
  cardTime: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  cardDate: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },
  cardInstructor: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  cardArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, paddingRight: 13,
    shadowColor: '#141428', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cxTime: { fontSize: 16, fontWeight: '700', color: '#3A3A48', letterSpacing: -0.3 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeDone: { backgroundColor: '#ECFDF3' },
  badgeDoneText: { color: '#067647' },
  badgeNoShow: { backgroundColor: '#FFF1F0' },
  badgeNoShowText: { color: '#B42318' },
  badgeUpcoming: { backgroundColor: '#EFF6FF' },
  badgeUpcomingText: { color: '#1D4ED8' },
  badgeCancelled: { backgroundColor: '#F1F1F5' },
  badgeCancelledText: { color: '#88888F' },
  badgeLate: { backgroundColor: '#FFF4E5' },
  badgeLateText: { color: '#B45309' },
  badgeCharged: { backgroundColor: '#1A1A2E' },
  badgeChargedText: { color: '#FFFFFF' },
  badgeRefunded: { backgroundColor: '#ECFDF3' },
  badgeRefundedText: { color: '#067647' },

  centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.md, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F1F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 13, fontWeight: '500', color: colors.textMuted, textAlign: 'center' },
});
