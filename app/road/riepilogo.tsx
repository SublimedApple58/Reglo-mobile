import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GlassCloseButton } from '../../src/components/GlassCloseButton';
import { SheetScaffold } from '../../src/components/SheetScaffold';
import { RoadRouteMap } from '../../src/components/road/RoadMiniMap';
import { RoadMarkerList } from '../../src/components/road/RoadMarkerList';
import { countSentiments, SentimentCounts } from '../../src/components/road/RoadSentiment';
import { lessonStudentName, useRoadState } from '../../src/road/roadStore';
import { useQueryClient } from '@tanstack/react-query';
import { exitRoad, refreshRoadSummary } from '../../src/road/roadActions';
import { openRoadPagellino } from '../../src/road/pagellino';
import { dayLabel, formatHm, formatKm, formatMinutes } from '../../src/road/format';
import { regloApi } from '../../src/services/regloApi';

type EvalState = { enabled: boolean; total: number; done: number } | null;

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
  const { summary } = useRoadState();
  const [ev, setEv] = useState<EvalState>(null);

  const appointmentId = summary?.appointmentId;
  const evalStamp = summary?.evaluation?.updatedAt ?? '';
  useEffect(() => {
    if (!appointmentId) return;
    let alive = true;
    regloApi
      .getAppointmentEvaluation(appointmentId)
      .then((data) => {
        if (!alive || !data) return;
        const active = (data.items ?? []).filter((it) => !it.archived);
        const scored = (data.scores ?? []).filter((sc) => sc.score != null || sc.notApplicable).length;
        setEv({ enabled: !!data.enabled, total: active.length, done: scored });
      })
      .catch(() => setEv(null));
    return () => {
      alive = false;
    };
  }, [appointmentId, evalStamp]);

  const queryClient = useQueryClient();
  const close = () => {
    // La guida è `completed` sul server: la card «In corso» della home va
    // ricaricata, altrimenti resta la versione in cache fino al prossimo giro.
    void queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap'] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
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

  const showPagellino = ev?.enabled && ev.total > 0;
  const pgEmpty = (ev?.done ?? 0) === 0;
  const pgComplete = !!ev && ev.done >= ev.total;

  const shown = summary.markers.slice(0, MAX_MARKERS);
  const more = summary.markers.length - shown.length;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <View style={s.doneK}>
            <View style={s.doneIc}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={s.doneKTx}>Guida completata</Text>
          </View>
          <Text style={s.name} numberOfLines={1}>{lessonStudentName(lesson)}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <GlassCloseButton onPress={close}>
          <Pressable onPress={close} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#3A3A3C" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <SheetScaffold
        footer={
          <View style={s.foot}>
            {showPagellino ? (
              <View style={[s.pg, pgComplete && s.pgDone]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pgTitle}>Pagellino</Text>
                  <Text style={[s.pgSub, pgComplete && s.pgSubDone]}>
                    {pgEmpty
                      ? 'Ancora da compilare'
                      : pgComplete
                        ? `${ev!.total} ${ev!.total === 1 ? 'voce' : 'voci'} · completo`
                        : `${ev!.done} ${ev!.done === 1 ? 'voce' : 'voci'} su ${ev!.total} · da completare`}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    openRoadPagellino(router, lesson, { showStayChip: false, onSaved: () => void refreshRoadSummary() })
                  }
                  style={({ pressed }) => [s.pgBtn, pressed && { opacity: 0.85 }]}
                  testID="road-summary-pagellino"
                >
                  <Text style={s.pgBtnTx}>{pgEmpty ? 'Compila' : pgComplete ? 'Apri' : 'Completa'}</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable onPress={close} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]} testID="road-summary-close">
              <Text style={s.closeTx}>Chiudi</Text>
            </Pressable>
          </View>
        }
      >
        <RoadRouteMap track={summary.track} markers={summary.markers} style={s.mini} />

        <View style={s.sum}>
          <View style={s.sumCol}>
            <Text style={s.sumNum}>
              {formatKm(summary.distanceMeters)} <Text style={s.sumUnit}>km</Text>
            </Text>
            <Text style={s.sumLabel}>Percorsi</Text>
          </View>
          <View style={[s.sumCol, s.sumSep]}>
            <Text style={s.sumNum}>
              {formatMinutes(summary.durationSec)} <Text style={s.sumUnit}>min</Text>
            </Text>
            <Text style={s.sumLabel}>Di guida</Text>
          </View>
          <View style={[s.sumCol, s.sumSep]}>
            <Text style={s.sumNum}>{summary.markers.length}</Text>
            <Text style={s.sumLabel}>Segnalazioni</Text>
          </View>
        </View>

        <SentimentCounts {...countSentiments(summary.markers)} style={{ marginTop: 14 }} />

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
            />
            {more > 0 ? (
              <Text style={s.more}>
                + {more} {more === 1 ? 'altra segnalazione' : 'altre segnalazioni'} sulla mappa
              </Text>
            ) : null}
          </View>
        ) : null}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  // form sheet: padding fisso, niente safe area (§13.2.1)
  root: { backgroundColor: '#FFFFFF', paddingTop: 24, paddingHorizontal: 22, paddingBottom: 18 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  doneK: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  doneIc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#067647',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneKTx: { fontSize: 12, fontWeight: '500', color: '#6A6A6A', letterSpacing: 0.7, textTransform: 'uppercase' },
  name: { fontSize: 28, fontWeight: '600', color: '#111111', letterSpacing: -0.7, marginTop: 8 },
  sub: { fontSize: 14.5, fontWeight: '400', color: '#6A6A6A', marginTop: 3 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mini: { height: 172, borderRadius: 24, marginTop: 16 },
  more: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 8 },
  foot: { marginTop: 14 },
  sum: { flexDirection: 'row', marginTop: 16 },
  sumCol: { flex: 1 },
  sumSep: { borderLeftWidth: 1, borderLeftColor: '#ECECEC', paddingLeft: 14 },
  sumNum: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  sumUnit: { fontSize: 13.5, fontWeight: '500', color: '#6A6A6A', letterSpacing: 0 },
  sumLabel: { fontSize: 12.5, fontWeight: '400', color: '#6A6A6A' },
  pg: {
    borderRadius: 22,
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FDF0B5',
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pgDone: { backgroundColor: '#F7F7F5', borderColor: '#ECECEA' },
  pgTitle: { fontSize: 15, fontWeight: '600', color: '#111111', letterSpacing: -0.2 },
  pgSub: { fontSize: 13, fontWeight: '400', color: '#8A6D12', marginTop: 2 },
  pgSubDone: { color: '#6A6A6A' },
  pgBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgBtnTx: { fontSize: 14.5, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  closeBtn: { height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  closeTx: { fontSize: 17, fontWeight: '500', color: '#111111', letterSpacing: -0.3 },
});
