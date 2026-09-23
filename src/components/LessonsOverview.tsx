import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SheetScaffold } from './SheetScaffold';
import {
  LEDGER_PAD,
  LedgerFilterBar,
  StateGlyph,
  TONE,
  formatEuro,
  ledger,
  type FilterDef,
  type RowIcon,
  type RowTone,
} from './ledger/LedgerUI';
import { useAppointments } from '../hooks/queries/useAppointments';
import { formatDay, formatTime } from '../utils/date';
import { colors } from '../theme/colors';
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


const monthLabel = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
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


  const filterDefs: FilterDef<Tab>[] = [
    { value: 'all', label: 'Tutte', count: counts.all },
    { value: 'upcoming', label: 'Programmate', count: counts.upcoming },
    { value: 'done', label: 'Svolte', count: counts.done },
    { value: 'cancelled', label: 'Annullate', count: counts.cancelled },
  ];

  const sections =
    tab === 'upcoming'
      ? groupByMonth(upcoming)
      : tab === 'all'
        ? allSections
        : tab === 'done'
          ? doneSections
          : cancelledSections;

  const subtitle = (() => {
    if (tab === 'upcoming') return `${counts.upcoming} ${counts.upcoming === 1 ? 'guida' : 'guide'} in programma`;
    if (tab === 'done') return `${counts.done} ${counts.done === 1 ? 'guida svolta' : 'guide svolte'}`;
    if (tab === 'cancelled') return 'Le guide che hai annullato';
    return `${counts.all} ${counts.all === 1 ? 'guida' : 'guide'} in totale`;
  })();

  const loading = historyQuery.isLoading && !historyQuery.data;

  return (
    <>
      {/*
        Titolo e filtri stanno DENTRO lo scaffold, non accanto: in un form sheet
        deve esserci **un solo** contenitore scrollabile (design-system.md).
        Tenendo la barra filtri — che è una ScrollView orizzontale — come
        fratello di `SheetScaffold` (`flex: 1`), i due contenitori si
        contendevano l'altezza: la barra collassava e il suo contenuto
        traboccava sopra l'header e la X. È esattamente la struttura di
        Pagamenti, dove titolo, filtri e lista scorrono insieme.
      */}
      <SheetScaffold fill>
        <View style={s.header}>
          <Text style={s.title}>Le tue guide</Text>
          {/* La chiave forza il rimontaggio: il sottotitolo sfuma invece di
              scattare da un conteggio all'altro. */}
          <Animated.Text key={subtitle} entering={FadeIn.duration(180)} style={s.subtitle}>
            {subtitle}
          </Animated.Text>
        </View>

        <LedgerFilterBar defs={filterDefs} active={tab} onChange={setTab} style={s.filters} />

        {loading ? (
          <View style={s.centerState}>
            <ActivityIndicator color="#1A1A2E" />
          </View>
        ) : sections.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          // La chiave è il filtro: cambiandolo la lista si rimonta ed entra in
          // dissolvenza, invece di sostituirsi di colpo.
          <Animated.View key={tab} entering={FadeIn.duration(200)} style={s.list}>
            {(() => {
              let row = 0;
              return sections.map((section) => (
                <View key={section.month}>
                  <Text style={ledger.month}>{section.month}</Text>
                  {section.items.map((lesson, i) => (
                    <Animated.View
                      key={lesson.id}
                      // Cascata fermata a 10 righe: oltre, l'ultima card
                      // arriverebbe mezzo secondo dopo la prima e sembrerebbe
                      // lentezza, non ritmo.
                      entering={FadeInDown.delay(Math.min(row++, 10) * 26).duration(240)}
                    >
                      {i > 0 ? <View style={ledger.sep} /> : null}
                      <LessonRow lesson={lesson} onOpenDetail={onOpenDetail} />
                    </Animated.View>
                  ))}
                </View>
              ));
            })()}
          </Animated.View>
        )}
      </SheetScaffold>
    </>
  );
}

/* ─────────────────────────────────── riga ───────────────────────────────── */

