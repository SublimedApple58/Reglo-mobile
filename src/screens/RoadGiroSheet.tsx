import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ExpandableText } from '../components/road/ExpandableText';
import { ActivityIndicator, Animated as RNAnimated, InteractionManager, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import type { RoadHotspot, RoadPlanStop, RoadStudentHotspot } from '../types/regloApi';
import { FormSheet } from '../components/SheetScaffold';
import { ClayButton, ClaySurface, Icon3D } from '../components/clay';
import { RoadPlanMap } from '../components/road/RoadPlanMap';
import { markerArt } from '../road/markerArt';
import { formatKm } from '../road/format';
import { giroSheetStore } from '../road/giroSheetStore';
import { orderGuideStops } from '../road/roadGuide';
import { roadFreeStore } from '../road/freeStartStore';
import { DEFAULT_HOTSPOT_PERIOD, hotspotsStore, loadHotspots } from '../road/hotspotsStore';
import {
  hasPlanOverride,
  planMinutesFor,
  planStopLabel,
  prefetchPlanRoute,
  resetPlanOverride,
  savePlanOverride,
  usePlan,
  usePlanChoice,
  usePlanRoute,
  useSavedPlan,
} from '../road/planStore';
import { CLAY, colors } from '../theme';

/** «alle 17:12» oggi, «il 29/10 alle 17:12» gli altri giorni. */
function savedWhen(iso: string) {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date().toDateString() === d.toDateString();
  return today ? `alle ${hm}` : `il ${d.getDate()}/${d.getMonth() + 1} alle ${hm}`;
}

/** Come il server (`PLAN_MAX_STOPS`). */
const MAX_STOPS = 3;
const ROW_H = 68;
/** Due tappe a meno di così sono lo stesso posto. */
const SAME_PLACE_M = 60;

const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return Math.sqrt(x * x + y * y) * 111_320;
};

function fromStudent(h: RoadStudentHotspot): RoadPlanStop {
  return {
    key: `student:${h.key}`,
    source: 'student',
    kind: h.kind,
    title: h.street ?? h.label,
    reason: `${h.label} da migliorare ${h.errors === 1 ? '1 volta' : `${h.errors} volte`} in ${h.sessions === 1 ? '1 guida' : `${h.sessions} guide`}`,
    lat: h.lat,
    lng: h.lng,
    street: h.street,
    minutes: 0,
    errors: h.errors,
    lastAt: h.lastAt,
    examRouteId: null,
    endLat: null,
    endLng: null,
  };
}

function fromSchool(h: RoadHotspot): RoadPlanStop {
  return {
    key: `school:${h.key}`,
    source: 'school',
    kind: h.kind,
    title: h.street ?? h.label,
    reason: `Qui sbagliano in tanti: ${h.label.toLowerCase()}, ${h.errors} errori di ${h.students} allievi`,
    lat: h.lat,
    lng: h.lng,
    street: h.street,
    minutes: 0,
    errors: h.errors,
    lastAt: h.lastAt,
    examRouteId: null,
    endLat: null,
    endLng: null,
  };
}

/**
 * REG-667 Reglo Road — foglio «Il giro» di una guida futura: mappa grande con
 * la linea suggerita (strade vere, chiusa in sede) e le tappe numerate; sotto
 * le tappe, che si tolgono (−), si riordinano (trascinando la maniglia) e si
 * aggiungono dai punti critici dell'allievo e dell'autoscuola (al massimo 3).
 * Salva = il giro modificato si salva sul server per questa guida (REG-668,
 * `savePlanOverride`): spinner sul bottone, il foglio si chiude solo quando il
 * server risponde; errore = messaggio sotto le tappe e il foglio resta aperto.
 * Riaprendo si vede il giro salvato («Salvato alle …»), con «Torna al giro
 * suggerito». La linea si ricalcola sull'ordine scelto.
 */
