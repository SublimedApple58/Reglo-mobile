import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../src/components/SheetScaffold';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RoadRouteMap } from '../../src/components/road/RoadMiniMap';
import { RoadMarkerList, toMarkerItem } from '../../src/components/road/RoadMarkerList';
import { roadMarkerKey } from '../../src/components/road/RoadMiniMap';
import { ripassoHandoff } from '../../src/road/ripasso';
import { RoadCheckList } from '../../src/components/road/RoadCheckList';
import { countSentiments, SentimentCounts } from '../../src/components/road/RoadSentiment';
import { lessonStudentName, useRoadSelector } from '../../src/road/roadStore';
import { useQueryClient } from '@tanstack/react-query';
import { exitRoad, refreshRoadSummary } from '../../src/road/roadActions';
import { openRoadPagellino } from '../../src/road/pagellino';
import { openRoadMarkerMenu } from '../../src/road/markerMenu';
import { dayLabel, formatHm, formatKm, formatMinutes } from '../../src/road/format';
import { regloApi } from '../../src/services/regloApi';
import { roadFreeStarted } from '../../src/road/freeStartStore';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { ClayButton, ClayStat } from '../../src/components/clay';
import Animated from 'react-native-reanimated';
import { ROAD_EXIT, ROAD_LAYOUT, ROAD_TEXT_IN, roadEnter } from '../../src/road/motion';
import { openRoadNotes, useRoadNotes } from '../../src/road/roadNotes';
import { planOutcomeLine } from '../../src/road/planAlerts';
import { roadQueue } from '../../src/road/queue';
import { cachedRoadEvaluation } from '../../src/road/offlineLesson';
import type { AppointmentEvaluation, RoadLesson } from '../../src/types/regloApi';

/**
 * REG-694 (1.7): il pagellino non sparisce più se la lettura fallisce. Se in
 * guida era acceso, la card c'è da subito (scheletro), poi i numeri; in errore
 * resta con «Riprova».
 */
type EvalState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; enabled: boolean; total: number; done: number }
  | null;

/** Voci attive e voci valutate del pagellino. */
function evalCounts(data: AppointmentEvaluation): EvalState {
  const active = (data.items ?? []).filter((it) => !it.archived);
  const scored = (data.scores ?? []).filter((sc) => sc.score != null || sc.notApplicable).length;
  return { status: 'ok', enabled: !!data.enabled, total: active.length, done: scored };
}

/**
 * Le prime righe; l'elenco intero è nel foglio «Tutte le N segnalazioni»
 * (REG-715, con la mappa), che si apre anche toccando la minimappa.
 */
const MAX_MARKERS = 3;

/**
 * REG-638 — riepilogo a fine guida (form sheet che abbraccia il contenuto, CTA
 * ancorate in fondo: design-system §13.2.1). Numeri, percorso e
 * segnalazioni sono quelli del server (risposta di `POST /end`). «Chiudi»
 * esce da Road e riporta all'app normale.
 */
