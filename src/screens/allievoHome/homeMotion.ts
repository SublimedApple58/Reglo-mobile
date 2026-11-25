/**
 * REG-792 — la home si riordina con garbo quando arriva o sparisce una guida
 * (piano approvato da Tiziano il 25/11/2026).
 *
 * Come funziona:
 * - `useHeldUpcoming` tiene una «vetrina» dell'elenco delle prossime guide.
 *   Se i dati cambiano mentre c'è il quadratino STOP → OK, o mentre la home
 *   non è a schermo (guida presa da Scambi), la vetrina resta com'era: il
 *   cambio si vede quando l'allievo è davvero in home.
 * - Un cambio semplice (UNA guida in più o in meno) si fa in due tempi:
 *   prima un render «armato» che mette `layout`/`entering`/`exiting` sui
 *   blocchi (gli `exiting` vanno messi PRIMA che il blocco sparisca), poi al
 *   fotogramma dopo la vetrina nuova. Le layout animations di Reanimated su
 *   Fabric sono sincronizzate col commit: le righe partono dal posto vecchio e
 *   scivolano al nuovo senza un fotogramma di scatto (FLIP fatto dal motore).
 * - Cambi più grossi (primo caricamento, pull-to-refresh): niente coreografia.
 *
 * Regole (design-system §0.8/§15): solo transform e opacity, 300 ms in
 * decelerazione, niente overshoot, mai spente da «Riduci movimento». Le card
 * con l'ombra non cambiano misura: si dissolvono o restano ferme; si muovono
 * solo per traslazione.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  withDelay,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated';

const N = ReduceMotion.Never;
const EASE = Easing.out(Easing.cubic);
export const HOME_MOVE_MS = 300;
const T = { duration: HOME_MOVE_MS, easing: EASE, reduceMotion: N };

/** I blocchi già in pagina scivolano al posto nuovo. */
export const HOME_MOVE = LinearTransition.duration(HOME_MOVE_MS).easing(EASE).reduceMotion(N);
/** Un blocco che compare (card nuova, sezione nuova): dissolvenza. */
export const HOME_FADE_IN = FadeIn.duration(220).delay(80).easing(EASE).reduceMotion(N);
export const HOME_FADE_OUT = FadeOut.duration(180).easing(EASE).reduceMotion(N);

/** Riga nuova: compare mentre le altre le fanno spazio, appena più piccola che cresce. */
export function rowEnter() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.97 }] },
    animations: {
      opacity: withDelay(90, withTiming(1, { duration: 220, easing: EASE, reduceMotion: N })),
      transform: [{ scale: withDelay(90, withTiming(1, { duration: 240, easing: EASE, reduceMotion: N })) }],
    },
  };
}

/** Riga che se ne va (annullata, lasciata, spinta fuori dalle prime tre). */
export function rowExit() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 180, easing: EASE, reduceMotion: N }),
      transform: [{ scale: withTiming(0.97, { duration: 180, easing: EASE, reduceMotion: N }) }],
    },
  };
}

/**
 * La guida che era nella card «Prossima guida» scende nell'elenco: la riga
 * nasce al centro della card (`cardCenter`, nel sistema della sezione) e
 * scivola al suo posto mentre si accende.
 */
export function rowFromCard(cardCenter: number) {
  return (values: EntryAnimationsValues) => {
    'worklet';
    const dy = cardCenter - (values.targetOriginY + values.targetHeight / 2);
    return {
      initialValues: { opacity: 0, transform: [{ translateY: dy }, { scale: 0.96 }] },
      animations: {
        opacity: withTiming(1, { duration: 200, easing: EASE, reduceMotion: N }),
        transform: [{ translateY: withTiming(0, T) }, { scale: withTiming(1, T) }],
      },
    };
  };
}

/** Il contrario: la prima riga sale nella card e lì si spegne (la prossima guida è sparita). */
export function rowToCard(cardCenter: number) {
  return (values: ExitAnimationsValues) => {
    'worklet';
    const dy = cardCenter - (values.currentOriginY + values.currentHeight / 2);
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: {
        opacity: withTiming(0, { duration: 260, easing: EASE, reduceMotion: N }),
        transform: [{ translateY: withTiming(dy, T) }, { scale: withTiming(0.96, T) }],
      },
    };
  };
}