export default function RoadGiroSheet() {
  const router = useRouter();
  const [sel] = useState(() => giroSheetStore.get());
  const res = usePlan(sel?.studentId, sel?.durationMin ?? 60, sel?.appointmentId);
  const saved = useSavedPlan(sel?.appointmentId);
  const [, setOn] = usePlanChoice(sel?.studentId);
  const free = useSyncExternalStore(roadFreeStore.subscribe, roadFreeStore.get);
  const hq = free?.headquarters ?? null;
  const start = useMemo(() => (hq ? { lat: hq.lat, lng: hq.lng } : null), [hq]);

  const plan = res?.plan ?? null;
  const custom = hasPlanOverride(sel?.appointmentId);
  const baseRoute = usePlanRoute(start, plan?.stops ?? null, !custom);
  const baseOrdered = useMemo(
    () => (plan ? (custom ? plan.stops : orderGuideStops(plan.stops, baseRoute?.order)) : []),
    [plan, baseRoute?.order, custom],
  );

  const [draft, setDraft] = useState<RoadPlanStop[] | null>(null);
  const stops = draft ?? baseOrdered;
  // Dopo un salvataggio riuscito la bozza resta a schermo (niente salto alla
  // lista di prima) ma non conta più come modifica: il foglio si chiude da sé.
  const [closing, setClosing] = useState(false);
  const dirty = draft !== null && !closing;
  // La chiusura parte DOPO il render con `dirty` falso: chiamando router.back()
  // nello stesso giro di setState, il blocco «modifiche non salvate» era ancora
  // attivo e chiedeva «Vuoi uscire senza salvare?» su un giro già salvato.
  useEffect(() => {
    if (closing) router.back();
  }, [closing, router]);
  const [step, setStep] = useState<'edit' | 'add'>('edit');
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La linea dell'ordine scelto (niente riottimizzazione): parte quando cambia la bozza.
  const draftRoute = usePlanRoute(start, dirty ? draft : null, false);
  useEffect(() => {
    if (!dirty || !start || !draft?.length) return;
    void prefetchPlanRoute(start, draft, false);
  }, [dirty, draft, start]);
  // Mentre arriva la linea nuova resta quella di prima (niente mappa vuota).
  const lastRoute = React.useRef<typeof baseRoute>(undefined);
  const fresh = dirty ? draftRoute : baseRoute;
  if (fresh !== undefined) lastRoute.current = fresh;
  const route = fresh ?? lastRoute.current;
  const minutes = planMinutesFor(route?.lengthMeters, stops.length) ?? plan?.minutes ?? null;

  // Punti critici dell'autoscuola per «Aggiungi una tappa» (di solito già scaldati).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (!hotspotsStore.list(DEFAULT_HOTSPOT_PERIOD)) void loadHotspots(DEFAULT_HOTSPOT_PERIOD).catch(() => undefined);
    });
    return () => task.cancel();
  }, []);

  const candidates = useMemo(() => {
    const own = (res?.studentHotspots ?? []).map(fromStudent);
    const school = (hotspotsStore.list(DEFAULT_HOTSPOT_PERIOD)?.hotspots ?? []).map(fromSchool);
    const out: RoadPlanStop[] = [];
    for (const c of [...own, ...school]) {
      if ([...stops, ...out].some((x) => meters(x, c) < SAME_PLACE_M)) continue;
      out.push(c);
    }
    return out.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res?.studentHotspots, stops, step]);

  const remove = useCallback(
    (key: string) => {
      Haptics.selectionAsync().catch(() => undefined);
      setError(null);
      setDraft(stops.filter((x) => x.key !== key));
    },
    [stops],
  );
  const move = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      Haptics.selectionAsync().catch(() => undefined);
      const next = [...stops];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      setError(null);
      setDraft(next);
    },
    [stops],
  );
  const add = useCallback(
    (c: RoadPlanStop) => {
      Haptics.selectionAsync().catch(() => undefined);
      setError(null);
      setDraft([...stops, c]);
      setStep('edit');
    },
    [stops],
  );

  const save = async () => {
    if (!sel || busy) return;
    if (!dirty || !draft) {
      router.back();
      return;
    }
    setBusy('save');
    setError(null);
    try {
      await savePlanOverride(sel.appointmentId, { stops: draft, minutes: minutes ?? plan?.minutes ?? 0 });
      setOn(true);
      setClosing(true);
    } catch {
      setBusy(null);
      setError('Non sono riuscito a salvare il giro. Controlla la connessione e riprova.');
    }
  };

  // «Torna al giro suggerito»: il foglio resta aperto e mostra il proposto.
  const reset = async () => {
    if (!sel || busy) return;
    setBusy('reset');
    setError(null);
    try {
      await resetPlanOverride(sel.appointmentId);
      Haptics.selectionAsync().catch(() => undefined);
      setDraft(null);
    } catch {
      setError('Non sono riuscito a tornare al giro suggerito. Riprova.');
    }
    setBusy(null);
  };

  if (!sel || !plan) {
    return (
      <FormSheet title="Il giro" testID="giro-sheet">
        <Text style={s.muted}>Giro non disponibile.</Text>
      </FormSheet>
    );
  }

  const km = route?.lengthMeters != null ? `${formatKm(route.lengthMeters)} km · ` : '';
  const subtitle =
    step === 'add'
      ? 'Dai punti critici dell’allievo e dell’autoscuola'
      : `${stops.length === 1 ? '1 tappa' : `${stops.length} tappe`} · ${km}circa ${minutes ?? plan.minutes} min`;

  return (
    <FormSheet
      title={step === 'add' ? 'Aggiungi una tappa' : 'Il giro'}
      subtitle={subtitle}
      contentKey={step}
      dirty={dirty}
      busy={busy !== null}
      cta={
        step === 'edit' ? (
          <ClayButton title="Salva" onPress={save} loading={busy === 'save'} disabled={busy === 'reset'} testID="giro-save" />
        ) : (
          <ClayButton title="Indietro" variant="secondary" onPress={() => setStep('edit')} testID="giro-add-back" />
        )
      }
      testID="giro-sheet"
    >
      {step === 'edit' ? (
        <View>
          <View style={s.map} testID="giro-map">
            <RoadPlanMap line={route?.line} stops={stops} start={start} interactive edgePadding={34} />
          </View>
          <ClaySurface padded={false} style={s.list}>
            {stops.map((st, i) => (
              <StopRow
                key={st.key}
                stop={st}
                index={i}
                count={stops.length}
                canRemove={stops.length > 1}
                onRemove={remove}
                onMove={move}
              />
            ))}
            {stops.length < MAX_STOPS ? (
              <Pressable
                onPress={() => setStep('add')}
                style={({ pressed }) => [s.addRow, stops.length > 0 && s.sep, pressed && s.pressed]}
                testID="giro-add"
              >
                <View style={s.plus}>
                  <Ionicons name="add" size={16} color={CLAY.ink} />
                </View>
                <Text style={s.addTx}>Aggiungi una tappa</Text>
              </Pressable>
            ) : null}
          </ClaySurface>
          {error ? (
            <Text style={s.error} testID="giro-error">
              {error}
            </Text>
          ) : null}
          {custom && saved && !dirty ? (
            <View style={s.savedRow} testID="giro-saved">
              <Text style={s.savedTx} numberOfLines={1}>
                Giro modificato · salvato {savedWhen(saved.updatedAt)}
              </Text>
              <Pressable
                onPress={reset}
                disabled={busy !== null}
                hitSlop={8}
                style={({ pressed }) => [s.resetBtn, pressed && s.pressed]}
                accessibilityRole="button"
                testID="giro-reset"
              >
                {busy === 'reset' ? <ActivityIndicator size="small" color={CLAY.ink} /> : null}
                <Text style={s.resetTx}>Torna al giro suggerito</Text>
              </Pressable>
            </View>
          ) : null}
          {!start ? <Text style={s.note}>Senza la sede la linea non si può disegnare: restano le tappe.</Text> : null}
        </View>
      ) : (
        <ClaySurface padded={false} style={s.list}>
          {candidates.length ? (
            candidates.map((c, i) => (
              <Pressable
                key={c.key}
                onPress={() => add(c)}
                style={({ pressed }) => [s.cand, i > 0 && s.sep, pressed && s.pressed]}
                testID="giro-candidate"
              >
                <Icon3D source={markerArt(c.kind ?? 'altro')} size={36} />
                <View style={s.stopText}>
                  <Text style={s.stopTitle} numberOfLines={1}>{planStopLabel(c)}</Text>
                  <ExpandableText text={c.reason} numberOfLines={2} style={s.reason} />
                </View>
                <Ionicons name="add-circle-outline" size={22} color={CLAY.ink} />
              </Pressable>
            ))
          ) : (
            <Text style={[s.muted, { padding: 18 }]}>Nessun altro punto critico da aggiungere.</Text>
          )}
        </ClaySurface>
      )}
    </FormSheet>
  );
}

