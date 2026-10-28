import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { regloApi } from '../services/regloApi';
import { isInstructor } from '../utils/roles';
import { roadStore, useRoadSelector } from './roadStore';
import { isInviteDismissed, resumeRoad } from './roadActions';
import { isRoadTrackingActive, stopRoadTracking } from './tracking';
import { roadUploader } from './uploader';
import { roadQueue } from './queue';
import { onRoadCheckRequest, ROAD_INVITE_ROUTE, ROAD_ROUTE, roadEntryStore, roadInviteOpen } from './entryFlow';

/** Mentre l'app resta aperta: l'invito deve comparire quando si apre la finestra (15 min prima). */
const RECHECK_MS = 60_000;

/**
 * REG-638 Reglo Road — regia della modalità Road (montata nell'AuthGate).
 *
 * - All'avvio, a ogni ritorno in primo piano, ogni minuto con l'app aperta e
 *   subito dopo «Presente» (`requestRoadCheck`) legge `/road/state`:
 *   · sessione attiva → rientra in Road (e riaccende il GPS dopo un kill);
 *   · guida idonea, invito non silenziato → apre il foglio «Entri in Road?».
 * - Instrada: con una sessione Road (attiva / in chiusura / riepilogo) l'app
 *   intera è `/road` (niente tab bar); senza, `/road` rimanda alla home.
 */
export function RoadController() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { status, autoscuolaRole } = useSession();
  const { enabled } = useRoadEnabled();
  const phase = useRoadSelector((s) => s.phase);
  const allowed = status === 'ready' && isInstructor(autoscuolaRole) && enabled;
  const root = segments[0];
  const rootRef = useRef(root);
  rootRef.current = root;
  const checking = useRef(false);
  const [veil, setVeil] = useState({ n: 0, color: ROAD_VEIL_OUT });

  const check = useCallback(async (opts: { force?: boolean } = {}) => {
    if (!allowed || checking.current) return;
    checking.current = true;
    try {
      const st = await regloApi.getRoadState();
      roadStore.setCatalog(st.catalog);
      roadStore.setRoadEnabled(st.roadEnabled);
      if (!st.roadEnabled) {
        roadStore.setEligible(null);
        return;
      }
      roadStore.setEligible(st.activeSession ? null : st.eligibleLesson);
      if (st.activeSession) {
        await resumeRoad(st.activeSession);
        return;
      }
      // Sessione chiusa altrove mentre l'app dormiva: si esce da Road. Vale
      // anche per il task GPS che iOS/Android ripristinano da soli dopo un
      // kill: senza sessione attiva non deve restare acceso.
      const phaseNow = roadStore.get().phase;
      if (phaseNow === 'active' || (phaseNow === 'idle' && (await isRoadTrackingActive()))) {
        await stopRoadTracking();
        roadUploader.stop();
        await roadQueue.detach();
        roadStore.reset();
        return;
      }
      const lesson = st.eligibleLesson;
      if (!lesson || roadStore.get().phase !== 'idle' || roadInviteOpen.current) return;
      if (rootRef.current !== '(tabs)') return;
      if (!opts.force && (await isInviteDismissed(lesson.appointmentId))) return;
      roadEntryStore.set({ lesson });
      roadInviteOpen.current = true;
      router.push(ROAD_INVITE_ROUTE);
    } catch {
      // rete assente / Road spento: nessun invito, si riprova al prossimo foreground
    } finally {
      checking.current = false;
    }
  }, [allowed, router]);

  // Avvio + ritorno in primo piano.
  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => void check(), 700);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    // Senza questo, con l'app rimasta aperta da prima della finestra l'invito
    // (e il bottone «Entra in Road») non arrivavano mai.
    const tick = setInterval(() => {
      if (AppState.currentState === 'active' && roadStore.get().phase === 'idle') void check();
    }, RECHECK_MS);
    const off = onRoadCheckRequest((req) => void check(req));
    return () => {
      clearTimeout(t);
      clearInterval(tick);
      sub.remove();
      off();
    };
  }, [allowed, check]);

  // Logout / cambio autoscuola con Road aperto: si spegne tutto.
  useEffect(() => {
    if (status === 'unauthenticated' && roadStore.get().phase !== 'idle') {
      void stopRoadTracking();
      roadUploader.stop();
      void roadQueue.clearAll();
      roadStore.reset();
    }
  }, [status]);

  // Instradamento: Road a tutto schermo finché c'è una sessione.
  useEffect(() => {
    if (status !== 'ready') return;
    const inRoad = root === 'road';
    if (phase !== 'idle' && !inRoad) {
      setVeil((v) => ({ n: v.n + 1, color: ROAD_VEIL_IN }));
      router.replace(ROAD_ROUTE);
    } else if (phase === 'idle' && inRoad) {
      setVeil((v) => ({ n: v.n + 1, color: ROAD_VEIL_OUT }));
      router.replace('/(tabs)/home');
    }
  }, [phase, root, router, status]);

  return <RouteVeil trigger={veil.n} color={veil.color} />;
}

/** Colore del velo: entrando quello della mappa, uscendo il bianco delle tab. */
const ROAD_VEIL_IN = '#F2F0EB';
const ROAD_VEIL_OUT = '#FFFFFF';
/** Durata del passaggio tab ↔ Road (Tiziano 28/10: corto, 200-250 ms, niente rimbalzo). */
export const ROAD_SWITCH_MS = 240;

/**
 * Passaggio tab ↔ Road: invece di vedere la tab bar sparire/ricomparire e i
 * fogli scivolare via, un velo del colore della schermata copre lo scambio e
 * si dissolve in 240 ms con easing morbido. Non intercetta i tocchi.
 */
function RouteVeil({ trigger, color }: { trigger: number; color: string }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    opacity.value = 1;
    opacity.value = withTiming(0, { duration: ROAD_SWITCH_MS, easing: Easing.out(Easing.cubic) });
  }, [trigger, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}
