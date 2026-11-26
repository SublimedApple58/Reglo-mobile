import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  ReduceMotion,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  type SharedValue,
} from 'react-native-reanimated';
import { View, Text, Pressable, StyleSheet, BackHandler } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../../utils/haptics';
import { CLAY } from '../../theme/clay';
import { SOFT } from '../../utils/motion';
import { ClayPressable } from '../clay/ClayPressable';
import { useTabBarCover } from '../sheetPresence';
import { createKindSheetStore } from '../../stores/createKindSheetStore';
import { CREATE_LABEL, draftLook } from './createKinds';

/**
 * Blocco fantasma dell'agenda (REG-671), condiviso dalle griglie (REG-794):
 * la settimana di un istruttore (`WeeklyAgendaView`, colonne = giorni) e il
 * giorno della scuola (`schoolDay`, colonne = istruttori). Stesso gesto,
 * stessa bozza, stessa barra «Guida ⌄ · Continua»: cambia solo la geometria
 * (`GhostGeometry`) e cosa rappresenta una colonna (`GhostColumn`).
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgendaCreateKind = 'lesson' | 'group' | 'exam' | 'theory' | 'block';
export type AgendaCreateSlot = {
  date: Date;
  startMin: number;
  durMin: number;
  /** Fuori dalle fasce di disponibilità del giorno (si crea lo stesso). */
  outsideAvailability: boolean;
  /** Colonna di un istruttore (giorno della scuola): la creazione va a lui. */
  instructorId?: string | null;
};
export const ALL_CREATE_KINDS: AgendaCreateKind[] = ['lesson', 'group', 'exam', 'theory', 'block'];

/** Dove sta la griglia e quanto è grande una colonna. */
export type GhostGeometry = {
  /** Altezza di un'ora (pt). */
  rowH: number;
  /** Primo e ultimo minuto della griglia (minuti dalla mezzanotte). */
  dayMin: number;
  dayMax: number;
  /** x della colonna 0 nel contenitore del fantasma. */
  x0: number;
  /** Larghezza di una colonna e passo fra due colonne (larghezza + spazio). */
  colW: number;
  stride: number;
  /** Ultima colonna raggiungibile trascinando. */
  maxCol: number;
  /** Orario del bordo in mano nella colonna delle ore (larga `x0`). */
  edgeLabel: boolean;
};

/** Cosa rappresenta una colonna: il giorno e, nel giorno della scuola, l'istruttore. */
export type GhostColumn = { date: Date; instructorId?: string | null; instructorName?: string | null };

export type GhostInfo = { date: Date; startMin: number; durMin: number; instructorId?: string | null };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export const STEP = 15; // minutes per snap step (drag granularity)
export const FALLBACK_DURATIONS = [30, 60, 90, 120]; // used only if the parent passes none

const MONTH_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const pad = (n: number) => String(n).padStart(2, '0');
export const fmtMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
/** «Sabato 31 ottobre». */
export const fmtLongDay = (d: Date) => {
  const t = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** «Ven 6 nov». */
export const fmtShortDay = (d: Date) => `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
export const fmtDur = (min: number) => {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60}'`;
  return `${min}'`;
};

/** Durate consentite ordinate e la durata con cui nasce il fantasma (60' se c'è). */
export function useGhostDurations(allowedDurations?: number[]) {
  const allowedDur = useMemo(
    () => (allowedDurations && allowedDurations.length ? allowedDurations : FALLBACK_DURATIONS).slice().sort((a, b) => a - b),
    [allowedDurations],
  );
  const defaultDur = useMemo(() => (allowedDur.includes(60) ? 60 : allowedDur[0]), [allowedDur]);
  return { allowedDur, defaultDur };
}

/**
 * Spazi liberi di una colonna = la giornata [dayMin, dayMax] meno gli intervalli
 * occupati (guide, esami, gruppi, blocchi). Il fantasma ci deve stare dentro.
 */
export function freeSegments(occupied: Array<[number, number]>, dayMin: number, dayMax: number): Array<[number, number]> {
  const sorted = occupied.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const occ: Array<[number, number]> = [];
  for (const o of sorted) {
    const last = occ[occ.length - 1];
    if (last && o[0] <= last[1]) last[1] = Math.max(last[1], o[1]);
    else occ.push([o[0], o[1]]);
  }
  const segments: Array<[number, number]> = [];
  let cursor = dayMin;
  for (const [os, oe] of occ) {
    if (oe <= cursor) continue;
    if (os > cursor) segments.push([cursor, Math.min(os, dayMax)]);
    cursor = Math.max(cursor, oe);
    if (cursor >= dayMax) break;
  }
  if (cursor < dayMax) segments.push([cursor, dayMax]);
  return segments.filter(([s, e]) => e - s >= STEP);
}