/**
 * Una tappa: «−» per toglierla, il numero, via e motivo, la maniglia. Si
 * trascina dalla maniglia: la riga segue il dito e al rilascio va al posto più
 * vicino (righe ad altezza fissa). Niente animazioni di layout (§15).
 */
const StopRow = React.memo(function StopRow({
  stop,
  index,
  count,
  canRemove,
  onRemove,
  onMove,
}: {
  stop: RoadPlanStop;
  index: number;
  count: number;
  canRemove: boolean;
  onRemove: (key: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  // PanResponder (JS) e non gesture-handler: nel form sheet nativo il Pan di
  // gesture-handler non riceveva il trascinamento; il responder JS blocca lo
  // scroll del foglio mentre si trascina (onShouldBlockNativeResponder).
  const dy = React.useRef(new RNAnimated.Value(0)).current;
  const [lifted, setLifted] = useState(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => setLifted(true),
        onPanResponderMove: (_e, g) => {
          dy.setValue(Math.max(-index * ROW_H, Math.min((count - 1 - index) * ROW_H, g.dy)));
        },
        onPanResponderRelease: (_e, g) => {
          // Tocco senza trascinare = un posto più su (la prima va in fondo).
          const tap = Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6;
          const to = tap
            ? (index + count - 1) % count
            : Math.max(0, Math.min(count - 1, index + Math.round(g.dy / ROW_H)));
          dy.setValue(0);
          setLifted(false);
          onMove(index, to);
        },
        onPanResponderTerminate: () => {
          dy.setValue(0);
          setLifted(false);
        },
      }),
    [dy, index, count, onMove],
  );
  return (
    <RNAnimated.View style={[s.row, index > 0 && !lifted && s.sep, lifted && s.rowLifted, { transform: [{ translateY: dy }] }]} testID="giro-stop">
      <Pressable
        onPress={() => onRemove(stop.key)}
        disabled={!canRemove}
        hitSlop={8}
        style={[s.minus, !canRemove && s.minusOff]}
        accessibilityLabel={`Togli ${stop.title}`}
        testID="giro-stop-remove"
      >
        <View style={s.minusBar} />
      </Pressable>
      <View style={s.num}>
        <Text style={s.numTx}>{index + 1}</Text>
      </View>
      <View style={s.stopText}>
        <Text style={s.stopTitle} numberOfLines={1}>{planStopLabel(stop)}</Text>
        <ExpandableText text={stop.reason} numberOfLines={1} style={s.reason} />
      </View>
      {count > 1 ? (
        <View {...pan.panHandlers} style={s.handle} accessibilityRole="adjustable" accessibilityLabel="Sposta: trascina, o tocca per salire di un posto" testID="giro-stop-handle">
          <View style={s.handleBar} />
          <View style={s.handleBar} />
          <View style={s.handleBar} />
        </View>
      ) : null}
    </RNAnimated.View>
  );
});

