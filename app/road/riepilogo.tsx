import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../src/components/SheetScaffold';
import { useNavigation, useRouter } from 'expo-router';

import { RoadRouteMap } from '../../src/components/road/RoadMiniMap';
import { RoadMarkerList } from '../../src/components/road/RoadMarkerList';
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
import { ClayButton, ClayStat, ClaySurface } from '../../src/components/clay';
import Animated from 'react-native-reanimated';
import { ROAD_EXIT, ROAD_LAYOUT, ROAD_TEXT_IN, roadEnter } from '../../src/road/motion';
import { RoadNotesCard } from '../../src/components/road/RoadNotesCard';
import { planOutcomeLine } from '../../src/road/planAlerts';

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

/** Oltre, «+N altre»: il foglio abbraccia il contenuto e non deve superare lo schermo. */
const MAX_MARKERS = 4;

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
        const active = (data.items ?? []).filter((it) => !it.archived);
        const scored = (data.scores ?? []).filter((sc) => sc.score != null || sc.notApplicable).length;
        setEv({ status: 'ok', enabled: !!data.enabled, total: active.length, done: scored });
      })
      .catch(() => {
        // Errore di rete: la card resta (se il pagellino è acceso) con «Riprova».
        if (alive) setEv((prev) => (prev || evaluationOn ? { status: 'error' } : null));
      });
    return () => {
      alive = false;
    };
  }, [appointmentId, evalStamp, evTry, evaluationOn]);

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

  if (!summary) return <View style={s.root} />;

  const lesson = summary.lesson;
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
      cta={
        <>
      <Animated.View style={s.foot} layout={ROAD_LAYOUT}>
        {showPagellino ? (
          <Animated.View entering={ROAD_TEXT_IN} exiting={ROAD_EXIT} layout={ROAD_LAYOUT}>
            <ClaySurface radius={24} style={s.pg}>
              <View style={{ flex: 1 }}>
                <Text style={s.pgTitle}>Pagellino</Text>
                {pgLine == null ? (
                  <View style={s.pgSkel} testID="road-summary-pagellino-loading" />
                ) : ev?.status === 'error' ? (
                  <Pressable
                    onPress={() => {
                      setEv({ status: 'loading' });
                      setEvTry((n) => n + 1);
                    }}
                    hitSlop={{ top: 10, bottom: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Stato del pagellino non disponibile, riprova"
                    testID="road-summary-pagellino-retry"
                  >
                    <Animated.Text entering={ROAD_TEXT_IN} style={s.pgSub}>
                      {pgLine} · <Text style={s.pgRetry}>Riprova</Text>
                    </Animated.Text>
                  </Pressable>
                ) : (
                  <Animated.Text key={pgLine} entering={ROAD_TEXT_IN} style={s.pgSub}>
                    {pgLine}
                  </Animated.Text>
                )}
              </View>
              <ClayButton
                compact
                variant={pgEmpty ? 'primary' : 'secondary'}
                title={pgEmpty ? 'Compila' : 'Modifica'}
                onPress={() =>
                  openRoadPagellino(router, lesson, { showStayChip: false, onSaved: () => void refreshRoadSummary() })
                }
                style={s.pgBtn}
                testID="road-summary-pagellino"
              />
            </ClaySurface>
          </Animated.View>
        ) : null}

        {/* Giro Road: le note subito alla fine, sotto il pagellino. */}
        <Animated.View entering={roadEnter(200)} layout={ROAD_LAYOUT}>
          <RoadNotesCard router={router} lesson={lesson} route="/road/note" style={showPagellino ? s.notesGap : undefined} />
        </Animated.View>

        <ClayButton variant="secondary" title="Chiudi" onPress={close} style={s.closeBtn} testID="road-summary-close" />
      </Animated.View>
        </>
      }
    >

      {/* La mappa si ritaglia nel figlio: l'ombra clay sta sul contenitore. */}
      <View style={[s.miniWrap, CLAY_SHADOW.raise]}>
        <RoadRouteMap track={summary.track} markers={summary.markers} stops={summary.stops} style={s.mini} />
      </View>

      <View style={s.sum}>
        <ClayStat value={formatKm(summary.distanceMeters)} unit="km" label="Percorsi" />
        <ClayStat value={formatMinutes(summary.durationSec)} unit="min" label="Di guida" />
        <ClayStat value={summary.markers.length} label="Segnalazioni" />
      </View>

      {/* REG-691: gli ultimi punti partono dopo la chiusura; i km si aggiornano da soli. */}
      {syncing ? (
        <Animated.Text entering={ROAD_TEXT_IN} exiting={ROAD_EXIT} style={s.syncTx} testID="road-summary-syncing">
          Ultimi metri del percorso in invio: i km si aggiornano da soli.
        </Animated.Text>
      ) : null}

      <SentimentCounts {...countSentiments(summary.markers)} style={{ marginTop: 14 }} />

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
            items={shown.map((m) => ({
              key: m.id,
              kind: m.kind,
              label: m.label,
              street: m.street,
              note: m.note,
              sentiment: m.sentiment ?? null,
              recordedAt: m.recordedAt,
            }))}
            // REG-696: si corregge anche dopo i 5 s dell'«Annulla».
            onPressItem={(id) => {
              const m = shown.find((x) => x.id === id);
              if (m) openRoadMarkerMenu(summary.id, m, () => void refreshRoadSummary());
            }}
          />
          {more > 0 ? (
            <Text style={s.more}>
              + {more} {more === 1 ? 'altra segnalazione' : 'altre segnalazioni'} sulla mappa
            </Text>
          ) : null}
        </View>
      ) : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: CLAY.bg },
  miniWrap: { borderRadius: 24, backgroundColor: CLAY.surface },
  mini: { height: 172, borderRadius: 24, overflow: 'hidden' },
  agendaLine: { marginTop: 14 },
  planTx: { fontSize: 15, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  syncTx: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 10, lineHeight: 18 },
  agendaTx: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, lineHeight: 19 },
  more: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 8 },
  foot: {},
  sum: { flexDirection: 'row', gap: 10, marginTop: 16 },
  pg: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingLeft: 18, paddingRight: 12 },
  pgTitle: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  pgSub: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 2 },
  pgRetry: { color: CLAY.ink, fontWeight: '600', textDecorationLine: 'underline' },
  // Stessa altezza della riga di testo: la card non cambia misura quando arrivano i numeri.
  pgSkel: { width: 120, height: 12, borderRadius: 6, backgroundColor: 'rgba(17,17,17,0.08)', marginTop: 5, marginBottom: 1 },
  pgBtn: { alignSelf: 'center', paddingHorizontal: 18, height: 40, borderRadius: 20 },
  // CTA secondaria a capsula: ultima cosa del foglio.
  closeBtn: { marginTop: 14 },
  notesGap: { marginTop: 10 },
});