export default function RiepilogoScreen() {
  const router = useRouter();
  const summary = useRoadSelector((s) => s.summary);
  const syncing = useRoadSelector((s) => s.summarySyncing);
  const provisional = useRoadSelector((s) => s.summaryProvisional);
  const evaluationOn = useRoadSelector((s) => s.evaluationEnabled);
  const [ev, setEv] = useState<EvalState>(() => (evaluationOn ? { status: 'loading' } : null));
  const [evTry, setEvTry] = useState(0);

  const appointmentId = summary?.appointmentId;
  const evalStamp = summary?.evaluation?.updatedAt ?? '';
  useEffect(() => {
    if (!appointmentId) return;
    let alive = true;
    regloApi
      .getAppointmentEvaluation(appointmentId)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setEv({ status: 'ok', enabled: false, total: 0, done: 0 });
          return;
        }
        setEv(evalCounts(data));
      })
      .catch(() => {
        if (!alive) return;
        // REG-714: senza rete i numeri del pagellino letto all'ingresso in
        // Road, con i voti in coda. Mai letto: la card resta con «Riprova».
        const cached = cachedRoadEvaluation(appointmentId);
        if (cached) setEv(evalCounts(cached));
        else setEv((prev) => (prev || evaluationOn ? { status: 'error' } : null));
      });
    return () => {
      alive = false;
    };
  }, [appointmentId, evalStamp, evTry, evaluationOn]);

  // REG-714: note o pagellino salvati senza rete, ancora sul telefono.
  const lessonQueued = useSyncExternalStore(roadQueue.subscribe, () =>
    appointmentId
      ? roadQueue.queuedLesson(appointmentId, 'notes') !== undefined ||
        roadQueue.queuedLesson(appointmentId, 'evaluations') !== undefined
      : false,
  );

  // Guida nata da Road libero: in agenda la fine segue l'ora reale.
  const freeStarted = useSyncExternalStore(roadFreeStarted.subscribe, roadFreeStarted.get);

  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const close = () => {
    // La guida è `completed` sul server: la card «In corso» della home va
    // ricaricata, altrimenti resta la versione in cache fino al prossimo giro.
    void queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    roadFreeStarted.set(null);
    // Il foglio se ne va SENZA la sua animazione nativa (~300 ms di scivolata
    // sopra l'agenda): il passaggio lo fa il velo di RoadController, 240 ms.
    navigation.setOptions({ animation: 'none' });
    void exitRoad();
    // RoadController riporta alla home appena la fase torna `idle`.
  };

  const pgLesson = summary?.lesson;
  const openPagellino = useCallback(() => {
    if (!pgLesson) return;
    openRoadPagellino(router, pgLesson, {
      showStayChip: false,
      onSaved: () => {
        void refreshRoadSummary();
        setEvTry((n) => n + 1);
      },
    });
  }, [router, pgLesson]);

  // REG-715: «Compila il pagellino» dall'ultima scheda del ripasso.
  useFocusEffect(
    useCallback(() => {
      if (ripassoHandoff.take()) openPagellino();
    }, [openPagellino]),
  );

  if (!summary) return <View style={s.root} />;

  const lesson = summary.lesson;
  const hasMarkers = summary.markers.length > 0;
  const firstName = lessonStudentName(lesson).split(' ')[0];
  const openAll = () => router.push('/road/segnalazioni');
  const sub = [
    dayLabel(lesson.startsAt),
    `${formatHm(lesson.startsAt)} – ${formatHm(summary.endedAt ?? lesson.endsAt)}`,
    lesson.vehicle?.name ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const evOk = ev?.status === 'ok' ? ev : null;
  const showPagellino = !!ev && (ev.status !== 'ok' || (ev.enabled && ev.total > 0));
  const pgEmpty = (evOk?.done ?? 0) === 0;
  const pgComplete = !!evOk && evOk.done >= evOk.total;
  const pgLine = !ev || ev.status === 'loading'
    ? null
    : ev.status === 'error'
      ? 'Stato non disponibile'
      : pgEmpty
        ? 'Ancora da compilare'
        : pgComplete
          ? `${ev.total} ${ev.total === 1 ? 'voce' : 'voci'} · completo`
          : `${ev.done} ${ev.done === 1 ? 'voce valutata' : 'voci valutate'} su ${ev.total}`;

  // REG-715: con segnalazioni il ripasso; senza, il pagellino (se acceso e non
  // completo); altrimenti «Fine». La X in alto chiude sempre.
  const pagellinoOn = evaluationOn ? !evOk || (evOk.enabled && evOk.total > 0) : showPagellino;
  const primary = hasMarkers
    ? { title: `Ripassa con ${firstName}`, onPress: () => router.push('/road/ripasso'), testID: 'road-summary-ripasso' }
    : pagellinoOn && !pgComplete
      ? { title: 'Compila il pagellino', onPress: openPagellino, testID: 'road-summary-pagellino-cta' }
      : { title: 'Fine', onPress: close, testID: 'road-summary-close' };

  const shown = summary.markers.slice(0, MAX_MARKERS);
  const more = summary.markers.length - shown.length;

  return (
    <FormSheet
      title={lessonStudentName(lesson)}
      subtitle={`Guida completata · ${sub}`}
      testID="road-summary"
      onClose={close}
      // Trascinarlo giù = «Chiudi»: si esce da Road, non resta un foglio orfano.
      closeOnGesture
      // Footer leggero (Tiziano 04/11): UNA sola CTA. Chiudere = la X del foglio.
      cta={
        <ClayButton
          title={primary.title}
          onPress={primary.onPress}
          testID={primary.testID}
        />
      }
    >

      {/* La mappa si ritaglia nel figlio: l'ombra clay sta sul contenitore. */}
      <Pressable
        onPress={hasMarkers ? openAll : undefined}
        disabled={!hasMarkers}
        accessibilityRole={hasMarkers ? 'button' : undefined}
        accessibilityLabel={hasMarkers ? 'Apri tutte le segnalazioni sulla mappa' : undefined}
        testID="road-summary-map"
        style={({ pressed }) => [s.miniWrap, CLAY_SHADOW.raise, pressed && s.mapPressed]}
      >
        <RoadRouteMap track={summary.track} markers={summary.markers} stops={summary.stops} style={s.mini} />
      </Pressable>

      <View style={s.sum}>
        <ClayStat value={formatKm(summary.distanceMeters)} unit="km" label="Distanza" />
        <ClayStat value={formatMinutes(summary.durationSec)} unit="min" label="Di guida" />
        <ClayStat value={summary.markers.length} label="Segnalazioni" />
      </View>

      {/* REG-714: chiusa senza rete, numeri del telefono finché la chiusura non arriva. */}
      {provisional ? (
        <Animated.Text entering={ROAD_TEXT_IN} exiting={ROAD_EXIT} style={s.syncTx} testID="road-summary-offline">
          Chiusa senza rete. Km e minuti sono quelli del telefono: si confermano appena torna la connessione.
        </Animated.Text>
      ) : syncing ? (
        /* REG-691: gli ultimi punti partono dopo la chiusura; i km si aggiornano da soli. */
        <Animated.Text entering={ROAD_TEXT_IN} exiting={ROAD_EXIT} style={s.syncTx} testID="road-summary-syncing">
          Ultimi metri del percorso in invio: i km si aggiornano da soli.
        </Animated.Text>
      ) : null}

      <SentimentCounts {...countSentiments(summary.markers)} style={{ marginTop: 14 }} />

      {/* Pagellino e note: righe native con divisore e chevron (niente card né bottoni). */}
      <View style={s.rows}>
        {showPagellino ? (
          <Animated.View entering={ROAD_TEXT_IN} exiting={ROAD_EXIT}>
            <SummaryRow
              title="Pagellino"
              onPress={
                ev?.status === 'error'
                  ? () => {
                      setEv({ status: 'loading' });
                      setEvTry((n) => n + 1);
                    }
                  : openPagellino
              }
              testID="road-summary-pagellino"
              accessibilityHint={ev?.status === 'error' ? 'Riprova a leggere lo stato' : 'Apri il pagellino'}
            >
              {pgLine == null ? (
                <View style={s.skel} testID="road-summary-pagellino-loading" />
              ) : (
                <Animated.Text key={pgLine} entering={ROAD_TEXT_IN} style={s.rowSub} numberOfLines={1}>
                  {pgLine}
                  {ev?.status === 'error' ? <Text style={s.retry}> · Riprova</Text> : null}
                </Animated.Text>
              )}
            </SummaryRow>
          </Animated.View>
        ) : null}
        <NotesRow lesson={lesson} onPress={() => void openRoadNotes(router, lesson, '/road/note')} />
        {lessonQueued ? (
          <Animated.Text entering={ROAD_TEXT_IN} exiting={ROAD_EXIT} style={s.queuedTx} testID="road-summary-queued">
            Salvato sul telefono: parte appena torna la rete.
          </Animated.Text>
        ) : null}
      </View>

      {/* REG-650: l'esito del giro, dal server (tappa entro 40 m, percorso d'esame al 60%). */}
      {planOutcomeLine(summary.planReached) ? (
        <Animated.View entering={roadEnter(100)} layout={ROAD_LAYOUT} style={s.agendaLine}>
          <Text style={s.planTx} testID="road-summary-plan">{planOutcomeLine(summary.planReached)}</Text>
        </Animated.View>
      ) : null}

      {/* REG-681: «Meglio» / «Ancora no» segnati passando sui punti critici. */}
      {summary.hotspotChecks?.length ? (
        <Animated.View entering={roadEnter(110)} layout={ROAD_LAYOUT}>
          <RoadCheckList checks={summary.hotspotChecks} />
        </Animated.View>
      ) : null}

      {freeStarted && freeStarted.sessionId === summary.id ? (
        <Animated.View entering={roadEnter(120)} layout={ROAD_LAYOUT} style={s.agendaLine}>
          <Text style={s.agendaTx}>
            In agenda diventa {formatHm(lesson.startsAt)}–{formatHm(lesson.endsAt)}. Prezzo e crediti restano quelli
            dei {freeStarted.bookedMinutes} minuti scelti.
          </Text>
        </Animated.View>
      ) : null}

      {shown.length ? (
        <View style={{ marginTop: 6 }}>
          <RoadMarkerList
            items={shown.map(toMarkerItem)}
            // REG-696: si corregge anche dopo i 5 s dell'«Annulla».
            onPressItem={(key) => {
              const m = shown.find((x) => roadMarkerKey(x) === key);
              if (m) openRoadMarkerMenu(summary.id, m, () => void refreshRoadSummary());
            }}
          />
          {more > 0 ? (
            <Pressable
              onPress={openAll}
              style={({ pressed }) => [s.allRow, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              testID="road-summary-all"
            >
              <Text style={s.allTx}>Tutte le {summary.markers.length} segnalazioni</Text>
              <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </FormSheet>
  );
}

/** Riga nativa del riepilogo: titolo, stato in grigio, chevron; divisore sottile sopra. */
function SummaryRow({
  title,
  children,
  onPress,
  testID,
  accessibilityHint,
}: {
  title: string;
  children: React.ReactNode;
  onPress: () => void;
  testID?: string;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <View style={s.rowTx}>
        <Text style={s.rowTitle}>{title}</Text>
        {children}
      </View>
      <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
    </Pressable>
  );
}

/** «Note sulla guida»: l'inizio della nota o l'invito a scriverla. */
function NotesRow({ lesson, onPress }: { lesson: RoadLesson; onPress: () => void }) {
  const note = useRoadNotes(lesson);
  return (
    <SummaryRow title="Note sulla guida" onPress={onPress} testID="road-notes-card">
      {note === undefined ? (
        <View style={s.skel} />
      ) : (
        <Animated.Text key={note ?? '-'} entering={ROAD_TEXT_IN} style={s.rowSub} numberOfLines={1}>
          {note || 'Cosa ricordare di questa guida'}
        </Animated.Text>
      )}
    </SummaryRow>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: CLAY.bg },
  miniWrap: { borderRadius: 24, backgroundColor: CLAY.surface },
  mini: { height: 172, borderRadius: 24, overflow: 'hidden' },
  agendaLine: { marginTop: 14 },
  planTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  syncTx: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 10, lineHeight: 18 },
  queuedTx: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 8, lineHeight: 18 },
  rows: { marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  rowTx: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  rowSub: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 2 },
  retry: { color: CLAY.ink, fontWeight: '500' },
  // Stessa altezza della riga di testo: la riga non cambia misura quando arriva lo stato.
  skel: { width: 120, height: 12, borderRadius: 6, backgroundColor: 'rgba(17,17,17,0.08)', marginTop: 5, marginBottom: 1 },
  agendaTx: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, lineHeight: 19 },
  mapPressed: { transform: [{ scale: 0.98 }] },
  // Riga «Tutte le N segnalazioni»: come le righe sopra (divisore, 52 di altezza), chevron a destra.
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  allTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  sum: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