const s = StyleSheet.create({
  muted: { fontSize: 15, lineHeight: 21, color: CLAY.ink3 },
  map: { height: 280, borderRadius: 22, overflow: 'hidden', backgroundColor: '#F2F1EE', marginTop: 4 },
  list: { marginTop: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLAY.hairline },
  pressed: { opacity: 0.6 },
  rowLifted: { zIndex: 2, backgroundColor: '#FFFFFF', boxShadow: '0px 8px 20px rgba(0,0,0,0.16)' },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 18 },
  minus: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F0F0EE', alignItems: 'center', justifyContent: 'center' },
  minusOff: { opacity: 0.35 },
  minusBar: { width: 11, height: 2, borderRadius: 1, backgroundColor: CLAY.ink },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: CLAY.ink, alignItems: 'center', justifyContent: 'center' },
  numTx: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stopText: { flex: 1, minWidth: 0 },
  stopTitle: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  reason: { fontSize: 13.5, color: CLAY.ink3, marginTop: 2 },
  handle: { width: 34, height: ROW_H, alignItems: 'center', justifyContent: 'center', gap: 4 },
  handleBar: { width: 18, height: 2, borderRadius: 1, backgroundColor: '#B9B9B9' },
  addRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  plus: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#CFCFCB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink },
  cand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  note: { fontSize: 13, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },
  error: { fontSize: 13.5, lineHeight: 19, color: colors.destructive, marginTop: 12, paddingHorizontal: 4 },
  savedRow: { marginTop: 14, paddingHorizontal: 4, gap: 6 },
  savedTx: { fontSize: 13.5, color: CLAY.ink3 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  resetTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
});
