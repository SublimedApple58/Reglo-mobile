import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { prefetchLessonPlan } from './planStore';
import { regloApi } from '../services/regloApi';
import { isInstructor } from '../utils/roles';
import { roadStore, useRoadSelector } from './roadStore';
import { isInviteDismissed, resumeRoad } from './roadActions';
import { isRoadTrackingActive, stopRoadTracking } from './tracking';
import { roadUploader } from './uploader';
import { loadQueue, roadQueue } from './queue';
import { onRoadCheckRequest, ROAD_INVITE_ROUTE, ROAD_ROUTE, roadEntryStore, roadInviteOpen } from './entryFlow';
import { ROAD_COVER_MS, ROAD_SWITCH_MS, roadMiniStore, useRoadMinimized } from './miniStore';
import { roadNightNow } from './night';

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
 *   REG-700: con la guida in corso ridotta (`miniStore`) si resta nelle tab,
 *   con la barra «Torna in Road» sopra la tab bar.
 */
export function RoadController() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { status, autoscuolaRole, user } = useSession();
  const { enabled } = useRoadEnabled();
  const phase = useRoadSelector((s) => s.phase);
  const minimized = useRoadMinimized();
  const allowed = status === 'ready' && isInstructor(autoscuolaRole) && enabled;
  const root = segments[0];
  const rootRef = useRef(root);
  rootRef.current = root;
  const checking = useRef(false);
  const veil = useRef<RouteVeilHandle>(null);
  const switching = useRef(false);

  const check = useCallback(async (opts: { force?: boolean } = {}) => {
    if (!allowed || checking.current) return;
    checking.current = true;
    try {
      const st = await regloApi.getRoadState();
      roadStore.setCatalog(st.catalog);
      roadStore.setRoadEnabled(st.roadEnabled);
      roadStore.setPlanAlertsEnabled(st.planAlertsEnabled !== false);
      if (!st.roadEnabled) {
        roadStore.setEligible(null);
        return;
      }
      roadStore.setEligible(st.activeSession ? null : st.eligibleLesson);
      // REG-649: il giro della guida dell'invito pronto prima che il foglio si apra.
      if (!st.activeSession && st.planEnabled !== false) prefetchLessonPlan(st.eligibleLesson);
      if (st.activeSession) {
        // REG-714: «Termina» già toccato senza rete: la chiusura è in coda e
        // il server non lo sa ancora. Non si riapre la guida, si spedisce.
        await loadQueue();
        if (roadQueue.hasClose(st.activeSession.id)) {
          roadStore.setEligible(null);
          void roadUploader.flush(true);
          return;
        }
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

  // REG-691: la coda spedisce solo per l'utente che l'ha registrata. Logout o
  // login scaduto (401) con Road aperto: GPS spento, ma punti e segnalazioni
  // NON si buttano: ripartono al prossimo login dello stesso utente.
  const userId = user?.id ?? null;
  useEffect(() => {
    roadQueue.setOwner(status === 'ready' ? userId : null);
    if (status === 'ready' && userId) void roadUploader.resumeAfterLogin();
    if (status === 'unauthenticated' && roadStore.get().phase !== 'idle') {
      void stopRoadTracking();
      roadUploader.stop();
      void roadQueue.detach();
      roadStore.reset();
    }
  }, [status, userId]);

  // Road ridotta solo a guida in corso: chiusura, riepilogo e fine la spengono.
  useEffect(() => {
    if (phase !== 'active') roadMiniStore.set(false);
  }, [phase]);

  // Instradamento: Road a tutto schermo finché c'è una sessione, salvo Road
  // ridotta (REG-700): allora si sta nelle tab e «Torna in Road» riporta qui.
  // REG-723: il velo prima SALE in dissolvenza sulla schermata di partenza,
  // poi si cambia e il velo scende sulla nuova (prima compariva pieno di colpo).
  useEffect(() => {
    if (status !== 'ready' || switching.current) return;
    const inRoad = root === 'road';
    const reduced = phase === 'active' && minimized;
    const go = (to: typeof ROAD_ROUTE | '/(tabs)/home', color: string) => {
      switching.current = true;
      veil.current?.cover(color, () => {
        router.replace(to);
        veil.current?.reveal();
        switching.current = false;
      });
    };
    if (phase !== 'idle' && !reduced && !inRoad) {
      go(ROAD_ROUTE, roadNightNow() ? ROAD_VEIL_IN_NIGHT : ROAD_VEIL_IN);
    } else if ((phase === 'idle' || reduced) && inRoad) {
      go('/(tabs)/home', ROAD_VEIL_OUT);
    }
  }, [phase, minimized, root, router, status]);

  return <RouteVeil ref={veil} />;
}

/** Colore del velo: entrando quello della mappa (di notte scura), uscendo il bianco delle tab. */
const ROAD_VEIL_IN = '#F2F0EB';
const ROAD_VEIL_IN_NIGHT = '#1C1C1E';
const ROAD_VEIL_OUT = '#FFFFFF';
/** Un attimo perché la schermata nuova sia montata prima che il velo scenda. */
const REVEAL_DELAY_MS = 40;

type RouteVeilHandle = { cover: (color: string, then: () => void) => void; reveal: () => void };

/**
 * Passaggio tab ↔ Road: invece di vedere la tab bar sparire/ricomparire e i
 * fogli scivolare via, un velo del colore della schermata d'arrivo copre lo
 * scambio: sale in 180 ms, si cambia schermata sotto, scende in 240 ms
 * (easing morbido, niente rimbalzo, mai uno scatto). Non intercetta i tocchi.
 */
const RouteVeil = forwardRef<RouteVeilHandle>(function RouteVeil(_, ref) {
  const opacity = useSharedValue(0);
  const color = useSharedValue(ROAD_VEIL_OUT);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useImperativeHandle(
    ref,
    () => ({
      cover(c, then) {
        color.value = c;
        opacity.value = withTiming(
          1,
          { duration: ROAD_COVER_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never },
          // Anche se interrotto si cambia schermata: mai restare a metà.
          () => {
            runOnJS(then)();
          },
        );
      },
      reveal() {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          opacity.value = withTiming(0, { duration: ROAD_SWITCH_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
        }, REVEAL_DELAY_MS);
      },
    }),
    [color, opacity],
  );
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, backgroundColor: color.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} />;
});