// Snap a raw duration to a free 15-min step (any length — NOT limited to the
// allowed guide durations), clamped to [STEP, cap].
function snapDurFree(raw: number, cap: number): number {
  'worklet';
  let d = Math.round(raw / STEP) * STEP;
  const capSnap = Math.floor(cap / STEP) * STEP;
  if (d > capSnap) d = capSnap;
  if (d < STEP) d = STEP;
  return d;
}

// ── Overlap prevention ──
// `free` is a flat list of free segments [s0,e0,s1,e1,…] (minutes from midnight,
// the day minus guides/blocks). The ghost must always fit inside ONE free
// segment so it can never be dragged/resized on top of an existing block.

// Clamp a candidate start so [start, start+dur] fits inside the nearest free
// segment that can hold it. Returns -1 if no segment in this column fits `dur`.
function clampStartToFree(start: number, dur: number, free: number[]): number {
  'worklet';
  const center = start + dur / 2;
  let best = -1;
  let bestDist = 1e9;
  for (let i = 0; i + 1 < free.length; i += 2) {
    const gs = free[i];
    const ge = free[i + 1];
    if (ge - gs < dur) continue;
    let cs = start;
    if (cs < gs) cs = gs;
    if (cs > ge - dur) cs = ge - dur;
    const d = Math.abs((cs + dur / 2) - center);
    if (d < bestDist) { bestDist = d; best = cs; }
  }
  return best;
}
// End of the free segment containing `pos` — the cap for a downward resize.
function freeSegEnd(pos: number, free: number[], fallback: number): number {
  'worklet';
  for (let i = 0; i + 1 < free.length; i += 2) {
    if (pos >= free[i] && pos <= free[i + 1]) return free[i + 1];
  }
  return fallback;
}
// Start of the free segment containing `pos` — the cap for an upward resize.
function freeSegStart(pos: number, free: number[], fallback: number): number {
  'worklet';
  for (let i = 0; i + 1 < free.length; i += 2) {
    if (pos >= free[i] && pos <= free[i + 1]) return free[i];
  }
  return fallback;
}

// REG-671: il fantasma compare in dissolvenza e scivola dove si tocca (mai di botto, niente rimbalzo).
const GHOST_IN = FadeIn.duration(200).easing(SOFT).reduceMotion(ReduceMotion.Never);
const GHOST_GLIDE = { duration: 220, easing: SOFT, reduceMotion: ReduceMotion.Never } as const;
const GHOST_OUT = FadeOut.duration(150).easing(SOFT).reduceMotion(ReduceMotion.Never);
// Barra in basso (C-b): entra salendo di 14 pt in dissolvenza mentre la tab bar
// sfuma via (150 ms), così a metà le due si sovrappongono e non c'è mai un vuoto.
const BAR_IN = FadeInDown.duration(240).delay(60).easing(SOFT).reduceMotion(ReduceMotion.Never)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });
const BAR_OUT = FadeOutDown.duration(160).easing(SOFT).reduceMotion(ReduceMotion.Never);

/* ------------------------------------------------------------------ */
/*  Ghost label store — tiny pub/sub (same pattern as scrubOverlay)    */
/*  Updated per 15-min step from the gesture worklets via runOnJS so   */
/*  only the few <Text> that show them re-render, never the grid.      */
/* ------------------------------------------------------------------ */

