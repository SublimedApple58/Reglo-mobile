import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { regloApi } from '../services/regloApi';
import { isInstructor } from '../utils/roles';
import { roadStore, useRoadState } from './roadStore';
import { isInviteDismissed, resumeRoad } from './roadActions';
import { stopRoadTracking } from './tracking';
import { roadUploader } from './uploader';
import { roadQueue } from './queue';
import { ROAD_INVITE_ROUTE, ROAD_ROUTE, roadEntryStore, roadInviteOpen } from './entryFlow';

/**
 * REG-638 Reglo Road — regia della modalità Road (montata nell'AuthGate).
 *
 * - All'avvio e a ogni ritorno in primo piano legge `/road/state`:
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
  const { phase } = useRoadState();
  const allowed = status === 'ready' && isInstructor(autoscuolaRole) && enabled;
  const root = segments[0];
  const rootRef = useRef(root);
  rootRef.current = root;
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!allowed || checking.current) return;
    checking.current = true;
    try {
      const st = await regloApi.getRoadState();
      roadStore.setCatalog(st.catalog);
      if (!st.roadEnabled) {
        roadStore.setEligible(null);
        return;
      }
      roadStore.setEligible(st.activeSession ? null : st.eligibleLesson);
      if (st.activeSession) {
        await resumeRoad(st.activeSession);
        return;
      }
      // Sessione chiusa altrove mentre l'app dormiva: si esce da Road.
      if (roadStore.get().phase === 'active') {
        await stopRoadTracking();
        roadUploader.stop();
        await roadQueue.detach();
        roadStore.reset();
        return;
      }
      const lesson = st.eligibleLesson;
      if (!lesson || roadStore.get().phase !== 'idle' || roadInviteOpen.current) return;
      if (rootRef.current !== '(tabs)') return;
      if (await isInviteDismissed(lesson.appointmentId)) return;
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
    return () => {
      clearTimeout(t);
      sub.remove();
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
      router.replace(ROAD_ROUTE);
    } else if (phase === 'idle' && inRoad) {
      router.replace('/(tabs)/home');
    }
  }, [phase, root, router, status]);

  return null;
}