/** Testo della card che lascia il posto: scende di 10 pt e si spegne. */
export function contentExit() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 180, easing: EASE, reduceMotion: N }),
      transform: [{ translateY: withTiming(10, { duration: 220, easing: EASE, reduceMotion: N }) }],
    },
  };
}

/** Testo nuovo della card: arriva dall'alto di poco mentre il vecchio esce. */
export function contentEnter() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -8 }] },
    animations: {
      opacity: withDelay(100, withTiming(1, { duration: 200, easing: EASE, reduceMotion: N })),
      transform: [{ translateY: withDelay(100, withTiming(0, { duration: 240, easing: EASE, reduceMotion: N })) }],
    },
  };
}

type WithId = { id: string };

/** Cosa fa la transizione in corso: la guida che scende dalla card o sale nella card. */
export type HomeMotionPlan = { fromCardId: string | null; toCardId: string | null };

const NO_PLAN: HomeMotionPlan = { fromCardId: null, toCardId: null };

const sameIds = (a: WithId[], b: WithId[]) => a.length === b.length && a.every((x, i) => x.id === b[i].id);

/** Una sola guida in più o in meno, il resto nello stesso ordine. */
const singleChange = (prev: WithId[], next: WithId[]) => {
  if (Math.abs(prev.length - next.length) !== 1) return false;
  const [long, short] = prev.length > next.length ? [prev, next] : [next, prev];
  const ids = new Set(short.map((x) => x.id));
  const rest = long.filter((x) => ids.has(x.id));
  return rest.length === short.length && sameIds(rest, short);
};

/**
 * La vetrina delle prossime guide. `live` = dati del server; `open` = la home
 * è a schermo, coi dati pronti e senza il quadratino davanti.
 */
export function useHeldUpcoming<L extends WithId>(live: L[], ready: boolean, open: boolean) {
  const [shown, setShown] = useState<L[] | null>(null);
  const [armed, setArmed] = useState(false);
  const [plan, setPlan] = useState<HomeMotionPlan>(NO_PLAN);
  const pending = useRef<L[] | null>(null);

  // Primo arrivo dei dati: subito, senza coreografia.
  useEffect(() => {
    if (ready && shown === null) setShown(live);
  }, [ready, shown, live]);

  // Tempo 1: c'è un cambio e la home è a schermo → si arma.
  useEffect(() => {
    if (!ready || shown === null || !open || armed) return;
    if (sameIds(shown, live)) {
      // Stesse guide (orari, istruttori, scambi aggiornati): si aggiorna e basta.
      if (shown !== live) setShown(live);
      return;
    }
    if (!singleChange(shown, live)) {
      setShown(live);
      return;
    }
    const was = shown[0]?.id ?? null;
    const now = live[0]?.id ?? null;
    pending.current = live;
    setPlan({
      // Arriva una guida prima della prossima: la vecchia prossima scende in elenco.
      fromCardId: was && now !== was && live[1]?.id === was ? was : null,
      // Sparisce la prossima: la prima dell'elenco sale nella card.
      toCardId: now && now !== was && shown[1]?.id === now ? now : null,
    });
    setArmed(true);
  }, [ready, shown, live, open, armed]);

  // Tempo 2: al fotogramma dopo (gli `exiting` sono già montati) la vetrina nuova.
  useEffect(() => {
    if (!armed || !pending.current) return;
    const next = pending.current;
    const raf = requestAnimationFrame(() => {
      pending.current = null;
      setShown(next);
    });
    return () => cancelAnimationFrame(raf);
  }, [armed]);

  // Fine: si disarma quando tutto è fermo, così i blocchi non animano altro.
  useEffect(() => {
    if (!armed || pending.current) return;
    const t = setTimeout(() => {
      setArmed(false);
      setPlan(NO_PLAN);
    }, HOME_MOVE_MS + 150);
    return () => clearTimeout(t);
  }, [armed, shown]);

  return { shown: shown ?? live, armed, plan };
}