/** Stato della guida → glifo a sinistra + etichetta colorata a destra. */
function lessonState(lesson: AutoscuolaAppointmentWithRelations): {
  tone: RowTone;
  icon: RowIcon;
  label: string;
} {
  if (lesson.type === 'esame') return { tone: 'violet', icon: 'exam', label: 'Esame' };
  if (isNoShow(lesson)) return { tone: 'red', icon: 'close', label: 'Non presentato' };
  if (isCancelledByStudent(lesson)) return { tone: 'grey', icon: 'close', label: 'Annullata' };
  if (isDone(lesson)) return { tone: 'green', icon: 'check', label: 'Svolta' };
  return { tone: 'grey', icon: 'clock', label: 'In programma' };
}

/** "gio 24 set" → "Gio 24 set", come i titoli di Pagamenti. */
const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function LessonRow({
  lesson,
  onOpenDetail,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  onOpenDetail?: (lesson: AutoscuolaAppointmentWithRelations) => void;
}) {
  const { tone, icon, label } = lessonState(lesson);

  // Il dettaglio della penale sta nella riga sotto, non a destra: a destra c'è
  // una parola sola, com'è in Pagamenti.
  const subtitle = (() => {
    const who = lesson.instructor?.name ?? 'Da assegnare';
    if (isCancelledByStudent(lesson)) {
      const cancelledAt = lesson.cancelledAt ? new Date(lesson.cancelledAt) : null;
      const cutoff = lesson.penaltyCutoffAt ? new Date(lesson.penaltyCutoffAt) : null;
      const late = !!cancelledAt && !!cutoff && cancelledAt.getTime() > cutoff.getTime();
      if (late && lesson.lateCancellationAction === 'charged') {
        return `Annullata tardi · Addebitata${lesson.penaltyAmount != null ? ` ${formatEuro(lesson.penaltyAmount)}` : ''}`;
      }
      if (late && lesson.lateCancellationAction === 'dismissed') return 'Annullata tardi · Non addebitata';
      if (late) return 'Annullata tardi';
      return who;
    }
    if (lesson.type === 'esame') return 'Esame';
    return `Guida · ${who}`;
  })();

  const body = (
    <View style={ledger.row}>
      <StateGlyph tone={tone} icon={icon} />
      <View style={ledger.rowBody}>
        <Text style={ledger.rowTitle} numberOfLines={1}>
          {capitalize(formatDay(lesson.startsAt))} · {formatTime(lesson.startsAt)}
        </Text>
        <Text style={ledger.rowSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={[ledger.rowValue, { color: TONE[tone].ink }]} numberOfLines={1}>
        {label}
      </Text>
      {onOpenDetail ? (
        <Ionicons name="chevron-forward" size={15} color="#C8C8D0" style={s.chevron} />
      ) : null}
    </View>
  );

  if (!onOpenDetail) return body;
  return (
    <Pressable
      onPress={() => onOpenDetail(lesson)}
      style={({ pressed }) => pressed && s.rowPressed}
    >
      {body}
    </Pressable>
  );
}

/* ────────────────────────────────── vuoti ───────────────────────────────── */

const EMPTY_COPY: Record<Tab, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text?: string }> = {
  all: { icon: 'calendar-outline', title: 'Nessuna guida' },
  upcoming: { icon: 'calendar-outline', title: 'Nessuna guida in programma' },
  done: { icon: 'checkmark-circle-outline', title: 'Nessuna guida svolta', text: 'Qui trovi le guide che hai già fatto.' },
  cancelled: { icon: 'close-circle-outline', title: 'Nessuna guida annullata', text: 'Le guide che annulli compariranno qui.' },
};

function EmptyState({ tab }: { tab: Tab }) {
  const copy = EMPTY_COPY[tab];
  return (
    <Animated.View entering={FadeIn.duration(220)} style={s.centerState}>
      <View style={s.emptyIcon}>
        <Ionicons name={copy.icon} size={24} color="#B4B4BD" />
      </View>
      <Text style={s.emptyTitle}>{copy.title}</Text>
      {copy.text ? <Text style={s.emptyText}>{copy.text}</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: LEDGER_PAD, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 4 },
  filters: { marginTop: 14, marginBottom: 2, flexGrow: 0 },

  list: { paddingBottom: 40 },
  rowPressed: { backgroundColor: '#FAFAFC' },
  chevron: { marginLeft: 6 },

  centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: LEDGER_PAD, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F1F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 13, fontWeight: '500', color: colors.textMuted, textAlign: 'center' },
});