const makeTextStore = () => {
  let value = '';
  const listeners = new Set<() => void>();
  return {
    set(v: string) { if (v === value) return; value = v; listeners.forEach((fn) => fn()); },
    get() { return value; },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
};
const ghostDurLabel = makeTextStore();
// Barra in basso e foglio dei tipi: giorno e fascia seguono il fantasma dal vivo.
const ghostDayLabel = makeTextStore();
const ghostShortDayLabel = makeTextStore();
const ghostRangeLabel = makeTextStore();
// Giorno della scuola: di chi è la colonna («Marta»), dopo la fascia nella barra.
const ghostWhoLabel = makeTextStore();
// Dentro la bozza: «13:00–14:00» (stretto, come gli altri blocchi) e il tipo scelto.
const ghostTightRangeLabel = makeTextStore();
const ghostKindStore = makeTextStore();
// A sinistra della griglia, all'altezza del bordo che si trascina (Calendario di Apple).
const ghostEdgeLabel = makeTextStore();
const useTextStore = (store: ReturnType<typeof makeTextStore>) =>
  useSyncExternalStore(store.subscribe, store.get);

const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

/* ------------------------------------------------------------------ */
/*  Stato del fantasma in una pagina di griglia                        */
/* ------------------------------------------------------------------ */

export type GhostPage = {
  gCol: SharedValue<number>;
  gStart: SharedValue<number>;
  gDur: SharedValue<number>;
  gLive: SharedValue<number>;
  /** Free segments per column (flat [s0,e0,…]) — the ghost must stay inside one. */
  gFree: SharedValue<number[][]>;
  ghostOn: boolean;
  arm: (col: number, start: number, dur: number) => void;
  step: (start: number, dur: number) => void;
  lift: () => void;
  place: (col: number, start: number, dur: number) => void;
  tapCreate: (col: number, start: number, dur: number) => void;
};

/**
 * Position/size live on shared values (UI-thread drag); React only knows
 * whether the ghost exists. Labels go through the ghost*Label stores.
 * `columnAt(col)` dice giorno e istruttore della colonna.
 */
export function useGhostPage({
  dayMin,
  defaultDur,
  columnAt,
  onGhostChange,
  ghostDismissTick,
}: {
  dayMin: number;
  defaultDur: number;
  columnAt: (col: number) => GhostColumn | undefined;
  onGhostChange: (info: GhostInfo | null) => void;
  ghostDismissTick: number;
}): GhostPage {
  const gCol = useSharedValue(0);
  const gStart = useSharedValue(dayMin);
  const gDur = useSharedValue(defaultDur);
  const gLive = useSharedValue(0);
  const gFree = useSharedValue<number[][]>([]);
  const [ghostOn, setGhostOn] = useState(false);
  const ghostOnRef = useRef(false);
  ghostOnRef.current = ghostOn;

  // Etichette del fantasma (inizio, durata) e della barra in basso (giorno, fascia, chi).
  const setLabels = useCallback((col: number, start: number, dur: number) => {
    ghostDurLabel.set(fmtDur(dur));
    ghostRangeLabel.set(`${fmtMin(start)} – ${fmtMin(start + dur)}`);
    ghostTightRangeLabel.set(`${fmtMin(start)}–${fmtMin(start + dur)}`);
    const c = columnAt(Math.round(col));
    if (c) {
      ghostDayLabel.set(fmtLongDay(c.date));
      ghostShortDayLabel.set(fmtShortDay(c.date));
      ghostWhoLabel.set(firstName(c.instructorName));
    }
  }, [columnAt]);

  const emit = useCallback((col: number, start: number, dur: number) => {
    const c = columnAt(Math.round(col));
    if (c) onGhostChange({ date: c.date, startMin: start, durMin: dur, instructorId: c.instructorId ?? null });
  }, [columnAt, onGhostChange]);

  const arm = useCallback((col: number, start: number, dur: number) => {
    setLabels(col, start, dur);
    setGhostOn(true);
    emit(col, start, dur);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setLabels, emit]);

  const step = useCallback((start: number, dur: number) => {
    setLabels(gCol.value, start, dur);
    Haptics.selectionAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLabels]);

  const lift = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const place = useCallback((col: number, start: number, dur: number) => {
    const c = Math.round(col);
    setLabels(c, start, dur);
    emit(c, start, dur);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setLabels, emit]);

  // Tocco su uno spazio libero: nasce il fantasma, oppure quello che c'è già
  // ci scivola (220 ms, niente rimbalzo) tenendo la sua durata.
  const tapCreate = useCallback((col: number, start: number, dur: number) => {
    if (ghostOnRef.current) {
      gCol.value = withTiming(col, GHOST_GLIDE);
      gStart.value = withTiming(start, GHOST_GLIDE);
      gDur.value = withTiming(dur, GHOST_GLIDE);
      Haptics.selectionAsync();
    } else {
      gCol.value = col; gStart.value = start; gDur.value = dur; gLive.value = 0;
      setGhostOn(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLabels(col, start, dur);
    emit(col, start, dur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLabels, emit]);

  // Parent-driven dismiss (tocco sulla bozza, creazione riuscita, cambio pagina).
  useEffect(() => {
    if (ghostDismissTick > 0) setGhostOn(false);
  }, [ghostDismissTick]);

  return { gCol, gStart, gDur, gLive, gFree, ghostOn, arm, step, lift, place, tapCreate };
}

/* ------------------------------------------------------------------ */
/*  Free segment = hold-and-scrub bookable surface                     */
/* ------------------------------------------------------------------ */

type GridBookableProps = {
  geo: GhostGeometry;
  page: GhostPage;
  top: number; height: number; left: number; width: number;
  /** This free segment's bounds (minutes from midnight), to map e.y → time. */
  windowStart: number; windowEnd: number;
  colIdx: number;
  /** Default lesson duration (an allowed value) used when a block is born. */
  defaultDur: number;
};

// Any free time is bookable — the surface spans a free segment (the day minus
// guides/blocks), NOT the availability. Press-and-hold (220ms) births a GHOST
// BLOCK (1h) under the finger and drags it live — vertically in 15-min steps,
// horizontally across columns. Release places it (resize knobs + bottom CTA
// appear). A quick tap places a ghost at the tapped slot — or glides the
// current one there (REG-671). The surface itself stays invisible.
export const GridBookableWindow = React.memo(function GridBookableWindow({
  geo, page, top, height, left, width, windowStart, windowEnd, colIdx, defaultDur,
}: GridBookableProps) {
  const { gCol, gStart, gDur, gLive, gFree, ghostOn, arm, step, place, tapCreate } = page;
  const baseStart = useSharedValue(0);
  const baseCol = useSharedValue(0);
  const { rowH, dayMin, dayMax, stride, maxCol } = geo;
  const pxPerStep = rowH / 4;

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((e) => {
      const frac = Math.max(0, Math.min(1, e.y / Math.max(height, 1)));
      const centerMin = windowStart + Math.round((frac * (windowEnd - windowStart)) / STEP) * STEP;
      // Birth a default-duration block centered on the finger, kept INSIDE this
      // free segment so it never overlaps the adjacent guide/block.
      let dur = defaultDur;
      let start = Math.round((centerMin - dur / 2) / STEP) * STEP;
      if (windowEnd - windowStart < dur) {
        start = windowStart; dur = windowEnd - windowStart;
      } else {
        start = Math.max(windowStart, Math.min(windowEnd - dur, start));
      }
      gCol.value = colIdx; gStart.value = start; gDur.value = dur;
      gLive.value = withTiming(1, { duration: 140 });
      baseStart.value = start; baseCol.value = colIdx;
      runOnJS(arm)(colIdx, start, dur);
    })
    .onUpdate((e) => {
      const steps = Math.round(e.translationY / pxPerStep);
      const cols = Math.round(e.translationX / stride);
      const col = Math.max(0, Math.min(maxCol, baseCol.value + cols));
      let start = baseStart.value + steps * STEP;
      start = Math.max(dayMin, Math.min(dayMax - gDur.value, start));
      // Keep the ghost inside a free segment — never let it overlap a block.
      const free = gFree.value[col] ?? [];
      if (free.length) {
        const cs = clampStartToFree(start, gDur.value, free);
        if (cs < 0) return; // no free slot in this column fits → don't move there
        start = cs;
      }
      if (col !== gCol.value || start !== gStart.value) {
        gCol.value = col; gStart.value = start;
        runOnJS(step)(start, gDur.value);
      }
    })
    .onEnd(() => {
      gLive.value = withTiming(0, { duration: 180 });
      runOnJS(place)(gCol.value, gStart.value, gDur.value);
    })
    .onFinalize((_e, success) => {
      // Gesture cancelled mid-drag (system interruption): settle the ghost
      // where it is instead of leaving it in the live/CTA-less limbo.
      if (!success && gLive.value > 0) {
        gLive.value = withTiming(0, { duration: 180 });
        runOnJS(place)(gCol.value, gStart.value, gDur.value);
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      const frac = Math.max(0, Math.min(1, e.y / Math.max(height, 1)));
      const localMin = windowStart + Math.floor((frac * (windowEnd - windowStart)) / STEP) * STEP;
      // Birth INSIDE this free segment so it never overlaps the adjacent block.
      // A ghost already on the grid keeps its length and glides here.
      let dur = ghostOn ? gDur.value : defaultDur;
      let start = localMin;
      if (windowEnd - windowStart < dur) {
        start = windowStart; dur = windowEnd - windowStart;
      } else {
        start = Math.max(windowStart, Math.min(windowEnd - dur, localMin));
      }
      runOnJS(tapCreate)(colIdx, start, dur);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={{ position: 'absolute', top, height, left, width, zIndex: 2 }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={s.bookSurface} />
      </GestureDetector>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Ghost block — draggable, resizable draft of the new lesson         */
/* ------------------------------------------------------------------ */

const KNOB = 9;
const setGhostEdge = (min: number) => ghostEdgeLabel.set(fmtMin(min));

// The ghost lives entirely on shared values: position/size animate on the UI
// thread (zero React re-renders while dragging); the labels go through the
// tiny ghost*Label stores (re-render just a few <Text>).
//
// Aspetto (anteprima W1 approvata da Tiziano, 05/11/2026): bozza a contorno
// nella tinta del tipo scelto (Guida = giallo delle guide), due pallini bianchi
// bordati agli angoli opposti (in alto a destra, in basso a sinistra) come il
// blocco in creazione di Calendario. Preso in mano: velo più pieno, contorno
// più scuro, scala appena sopra 1, il pallino trascinato cresce e a sinistra
// della griglia compare l'orario del bordo che si muove.
export function GhostBlock({ geo, page, onDismiss }: { geo: GhostGeometry; page: GhostPage; onDismiss: () => void }) {
  const { gCol, gStart, gDur, gLive, gFree, lift, step, place } = page;
  const { rowH, dayMin, dayMax, x0, colW, stride, maxCol } = geo;
  const pxPerStep = rowH / 4;
  const baseStart = useSharedValue(0);
  const baseCol = useSharedValue(0);
  const baseEnd = useSharedValue(0);
  /** Bordo in mano: 0 nessuno (o tutto il blocco), 1 inizio, 2 fine. */
  const gEdge = useSharedValue(0);

  const kind = (useTextStore(ghostKindStore) || 'lesson') as AgendaCreateKind;
  const look = draftLook(kind);
  const rangeText = useTextStore(ghostTightRangeLabel);
  const durText = useTextStore(ghostDurLabel);
  const edgeText = useTextStore(ghostEdgeLabel);

  /* — knobs: drag the edges to resize (15' steps) —
   * Generous hitSlop: the knobs must be the EASY target near the edges. */
  const makeKnobPan = (edge: 'top' | 'bottom') =>
    Gesture.Pan()
      .hitSlop({ top: 22, bottom: 22, left: 34, right: 34 })
      .activeOffsetY([-3, 3])
      .onStart(() => {
        baseStart.value = gStart.value;
        baseEnd.value = gStart.value + gDur.value;
        gEdge.value = edge === 'top' ? 1 : 2;
        gLive.value = withTiming(1, { duration: 140 });
        runOnJS(setGhostEdge)(edge === 'top' ? gStart.value : gStart.value + gDur.value);
        runOnJS(lift)();
      })
      .onUpdate((e) => {
        const delta = Math.round(e.translationY / pxPerStep) * STEP;
        const free = gFree.value[gCol.value] ?? [];
        if (edge === 'top') {
          // Can't grow up past the top of the current free segment.
          const minStart = free.length ? freeSegStart(baseEnd.value, free, dayMin) : dayMin;
          const rawDur = baseEnd.value - (baseStart.value + delta);
          const nd = snapDurFree(rawDur, baseEnd.value - minStart);
          const ns = baseEnd.value - nd;
          if (ns !== gStart.value) {
            gStart.value = ns; gDur.value = nd;
            runOnJS(setGhostEdge)(ns);
            runOnJS(step)(ns, nd);
          }
        } else {
          // Can't grow down past the end of the current free segment.
          const maxEnd = free.length ? freeSegEnd(baseStart.value, free, dayMax) : dayMax;
          const rawDur = (baseEnd.value + delta) - baseStart.value;
          const nd = snapDurFree(rawDur, maxEnd - baseStart.value);
          if (nd !== gDur.value) {
            gDur.value = nd;
            runOnJS(setGhostEdge)(baseStart.value + nd);
            runOnJS(step)(baseStart.value, nd);
          }
        }
      })
      .onEnd(() => {
        gLive.value = withTiming(0, { duration: 180 });
        gEdge.value = 0;
        runOnJS(place)(gCol.value, gStart.value, gDur.value);
      })
      .onFinalize((_e, success) => {
        if (!success && gLive.value > 0) {
          gLive.value = withTiming(0, { duration: 180 });
          gEdge.value = 0;
          runOnJS(place)(gCol.value, gStart.value, gDur.value);
        }
      });

  const topKnobPan = useMemo(() => makeKnobPan('top'), [rowH, dayMin, dayMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const botKnobPan = useMemo(() => makeKnobPan('bottom'), [rowH, dayMin, dayMax]); // eslint-disable-line react-hooks/exhaustive-deps

  /* — body: hold (160ms) and drag the whole block, also across columns —
   * Defers to the knobs: a touch landing in their (large) hit area can NEVER
   * move the block, so a missed resize doesn't turn into an accidental move.
   * A quick tap on the body removes the draft. */
  const movePan = useMemo(() => Gesture.Pan()
    .activateAfterLongPress(160)
    .requireExternalGestureToFail(topKnobPan, botKnobPan)
    .onStart(() => {
      baseStart.value = gStart.value; baseCol.value = gCol.value;
      gEdge.value = 0;
      gLive.value = withTiming(1, { duration: 140 });
      runOnJS(lift)();
    })
    .onUpdate((e) => {
      const steps = Math.round(e.translationY / pxPerStep);
      const cols = Math.round(e.translationX / stride);
      const col = Math.max(0, Math.min(maxCol, baseCol.value + cols));
      let start = baseStart.value + steps * STEP;
      start = Math.max(dayMin, Math.min(dayMax - gDur.value, start));
      // Keep the ghost inside a free segment — never let it overlap a block.
      const free = gFree.value[col] ?? [];
      if (free.length) {
        const cs = clampStartToFree(start, gDur.value, free);
        if (cs < 0) return; // no free slot in this column fits → don't move there
        start = cs;
      }
      if (col !== gCol.value || start !== gStart.value) {
        gCol.value = col; gStart.value = start;
        runOnJS(step)(start, gDur.value);
      }
    })
    .onEnd(() => {
      gLive.value = withTiming(0, { duration: 180 });
      runOnJS(place)(gCol.value, gStart.value, gDur.value);
    })
    .onFinalize((_e, success) => {
      if (!success && gLive.value > 0) {
        gLive.value = withTiming(0, { duration: 180 });
        runOnJS(place)(gCol.value, gStart.value, gDur.value);
      }
    }), [topKnobPan, botKnobPan, stride, maxCol, rowH, dayMin, dayMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapBody = useMemo(() => Gesture.Tap()
    .maxDuration(250)
    .requireExternalGestureToFail(topKnobPan, botKnobPan)
    .onEnd((_e, success) => {
      if (success) runOnJS(onDismiss)();
    }), [topKnobPan, botKnobPan, onDismiss]);
  const bodyGesture = useMemo(() => Gesture.Exclusive(movePan, tapBody), [movePan, tapBody]);

  const frameStyle = useAnimatedStyle(() => ({
    top: ((gStart.value - dayMin) / 60) * rowH,
    height: (gDur.value / 60) * rowH,
    left: x0 + gCol.value * stride + 2,
    width: colW - 4,
    transform: [{ scale: interpolate(gLive.value, [0, 1], [1, 1.02]) }],
  }));
  // Velo e contorno: più pieni presi in mano (colori, non ombre: l'ombra resta ferma).
  const skinStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(gLive.value, [0, 1], [look.fill, look.fillLive]),
    borderColor: interpolateColor(gLive.value, [0, 1], [look.ring, look.ringLive]),
  }));
  const topKnobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(gEdge.value === 1 ? 1.33 : 1, { duration: 140, reduceMotion: ReduceMotion.Never }) }],
  }));
  const botKnobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(gEdge.value === 2 ? 1.33 : 1, { duration: 140, reduceMotion: ReduceMotion.Never }) }],
  }));
  // La durata compare solo mentre si allunga o si sposta.
  const durStyle = useAnimatedStyle(() => ({ opacity: gLive.value }));
  // Orario del bordo in mano, nella colonna delle ore.
  const edgeStyle = useAnimatedStyle(() => {
    const edgeMin = gEdge.value === 1 ? gStart.value : gStart.value + gDur.value;
    return {
      top: ((edgeMin - dayMin) / 60) * rowH - 7,
      opacity: gEdge.value > 0 ? gLive.value : 0,
    };
  });

  return (
    <>
      <GestureDetector gesture={bodyGesture}>
        <Animated.View
          entering={GHOST_IN}
          exiting={GHOST_OUT}
          style={[s.ghost, { boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 14, spreadDistance: -8, color: look.glow }] }, frameStyle]}
          testID="agenda-ghost"
          accessibilityRole="button"
          accessibilityLabel={`${CREATE_LABEL[kind]} ${rangeText}. Tocca per togliere.`}
        >
          <Animated.View style={[s.ghostSkin, skinStyle]}>
            <Text style={s.ghostKind} numberOfLines={1}>{CREATE_LABEL[kind]}</Text>
            <Text style={s.ghostRange}>{rangeText}</Text>
            <Animated.Text style={[s.ghostDur, durStyle]} numberOfLines={1}>{durText}</Animated.Text>
          </Animated.View>
          <GestureDetector gesture={topKnobPan}>
            <Animated.View
              style={[s.ghostKnob, { top: -KNOB / 2, right: 6, borderColor: look.dot }, topKnobStyle]}
              hitSlop={{ top: 14, bottom: 10, left: 18, right: 18 }}
            />
          </GestureDetector>
          <GestureDetector gesture={botKnobPan}>
            <Animated.View
              style={[s.ghostKnob, { bottom: -KNOB / 2, left: 6, borderColor: look.dot }, botKnobStyle]}
              hitSlop={{ top: 10, bottom: 14, left: 18, right: 18 }}
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
      {geo.edgeLabel ? (
        <Animated.View pointerEvents="none" style={[s.ghostEdge, { width: x0 }, edgeStyle]}>
          <Text style={s.ghostEdgeText} numberOfLines={1}>{edgeText}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Barra «crea» — tipo + giorno e fascia, una CTA (anteprima C-b)     */
/* ------------------------------------------------------------------ */

/**
 * Al posto della tab bar mentre c'è la bozza (anteprima C-b approvata da
 * Tiziano, 05/11/2026; come la barra di prenotazione di Airbnb): a sinistra il
 * tipo scelto «Guida ⌄» (il tocco apre «Cosa vuoi creare?») e sotto giorno e
 * fascia (e, nel giorno della scuola, di chi è la colonna), che seguono la
 * bozza dal vivo; a destra una sola CTA «Continua» che apre il foglio del tipo.
 */
const GhostBar = React.memo(function GhostBar({
  bottomPad,
  onChangeKind,
  onContinue,
}: {
  bottomPad: number;
  onChangeKind: () => void;
  onContinue: () => void;
}) {
  const kind = (useTextStore(ghostKindStore) || 'lesson') as AgendaCreateKind;
  const day = useTextStore(ghostShortDayLabel);
  const range = useTextStore(ghostRangeLabel);
  const who = useTextStore(ghostWhoLabel);
  return (
    <Animated.View entering={BAR_IN} exiting={BAR_OUT} style={[s.bar, { paddingBottom: bottomPad }]} testID="agenda-create-bar">
      <Pressable
        onPress={onChangeKind}
        style={({ pressed }) => [s.barWhen, pressed && { opacity: 0.55 }]}
        hitSlop={{ top: 10, bottom: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`${CREATE_LABEL[kind]}, ${day} ${range}${who ? `, ${who}` : ''}. Cambia tipo`}
        testID="agenda-create-kind"
      >
        <View style={s.barKindRow}>
          <Text style={s.barKind} numberOfLines={1}>{CREATE_LABEL[kind]}</Text>
          <Ionicons name="chevron-down" size={15} color={CLAY.ink} />
        </View>
        <Text style={s.barDay} numberOfLines={1}>
          {day} · <Text style={s.barRange}>{range}</Text>{who ? ` · ${who}` : ''}
        </Text>
      </Pressable>
      <ClayPressable kind="cta" onPress={onContinue} style={s.barCta} accessibilityRole="button" testID="agenda-create-continue">
        <Text style={s.barCtaText}>Continua</Text>
      </ClayPressable>
    </Animated.View>
  );
});

/* ------------------------------------------------------------------ */
/*  Bozza + barra a livello di griglia                                 */
/* ------------------------------------------------------------------ */

/**
 * Stato della bozza per tutta la griglia (le pagine hanno il loro
 * `useGhostPage`): quale bozza c'è, il tipo scelto, la barra «Continua» che
 * prende il posto della tab bar, il «indietro» di Android che la toglie.
 * `isOutside(info)` dice se la fascia cade fuori dalla disponibilità.
 */
export function useGhostDraft({
  createKinds,
  carColor,
  onCreateAt,
  isOutside,
  ghostResetKey,
  onGhostActiveChange,
  barOverlap,
}: {
  createKinds: AgendaCreateKind[];
  carColor?: string | null;
  onCreateAt?: (kind: AgendaCreateKind, slot: AgendaCreateSlot) => void;
  isOutside: (info: GhostInfo) => boolean;
  ghostResetKey: number;
  onGhostActiveChange?: (active: boolean) => void;
  barOverlap: number;
}) {
  const [ghostInfo, setGhostInfo] = useState<GhostInfo | null>(null);
  const [ghostDismissTick, setGhostDismissTick] = useState(0);
  const handleGhostChange = useCallback((info: GhostInfo | null) => setGhostInfo(info), []);
  const dismissGhost = useCallback(() => {
    setGhostInfo(null);
    setGhostDismissTick((t) => t + 1);
  }, []);
  const onGhostActiveChangeRef = useRef(onGhostActiveChange);
  onGhostActiveChangeRef.current = onGhostActiveChange;
  useEffect(() => {
    onGhostActiveChangeRef.current?.(ghostInfo != null);
  }, [ghostInfo]);
  // Unmount (e.g. switching to another view): release the parent's FAB.
  useEffect(() => () => { onGhostActiveChangeRef.current?.(false); }, []);
  // Tipo della bozza: il primo offerto (Guida, se si può prenotare); si cambia
  // da «Cosa vuoi creare?» e torna al primo quando la bozza sparisce.
  const firstKind = createKinds[0] ?? 'block';
  const [draftKind, setDraftKind] = useState<AgendaCreateKind>(firstKind);
  useEffect(() => { ghostKindStore.set(draftKind); }, [draftKind]);
  useEffect(() => { if (!ghostInfo) setDraftKind(firstKind); }, [ghostInfo, firstKind]);

  const router = useRouter();
  const openKindSheet = useCallback(() => {
    if (!ghostInfo) return;
    const who = ghostWhoLabel.get();
    createKindSheetStore.set({
      kinds: createKinds,
      selected: draftKind,
      subtitle: `${ghostDayLabel.get()} · ${ghostRangeLabel.get()}${who ? ` · ${who}` : ''}`,
      carColor,
      onPick: setDraftKind,
    });
    router.push('/(tabs)/home/create-kind');
  }, [ghostInfo, createKinds, draftKind, carColor, router]);

  // «Continua»: apre il foglio del tipo con il giorno e la fascia della bozza,
  // che resta sulla griglia (sparisce a creazione riuscita).
  const continueCreate = useCallback(() => {
    if (!ghostInfo || !onCreateAt) return;
    const { date, startMin, durMin, instructorId } = ghostInfo;
    Haptics.selectionAsync();
    onCreateAt(draftKind, { date, startMin, durMin, outsideAvailability: isOutside(ghostInfo), instructorId: instructorId ?? null });
  }, [ghostInfo, onCreateAt, isOutside, draftKind]);

  // La barra prende il posto della tab bar dove la griglia ci passa sotto
  // (istruttore); altrimenti (titolare) sta sopra la tab bar, che resta.
  const insets = useSafeAreaInsets();
  const barActive = !!ghostInfo && !!onCreateAt;
  useTabBarCover(barActive && barOverlap > 0);
  const barBottomPad = barOverlap > 0 ? Math.max(insets.bottom, 12) : 12;

  // Android: «indietro» toglie la bozza prima di uscire dalla schermata.
  useEffect(() => {
    if (!barActive) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismissGhost(); return true; });
    return () => sub.remove();
  }, [barActive, dismissGhost]);
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    dismissGhost();
  }, [ghostResetKey, dismissGhost]);

  const bar = barActive ? (
    <GhostBar bottomPad={barBottomPad} onChangeKind={openKindSheet} onContinue={continueCreate} />
  ) : null;

  return { ghostInfo, handleGhostChange, dismissGhost, ghostDismissTick, bar };
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  // Invisible bookable surface (the ghost block is the visual feedback).
  bookSurface: {
    flex: 1,
    borderRadius: 10,
  },
  /* ── Bozza (anteprima W1, 05/11/2026): contorno + velo nella tinta del tipo, pallini agli angoli ── */
  ghost: {
    position: 'absolute',
    zIndex: 7,
    borderRadius: 10,
    overflow: 'visible',
  },
  ghostSkin: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingTop: 5,
    overflow: 'hidden',
  },
  ghostKind: { fontSize: 11, fontWeight: '600', lineHeight: 14, color: 'rgba(17,17,17,0.86)' },
  ghostRange: { fontSize: 9, fontWeight: '500', marginTop: 2, color: 'rgba(17,17,17,0.62)', fontVariant: ['tabular-nums'] },
  ghostDur: { fontSize: 9, fontWeight: '600', marginTop: 2, color: 'rgba(17,17,17,0.78)', fontVariant: ['tabular-nums'] },
  ghostKnob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    zIndex: 9,
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: 'rgba(17,17,17,0.18)' }],
  },
  // Orario del bordo in mano, sopra l'etichetta dell'ora nella colonna a sinistra.
  // «14:15» è più largo delle etichette «14» della colonna: carattere un filo più
  // piccolo e stretto, su una riga sola, così non va mai a capo.
  ghostEdge: { position: 'absolute', left: 0, zIndex: 12, backgroundColor: '#FFFFFF', paddingLeft: 1 },
  ghostEdgeText: { fontSize: 9.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  /* ── Barra «Guida ⌄ · Continua» (anteprima C-b approvata, 05/11/2026) ── */
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(17,17,17,0.10)',
  },
  barWhen: { flex: 1, minWidth: 0 },
  barKindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barKind: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, lineHeight: 22 },
  barDay: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3, marginTop: 1, lineHeight: 18 },
  barRange: { color: CLAY.ink, textDecorationLine: 'underline', fontVariant: ['tabular-nums'] },
  // CTA nera fine (anteprima v2): 44 di altezza, volume clay leggero.
  barCta: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      { offsetX: 0, offsetY: 6, blurRadius: 14, spreadDistance: -6, color: 'rgba(17,17,17,0.42)' },
      { offsetX: 0, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: 'rgba(255,255,255,0.16)', inset: true },
      { offsetX: 0, offsetY: -2, blurRadius: 4, spreadDistance: 0, color: 'rgba(0,0,0,0.45)', inset: true },
    ],
  },
  barCtaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
