import React, { useMemo, useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  Easing,
  ReduceMotion,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  type SharedValue,
} from 'react-native-reanimated';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  BackHandler,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { asMotoLessonType, MOTO_LESSON_TYPE_ICON } from '../utils/motoLessonType';
import * as Haptics from '../utils/haptics';
import { isExamPlaceholder, BLOCK_PRESENTATION, blockKindOf } from '../utils/weeklyAgenda';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { agendaVehicleLabel, showVehicleOnBlocks } from '../utils/agendaVehicle';
import {
  AUTOMATIC_MARKER_WIDTH,
  resolveAgendaColorConfig,
  type AgendaColorConfig,
} from '../utils/agendaColors';
import { sharedWithNames, unionCoInstructors } from '../utils/coInstructors';
import { EXAM_LOOK as CLAY_EXAM, GROUP_LOOK as CLAY_GROUP, GROUP_MOTO_LOOK as CLAY_GROUP_MOTO, blockLabel, guideLook } from '../utils/agendaLook';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { SOFT } from '../utils/motion';
import { ClayPressable } from './clay/ClayPressable';
import { useTabBarOverlap } from './tabBarSpace';
import { useTabBarCover } from './sheetPresence';
import { createKindSheetStore } from '../stores/createKindSheetStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CREATE_LABEL, draftLook } from './agenda/createKinds';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AvailWindow = { startMinutes: number; endMinutes: number };

export type AgendaCreateKind = 'lesson' | 'group' | 'exam' | 'theory' | 'block';
export type AgendaCreateSlot = {
  date: Date;
  startMin: number;
  durMin: number;
  /** Fuori dalle fasce di disponibilità del giorno (si crea lo stesso). */
  outsideAvailability: boolean;
};
const ALL_CREATE_KINDS: AgendaCreateKind[] = ['lesson', 'group', 'exam', 'theory', 'block'];

type WeeklyAgendaViewProps = {
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks?: InstructorBlock[];
  holidays?: Set<string>;
  /** A date inside the week to open on first render. */
  anchorDate?: Date;
  /** Owner / read-only: no booking, no block removal. */
  readOnly?: boolean;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson?: (groupLessonId: string) => void;
  onPressBlock?: (block: InstructorBlock) => void;
  /**
   * REG-585 — chi sta guardando la griglia. Sui blocchi condivisi mostra
   * l'icona catena + "con <collega>", togliendo i propri panni dai nomi.
   */
  myInstructorId?: string | null;
  /**
   * REG-671 — creazione dal blocco fantasma: il tocco su un tipo della card in
   * basso (Guida, Di gruppo, Esame, Teoria, Blocca) con giorno, inizio e durata
   * del fantasma. Senza, la griglia non crea nulla.
   */
  onCreateAt?: (kind: AgendaCreateKind, slot: AgendaCreateSlot) => void;
  /** Tipi offerti dalla card, nell'ordine (default: tutti). */
  createKinds?: AgendaCreateKind[];
  /** Colore del veicolo dell'istruttore: l'auto 3D della card «Guida». */
  carColor?: string | null;
  /**
   * La griglia mostra più istruttori (titolare, «Tutti gli istruttori»): il
   * fantasma non si ferma sugli eventi degli altri, li controlla il server.
   */
  ghostIgnoresEvents?: boolean;
  /** Cambia → il fantasma sparisce (es. dopo una creazione riuscita). */
  ghostResetKey?: number;
  /** Allowed lesson durations (minutes) — the ghost block snaps only to these (same set as the booking modal). */
  allowedDurations?: number[];
  /** Ghost CTA visible/hidden — lets the parent hide the FAB underneath. */
  onGhostActiveChange?: (active: boolean) => void;
  /** Fired when the visible week settles (swipe / "Oggi"). */
  onDateChange?: (weekStart: Date) => void;
  loading?: boolean;
  studentCompletedMinutes?: Record<string, number>;
  /** Availability windows keyed by YYYY-MM-DD (minutes since midnight). */
  weekAvailabilityByDate?: Record<string, AvailWindow[]>;
  /** Pull-to-refresh on the grid. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FIRST_HOUR = 7;
// Upper boundary of the grid. With LAST_HOUR = 24 the last visible row is
// labeled "23:00" and covers 23:00–24:00, so events ending up to midnight render.
const LAST_HOUR = 24;
const ROW_H = 56;
const GUTTER_W = 32;
const COL_GAP = 3;        // gap between day columns (Airbnb-ish breathing room)
const GRID_TOP_PAD = 12;  // breathing room so the first hour label isn't clipped

// Ghost-block booking.
const STEP = 15;                       // minutes per snap step (drag granularity)
const PX_PER_STEP = ROW_H / 4;         // px of vertical drag per 15-min step (1:1 with the grid)
const FALLBACK_DURATIONS = [30, 60, 90, 120]; // used only if the parent passes none
const DAY_MIN = FIRST_HOUR * 60;
const DAY_MAX = LAST_HOUR * 60;

// Snap a raw (dragged) duration to the nearest *allowed* lesson duration that
// still fits `maxFit` minutes; falls back to the smallest allowed if none fit.
// Worklet: runs on the UI thread during the resize gesture.
function fitAllowedDur(raw: number, allowed: number[], maxFit: number): number {
  'worklet';
  let best = -1;
  let smallest = allowed[0];
  for (let i = 0; i < allowed.length; i++) {
    const d = allowed[i];
    if (d < smallest) smallest = d;
    if (d <= maxFit && (best === -1 || Math.abs(d - raw) < Math.abs(best - raw))) best = d;
  }
  return best === -1 ? smallest : best;
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
function freeSegEnd(pos: number, free: number[]): number {
  'worklet';
  for (let i = 0; i + 1 < free.length; i += 2) {
    if (pos >= free[i] && pos <= free[i + 1]) return free[i + 1];
  }
  return DAY_MAX;
}
// Start of the free segment containing `pos` — the cap for an upward resize.
function freeSegStart(pos: number, free: number[]): number {
  'worklet';
  for (let i = 0; i + 1 < free.length; i += 2) {
    if (pos >= free[i] && pos <= free[i + 1]) return free[i];
  }
  return DAY_MIN;
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

// Horizontal week carousel: half a year of swipe each way, centered on "today".
const WEEK_SPAN = 26;

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];
const DAY_LABELS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isSameWeek = (a: Date, b: Date) => isSameDay(getMonday(a), getMonday(b));

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
/** «Sabato 31 ottobre». */
const fmtLongDay = (d: Date) => {
  const t = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
/** «Ven 6 nov». */
const fmtShortDay = (d: Date) => `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()}`;
const fmtDur = (min: number) => {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60}'`;
  return `${min}'`;
};

/* ------------------------------------------------------------------ */
/*  Ghost label store — tiny pub/sub (same pattern as scrubOverlay)    */
/*  Updated per 15-min step from the gesture worklets via runOnJS so   */
/*  only the two <Text> inside the ghost re-render, never the grid.    */
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
const ghostTimeLabel = makeTextStore();
const ghostDurLabel = makeTextStore();
// Barra in basso e foglio dei tipi: giorno e fascia seguono il fantasma dal vivo.
const ghostDayLabel = makeTextStore();
const ghostShortDayLabel = makeTextStore();
const ghostRangeLabel = makeTextStore();
// Dentro la bozza: «13:00–14:00» (stretto, come gli altri blocchi) e il tipo scelto.
const ghostTightRangeLabel = makeTextStore();
const ghostKindStore = makeTextStore();
// A sinistra della griglia, all'altezza del bordo che si trascina (Calendario di Apple).
const ghostEdgeLabel = makeTextStore();
const useTextStore = (store: ReturnType<typeof makeTextStore>) =>
  useSyncExternalStore(store.subscribe, store.get);

const formatWeekLabel = (monday: Date): string => {
  const saturday = addDays(monday, 5);
  const monMonth = MONTH_NAMES[monday.getMonth()];
  const satMonth = MONTH_NAMES[saturday.getMonth()];
  if (monday.getMonth() === saturday.getMonth()) {
    return `${monday.getDate()} – ${saturday.getDate()} ${satMonth}`;
  }
  return `${monday.getDate()} ${monMonth} – ${saturday.getDate()} ${satMonth}`;
};

/* ------------------------------------------------------------------ */
/*  Lesson appearance — mono-navy (Variant A)                          */
/* ------------------------------------------------------------------ */

type LessonLook = { bg: string; text: string; sub: string; pressed: string; ring?: string | null };

// Active guides are navy-filled pills; "spent" states (cancelled / no_show) recede
// to a muted grey so the eye reads the live week at a glance.

const getLessonLook = (
  appt: AutoscuolaAppointmentWithRelations,
  colorConfig: AgendaColorConfig,
): LessonLook & { bar: string | null; muted: boolean; glow: string } => {
  // REG-639: un solo punto per l'aspetto (barretta + tinta leggerissima).
  const l = guideLook(appt, colorConfig);
  return { bg: l.wash, text: l.text, sub: l.sub, pressed: l.wash, ring: l.ring, bar: l.bar, muted: l.muted, glow: l.glow };
};

// Dedicated tinted looks for exams (indigo) and group lessons (teal) — same
// palettes as the day/week views, so the event type reads at a glance.
// Palette allineata alla web app (e alla vista giornaliera): esame lavanda,
// gruppo teal, gruppo moto arancio. Il bordo è la versione satura del fondo.
// `shadow` = l'accento dell'ombra in tinta, gli stessi hex della web app
// (`--agenda-card-shadow` in globals.css) e delle card della giornaliera.
// REG-639 clay: niente viola/teal saturi — stesse tinte della vista Giorno
// (`utils/agendaLook`): fondo leggerissimo, barretta piena, testo nero.
const EXAM_LOOK = { bg: CLAY_EXAM.wash, bar: CLAY_EXAM.bar, text: '#111111', glow: CLAY_EXAM.glow };
const GROUP_LOOK = { bg: CLAY_GROUP.wash, bar: CLAY_GROUP.bar, text: '#111111', glow: CLAY_GROUP.glow };
// Moto group lessons: identical style, ambra.
const GROUP_MOTO_LOOK = { bg: CLAY_GROUP_MOTO.wash, bar: CLAY_GROUP_MOTO.bar, text: '#111111', glow: CLAY_GROUP_MOTO.glow };
/** Ombra morbida in tinta del blocco (REG-639, 29/10): niente bordo, solo tinta + ombra. */
const tintShadow = (color: string) => [{ offsetX: 0, offsetY: 4, blurRadius: 10, spreadDistance: -3, color }];
const GROUP_CAPACITY = 3; // fallback — real capacity comes from the BE row annotation

/**
 * Nomi dei partecipanti nello spazio che avanza sotto il blocco: una guida di
 * gruppo di 3 ore e' alta 168pt e ne usava 30. Si riempie solo quello che
 * avanza davvero — testa (13) + orario (15) + padding (10) = 38pt occupati,
 * poi una riga da 11pt per nome. Se non ci stanno tutti, l'ultima riga dice
 * quanti mancano. In ~39pt di larghezza ci sta un nome di battesimo, quindi e'
 * quello che si mostra.
 */
const EventStudentNames = ({ names, height, color }: { names: string[]; height: number; color: string }) => {
  if (!names.length) return null;
  const slots = Math.floor((height - 40) / 11);
  if (slots < 1) return null;
  const shown = names.length <= slots ? names : names.slice(0, Math.max(1, slots - 1));
  const rest = names.length - shown.length;
  return (
    <View style={styles.eventNames}>
      {shown.map((n, i) => (
        <Text key={i} style={[styles.eventNameLine, { color }]} numberOfLines={1}>{n}</Text>
      ))}
      {rest > 0 ? (
        <Text style={[styles.eventNameLine, { color, opacity: 0.65 }]} numberOfLines={1}>+{rest}</Text>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Skeleton pulse block                                               */
/* ------------------------------------------------------------------ */

const SkeletonBlock = ({ style }: { style: object }) => {
  const opacity = useSharedValue(0.10);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.22, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ backgroundColor: '#111111', opacity: opacity.value }));
  return <Animated.View style={[style, animStyle]} />;
};

const SKELETON_BLOCKS = [
  { col: 0, top: 2.5, h: 1.2 },
  { col: 1, top: 1.0, h: 1.0 },
  { col: 1, top: 4.0, h: 0.8 },
  { col: 2, top: 0.5, h: 1.5 },
  { col: 3, top: 3.0, h: 1.0 },
  { col: 3, top: 5.5, h: 0.8 },
  { col: 4, top: 1.5, h: 1.0 },
  { col: 5, top: 3.5, h: 1.2 },
];

/* ------------------------------------------------------------------ */
/*  Free segment = hold-and-scrub bookable surface                     */
/* ------------------------------------------------------------------ */

type GhostSharedValues = {
  gCol: SharedValue<number>;
  gStart: SharedValue<number>;
  gDur: SharedValue<number>;
  gLive: SharedValue<number>;
  /** Free segments per column (flat [s0,e0,…]) — the ghost must stay inside one. */
  gFree: SharedValue<number[][]>;
};

type GridBookableProps = GhostSharedValues & {
  top: number; height: number; left: number; width: number;
  /** This free segment's bounds (minutes from midnight), to map e.y → time. */
  windowStart: number; windowEnd: number;
  colIdx: number;
  colW: number;
  /** Default lesson duration (an allowed value) used when a block is born. */
  defaultDur: number;
  /** Whether a ghost block is currently mounted on this week page. */
  ghostOn: boolean;
  /** Mount the ghost overlay + hide the CTA (drag just started). */
  onArm: (col: number, start: number, dur: number) => void;
  /** 15-min step crossed while dragging — update labels + tick. */
  onStep: (start: number, dur: number) => void;
  /** Gesture released — ghost placed, show CTA. */
  onPlace: (col: number, start: number, dur: number) => void;
  /** Quick tap on free space: create the ghost there, or glide the existing one there. */
  onTapCreate: (col: number, start: number, dur: number) => void;
};

// Any free time is bookable — the surface spans a free segment (the day minus
// guides/blocks), NOT the availability. Press-and-hold (220ms) births a GHOST
// BLOCK (1h) under the finger and drags it live — vertically in 15-min steps,
// horizontally across day columns. Release places it (resize knobs + bottom
// CTA appear). A quick tap places a ghost at the tapped slot — or glides the
// current one there (REG-671). The surface itself stays invisible.
const GridBookableWindow = ({
  top, height, left, width, windowStart, windowEnd, colIdx, colW, defaultDur, ghostOn,
  gCol, gStart, gDur, gLive, gFree, onArm, onStep, onPlace, onTapCreate,
}: GridBookableProps) => {
  const baseStart = useSharedValue(0);
  const baseCol = useSharedValue(0);

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
      runOnJS(onArm)(colIdx, start, dur);
    })
    .onUpdate((e) => {
      const steps = Math.round(e.translationY / PX_PER_STEP);
      const cols = Math.round(e.translationX / (colW + COL_GAP));
      const col = Math.max(0, Math.min(5, baseCol.value + cols));
      let start = baseStart.value + steps * STEP;
      start = Math.max(DAY_MIN, Math.min(DAY_MAX - gDur.value, start));
      // Keep the ghost inside a free segment — never let it overlap a block.
      const free = gFree.value[col] ?? [];
      if (free.length) {
        const cs = clampStartToFree(start, gDur.value, free);
        if (cs < 0) return; // no free slot in this column fits → don't move there
        start = cs;
      }
      if (col !== gCol.value || start !== gStart.value) {
        gCol.value = col; gStart.value = start;
        runOnJS(onStep)(start, gDur.value);
      }
    })
    .onEnd(() => {
      gLive.value = withTiming(0, { duration: 180 });
      runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
    })
    .onFinalize((_e, success) => {
      // Gesture cancelled mid-drag (system interruption): settle the ghost
      // where it is instead of leaving it in the live/CTA-less limbo.
      if (!success && gLive.value > 0) {
        gLive.value = withTiming(0, { duration: 180 });
        runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
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
      runOnJS(onTapCreate)(colIdx, start, dur);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={{ position: 'absolute', top, height, left, width, zIndex: 2 }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.bookSurface} />
      </GestureDetector>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Ghost block — draggable, resizable draft of the new lesson         */
/* ------------------------------------------------------------------ */

type GhostBlockProps = GhostSharedValues & {
  colW: number;
  allowedDur: number[];
  onLift: () => void;
  onStep: (start: number, dur: number) => void;
  onPlace: (col: number, start: number, dur: number) => void;
  /** Tocco sulla bozza: la toglie. */
  onDismiss: () => void;
};

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
const GhostBlock = ({ colW, allowedDur, gCol, gStart, gDur, gLive, gFree, onLift, onStep, onPlace, onDismiss }: GhostBlockProps) => {
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
        runOnJS(onLift)();
      })
      .onUpdate((e) => {
        // Drag finely, but snap the resulting DURATION to an allowed lesson length.
        const delta = Math.round(e.translationY / PX_PER_STEP) * STEP;
        const free = gFree.value[gCol.value] ?? [];
        if (edge === 'top') {
          // Can't grow up past the top of the current free segment.
          const minStart = free.length ? freeSegStart(baseEnd.value, free) : DAY_MIN;
          const rawDur = baseEnd.value - (baseStart.value + delta);
          const nd = snapDurFree(rawDur, baseEnd.value - minStart);
          const ns = baseEnd.value - nd;
          if (ns !== gStart.value) {
            gStart.value = ns; gDur.value = nd;
            runOnJS(setGhostEdge)(ns);
            runOnJS(onStep)(ns, nd);
          }
        } else {
          // Can't grow down past the end of the current free segment.
          const maxEnd = free.length ? freeSegEnd(baseStart.value, free) : DAY_MAX;
          const rawDur = (baseEnd.value + delta) - baseStart.value;
          const nd = snapDurFree(rawDur, maxEnd - baseStart.value);
          if (nd !== gDur.value) {
            gDur.value = nd;
            runOnJS(setGhostEdge)(baseStart.value + nd);
            runOnJS(onStep)(baseStart.value, nd);
          }
        }
      })
      .onEnd(() => {
        gLive.value = withTiming(0, { duration: 180 });
        gEdge.value = 0;
        runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
      })
      .onFinalize((_e, success) => {
        if (!success && gLive.value > 0) {
          gLive.value = withTiming(0, { duration: 180 });
          gEdge.value = 0;
          runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
        }
      });

  const topKnobPan = useMemo(() => makeKnobPan('top'), [allowedDur]); // eslint-disable-line react-hooks/exhaustive-deps
  const botKnobPan = useMemo(() => makeKnobPan('bottom'), [allowedDur]); // eslint-disable-line react-hooks/exhaustive-deps

  /* — body: hold (160ms) and drag the whole block, also across days —
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
      runOnJS(onLift)();
    })
    .onUpdate((e) => {
      const steps = Math.round(e.translationY / PX_PER_STEP);
      const cols = Math.round(e.translationX / (colW + COL_GAP));
      const col = Math.max(0, Math.min(5, baseCol.value + cols));
      let start = baseStart.value + steps * STEP;
      start = Math.max(DAY_MIN, Math.min(DAY_MAX - gDur.value, start));
      // Keep the ghost inside a free segment — never let it overlap a block.
      const free = gFree.value[col] ?? [];
      if (free.length) {
        const cs = clampStartToFree(start, gDur.value, free);
        if (cs < 0) return; // no free slot in this column fits → don't move there
        start = cs;
      }
      if (col !== gCol.value || start !== gStart.value) {
        gCol.value = col; gStart.value = start;
        runOnJS(onStep)(start, gDur.value);
      }
    })
    .onEnd(() => {
      gLive.value = withTiming(0, { duration: 180 });
      runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
    })
    .onFinalize((_e, success) => {
      if (!success && gLive.value > 0) {
        gLive.value = withTiming(0, { duration: 180 });
        runOnJS(onPlace)(gCol.value, gStart.value, gDur.value);
      }
    }), [topKnobPan, botKnobPan, colW]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapBody = useMemo(() => Gesture.Tap()
    .maxDuration(250)
    .requireExternalGestureToFail(topKnobPan, botKnobPan)
    .onEnd((_e, success) => {
      if (success) runOnJS(onDismiss)();
    }), [topKnobPan, botKnobPan, onDismiss]);
  const bodyGesture = useMemo(() => Gesture.Exclusive(movePan, tapBody), [movePan, tapBody]);

  const frameStyle = useAnimatedStyle(() => ({
    top: ((gStart.value - DAY_MIN) / 60) * ROW_H,
    height: (gDur.value / 60) * ROW_H,
    left: GUTTER_W + gCol.value * (colW + COL_GAP) + 2,
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
      top: ((edgeMin - DAY_MIN) / 60) * ROW_H - 7,
      opacity: gEdge.value > 0 ? gLive.value : 0,
    };
  });

  return (
    <>
      <GestureDetector gesture={bodyGesture}>
        <Animated.View
          entering={GHOST_IN}
          exiting={GHOST_OUT}
          style={[styles.ghost, { boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 14, spreadDistance: -8, color: look.glow }] }, frameStyle]}
          testID="agenda-ghost"
          accessibilityRole="button"
          accessibilityLabel={`${CREATE_LABEL[kind]} ${rangeText}. Tocca per togliere.`}
        >
          <Animated.View style={[styles.ghostSkin, skinStyle]}>
            <Text style={styles.ghostKind} numberOfLines={1}>{CREATE_LABEL[kind]}</Text>
            <Text style={styles.ghostRange}>{rangeText}</Text>
            <Animated.Text style={[styles.ghostDur, durStyle]} numberOfLines={1}>{durText}</Animated.Text>
          </Animated.View>
          <GestureDetector gesture={topKnobPan}>
            <Animated.View
              style={[styles.ghostKnob, { top: -KNOB / 2, right: 6, borderColor: look.dot }, topKnobStyle]}
              hitSlop={{ top: 14, bottom: 10, left: 18, right: 18 }}
            />
          </GestureDetector>
          <GestureDetector gesture={botKnobPan}>
            <Animated.View
              style={[styles.ghostKnob, { bottom: -KNOB / 2, left: 6, borderColor: look.dot }, botKnobStyle]}
              hitSlop={{ top: 10, bottom: 14, left: 18, right: 18 }}
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[styles.ghostEdge, edgeStyle]}>
        <Text style={styles.ghostEdgeText} numberOfLines={1}>{edgeText}</Text>
      </Animated.View>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  One week page (day header + vertical hour grid)                    */
/* ------------------------------------------------------------------ */

type WeekPageProps = {
  monday: Date;
  pageWidth: number;
  pageHeight: number;
  colW: number;
  today: Date;
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks: InstructorBlock[];
  holidays: Set<string>;
  weekAvailabilityByDate: Record<string, AvailWindow[]>;
  studentCompletedMinutes: Record<string, number>;
  readOnly: boolean;
  loading: boolean;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam?: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson?: (groupLessonId: string) => void;
  onPressBlock?: (block: InstructorBlock) => void;
  /** REG-585 — chi guarda: serve al segnale "condivisa con" sui blocchi. */
  myInstructorId?: string | null;
  /** Ghost-block booking enabled (instructor, not read-only). */
  canBook: boolean;
  /** Allowed lesson durations (minutes) + the default one used when a block is born. */
  allowedDur: number[];
  defaultDur: number;
  /** Ghost placed (info) or lifted/dismissed (null) → parent drives the CTA. */
  onGhostChange: (info: { date: Date; startMin: number; durMin: number } | null) => void;
  /** Parent bumps this to clear the ghost (tap on the draft / confirm / week swipe). */
  ghostDismissTick: number;
  /** Tocco sulla bozza: la toglie (il genitore spegne anche la barra). */
  onGhostDismiss: () => void;
  /** Più istruttori sulla griglia: il fantasma non si ferma sugli eventi. */
  ghostIgnoresEvents: boolean;
  /** Pull-to-refresh on the vertical grid scroll. */
  refreshing: boolean;
  onRefresh?: () => void;
};

const WeekPage = React.memo(function WeekPage({
  monday, pageWidth, pageHeight, colW, today, appointments, instructorBlocks, holidays,
  weekAvailabilityByDate, readOnly, loading,
  onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock, myInstructorId,
  canBook, allowedDur, defaultDur, onGhostChange, ghostDismissTick, onGhostDismiss, ghostIgnoresEvents,
  refreshing, onRefresh,
}: WeekPageProps) {
  // Tab bar in vetro sopra la griglia: l'ultima ora resta raggiungibile.
  const barOverlap = useTabBarOverlap();
  const colX = (i: number) => GUTTER_W + i * (colW + COL_GAP);
  const gridHeight = (LAST_HOUR - FIRST_HOUR) * ROW_H;

  // Config colore blocchi (pannello web "Aspetto"): criterio + override +
  // eccezioni dai settings company. Cache-first, default sicuri se assenti.
  const agendaSettings = useAutoscuolaSettings();
  const colorConfig = useMemo(() => resolveAgendaColorConfig(agendaSettings.data), [agendaSettings.data]);
  // REG-633: nome del mezzo nei blocchi, se l'autoscuola l'ha acceso.
  const showVehicle = showVehicleOnBlocks(agendaSettings.data);

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), [monday]);

  /* ── Ghost block state ──
   * Position/size live on shared values (UI-thread drag); React only knows
   * whether the ghost exists. Labels go through the ghost*Label stores. */
  const gCol = useSharedValue(0);
  const gStart = useSharedValue(DAY_MIN);
  const gDur = useSharedValue(defaultDur);
  const gLive = useSharedValue(0);
  const gFree = useSharedValue<number[][]>([]);
  const [ghostOn, setGhostOn] = useState(false);

  const ghostOnRef = useRef(false);
  ghostOnRef.current = ghostOn;

  // Etichette del fantasma (inizio, durata) e della card in basso (giorno, fascia).
  const setGhostLabels = useCallback((col: number, start: number, dur: number) => {
    ghostTimeLabel.set(fmtMin(start));
    ghostDurLabel.set(fmtDur(dur));
    ghostRangeLabel.set(`${fmtMin(start)} – ${fmtMin(start + dur)}`);
    ghostTightRangeLabel.set(`${fmtMin(start)}–${fmtMin(start + dur)}`);
    const day = weekDays[Math.max(0, Math.min(5, Math.round(col)))];
    if (day) {
      ghostDayLabel.set(fmtLongDay(day));
      ghostShortDayLabel.set(fmtShortDay(day));
    }
  }, [weekDays]);

  const ghostArm = useCallback((col: number, start: number, dur: number) => {
    setGhostLabels(col, start, dur);
    setGhostOn(true);
    onGhostChange({ date: weekDays[col], startMin: start, durMin: dur });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setGhostLabels, onGhostChange, weekDays]);

  const ghostStep = useCallback((start: number, dur: number) => {
    setGhostLabels(gCol.value, start, dur);
    Haptics.selectionAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGhostLabels]);

  const ghostLift = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const ghostPlace = useCallback((col: number, start: number, dur: number) => {
    const c = Math.round(col);
    setGhostLabels(c, start, dur);
    onGhostChange({ date: weekDays[c], startMin: start, durMin: dur });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setGhostLabels, onGhostChange, weekDays]);

  // Tocco su uno spazio libero: nasce il fantasma, oppure quello che c'è già
  // ci scivola (220 ms, niente rimbalzo) tenendo la sua durata.
  const ghostTapCreate = useCallback((col: number, start: number, dur: number) => {
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
    setGhostLabels(col, start, dur);
    onGhostChange({ date: weekDays[col], startMin: start, durMin: dur });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGhostLabels, onGhostChange, weekDays]);

  // Parent-driven dismiss (CTA ✕, confirm, week swipe).
  useEffect(() => {
    if (ghostDismissTick > 0) setGhostOn(false);
  }, [ghostDismissTick]);
  const hours = useMemo(() => Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i), []);
  const isCurrentWeek = isSameWeek(monday, today);

  const appointmentsByCol = useMemo(() => {
    const buckets: AutoscuolaAppointmentWithRelations[][] = Array.from({ length: 6 }, () => []);
    for (const appt of appointments) {
      const start = new Date(appt.startsAt);
      const dow = start.getDay();
      if (dow === 0) continue;
      const colIdx = dow - 1;
      if (colIdx > 5) continue;
      const ad = new Date(start); ad.setHours(0, 0, 0, 0);
      const cd = new Date(weekDays[colIdx]); cd.setHours(0, 0, 0, 0);
      if (ad.getTime() !== cd.getTime()) continue;
      buckets[colIdx].push(appt);
    }
    return buckets;
  }, [appointments, weekDays]);

  const blocksByCol = useMemo(() => {
    const buckets: InstructorBlock[][] = Array.from({ length: 6 }, () => []);
    for (const block of instructorBlocks) {
      const start = new Date(block.startsAt);
      const dow = start.getDay();
      if (dow === 0) continue;
      const colIdx = dow - 1;
      if (colIdx > 5) continue;
      const bd = new Date(start); bd.setHours(0, 0, 0, 0);
      const cd = new Date(weekDays[colIdx]); cd.setHours(0, 0, 0, 0);
      if (bd.getTime() !== cd.getTime()) continue;
      buckets[colIdx].push(block);
    }
    return buckets;
  }, [instructorBlocks, weekDays]);

  // Split each column's appointments into the four dedicated event kinds:
  // individual guide pills, collapsed timed-exam slots, collapsed group lessons,
  // and timeless exams (no time → shown in the all-day lane).
  const eventsByCol = useMemo(() => {
    const slotKey = (a: AutoscuolaAppointmentWithRelations) => `${a.startsAt}|${a.endsAt ?? ''}|${a.instructorId ?? ''}`;
    return weekDays.map((_day, colIdx) => {
      const guide: AutoscuolaAppointmentWithRelations[] = [];
      const timeless: AutoscuolaAppointmentWithRelations[] = [];
      const examMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
      const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
      for (const a of appointmentsByCol[colIdx]) {
        const status = (a.status ?? '').trim().toLowerCase();
        if (a.type === 'esame') {
          if (!a.endsAt) { if (status !== 'cancelled') timeless.push(a); continue; }
          const k = slotKey(a);
          const arr = examMap.get(k); if (arr) arr.push(a); else examMap.set(k, [a]);
        } else if (a.type === 'group_lesson') {
          const k = a.groupLessonId ?? slotKey(a);
          const arr = groupMap.get(k); if (arr) arr.push(a); else groupMap.set(k, [a]);
        } else {
          guide.push(a);
        }
      }
      const exams = Array.from(examMap.values());
      const groups = Array.from(groupMap.entries()).map(([key, appts]) => ({
        groupLessonId: appts[0].groupLessonId ?? (key.includes('|') ? null : key),
        appts,
      }));
      return { guide, exams, groups, timeless };
    });
  }, [appointmentsByCol, weekDays]);

  const weekHasTimeless = useMemo(
    () => eventsByCol.some((c) => c.timeless.length > 0),
    [eventsByCol],
  );

  // Availability veil (informational, light) — merged windows, does NOT gate booking.
  const availTintByCol = useMemo(() => weekDays.map((day) => {
    const rawSlots = weekAvailabilityByDate[toDateKey(day)] ?? [];
    if (!rawSlots.length) return [] as Array<[number, number]>;
    const raw: Array<[number, number]> = rawSlots
      .map((s) => [Math.max(s.startMinutes, FIRST_HOUR * 60), Math.min(s.endMinutes, LAST_HOUR * 60)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const w of raw) {
      const last = merged[merged.length - 1];
      if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
      else merged.push([w[0], w[1]]);
    }
    return merged;
  }), [weekDays, weekAvailabilityByDate]);

  // Bookable free segments = whole day (07–24) minus occupied (non-cancelled guide + blocks).
  const bookableByCol = useMemo(() => {
    const DAY_START = FIRST_HOUR * 60;
    const DAY_END = LAST_HOUR * 60;
    return weekDays.map((_day, colIdx) => {
      if (ghostIgnoresEvents) {
        const all: Array<[number, number]> = [[DAY_START, DAY_END]];
        return { segments: all, starts: [] as number[] };
      }
      const occupied: Array<[number, number]> = [];
      for (const a of appointmentsByCol[colIdx]) {
        if ((a.status ?? '').trim().toLowerCase() === 'cancelled') continue;
        if (a.type === 'esame' && !a.endsAt) continue; // timeless exam: no real time block
        const s = new Date(a.startsAt);
        const sm = s.getHours() * 60 + s.getMinutes();
        let em = sm + 60;
        if (a.endsAt) { const e = new Date(a.endsAt); em = e.getHours() * 60 + e.getMinutes(); }
        if (em > sm) occupied.push([sm, em]);
      }
      for (const b of blocksByCol[colIdx]) {
        const s = new Date(b.startsAt); const e = new Date(b.endsAt);
        const sm = s.getHours() * 60 + s.getMinutes();
        const em = e.getHours() * 60 + e.getMinutes();
        if (em > sm) occupied.push([sm, em]);
      }
      occupied.sort((a, b) => a[0] - b[0]);
      const occ: Array<[number, number]> = [];
      for (const o of occupied) {
        const last = occ[occ.length - 1];
        if (last && o[0] <= last[1]) last[1] = Math.max(last[1], o[1]);
        else occ.push([o[0], o[1]]);
      }
      const segments: Array<[number, number]> = [];
      let cursor = DAY_START;
      for (const [os, oe] of occ) {
        if (oe <= cursor) continue;
        if (os > cursor) segments.push([cursor, Math.min(os, DAY_END)]);
        cursor = Math.max(cursor, oe);
        if (cursor >= DAY_END) break;
      }
      if (cursor < DAY_END) segments.push([cursor, DAY_END]);
      const segs = segments.filter(([s, e]) => e - s >= STEP);
      const starts: number[] = [];
      for (const [s, e] of segs) for (let m = s; m <= e - STEP; m += STEP) starts.push(m);
      return { segments: segs, starts };
    });
  }, [weekDays, appointmentsByCol, blocksByCol, ghostIgnoresEvents]);

  // Keep the UI-thread copy of the free segments per column in sync, so the
  // ghost-drag worklets can clamp the block to never overlap a guide/block.
  useEffect(() => {
    gFree.value = bookableByCol.map((c) => c.segments.flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookableByCol]);

  const holidayCols = useMemo(
    () => new Set(weekDays.map((d, i) => (holidays.has(toDateKey(d)) ? i : -1)).filter((i) => i >= 0)),
    [weekDays, holidays],
  );

  const nowLineTop = useMemo(() => {
    if (!isCurrentWeek) return null;
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    const off = (m - FIRST_HOUR * 60) / 60;
    if (off < 0 || off > LAST_HOUR - FIRST_HOUR) return null;
    return off * ROW_H;
  }, [isCurrentWeek]);

  const todayColIdx = useMemo(() => {
    if (!isCurrentWeek) return -1;
    return weekDays.findIndex((d) => isSameDay(d, today));
  }, [isCurrentWeek, weekDays, today]);

  return (
    <View style={{ width: pageWidth, height: pageHeight }}>
      {/* Day header (slides with the week) */}
      <View style={styles.dayHeaderRow}>
        <View style={{ width: GUTTER_W }} />
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const isHoliday = holidayCols.has(idx);
          return (
            <View key={idx} style={[styles.dayHeaderCell, { width: colW, marginLeft: idx === 0 ? 0 : COL_GAP }]}>
              <Text
                style={[
                  styles.dayLetter,
                  isPast && !isHoliday && { color: '#CCCCCC' },
                  isToday && { color: '#111111' },
                  isHoliday && { color: '#B4B4B4', textDecorationLine: 'line-through' },
                ]}
              >
                {DAY_LABELS[idx]}
              </Text>
              {isToday ? (
                <View style={styles.todayCircle}>
                  <Text style={styles.todayCircleText}>{day.getDate()}</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.dayNumber,
                    isPast && !isHoliday && { color: '#CCCCCC' },
                    isHoliday && { color: '#B4B4B4', textDecorationLine: 'line-through' },
                  ]}
                >
                  {day.getDate()}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Timeless exams (no time yet) — prominent canonical exam card per day */}
      {weekHasTimeless && (
        <View style={styles.timelessWrap}>
          {eventsByCol.map(({ timeless }, colIdx) => {
            if (!timeless.length) return null;
            const day = weekDays[colIdx];
            const dayLabel = day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
            const n = timeless.filter((a) => !isExamPlaceholder(a)).length;
            return (
              <Pressable
                key={`tl-${colIdx}`}
                onPress={() => onPressExam?.(timeless)}
                style={({ pressed }) => [styles.examBanner, pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] }]}
              >
                <View style={styles.examBannerClip} pointerEvents="none">
                  <View style={styles.examBannerBar} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examBannerLabel}>Esame · {dayLabel}</Text>
                  <Text style={styles.examBannerTitle} numberOfLines={1}>
                    {n === 0 ? 'Nessun allievo' : `${n} ${n === 1 ? 'allievo' : 'allievi'}`} · Orario da definire
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Scrollable time grid */}
      <ScrollView
        style={styles.scrollView}
        nestedScrollEnabled
        contentContainerStyle={{ height: gridHeight + GRID_TOP_PAD + 110 + barOverlap, paddingHorizontal: 12, paddingTop: GRID_TOP_PAD }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111111"
              colors={['#111111']}
            />
          ) : undefined
        }
      >
        {/* Column canvases — recessed grey = closed/unavailable */}
        {weekDays.map((_day, colIdx) => {
          const isHoliday = holidayCols.has(colIdx);
          const isTodayCol = colIdx === todayColIdx;
          return (
            <View
              key={`canvas-${colIdx}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: colX(colIdx),
                width: colW,
                height: gridHeight,
                // REG-639 clay: colonne bianche separate da un filetto (niente grigio).
                backgroundColor: '#FFFFFF',
                borderLeftWidth: colIdx === 0 ? 0 : StyleSheet.hairlineWidth,
                borderLeftColor: isHoliday || isTodayCol ? 'rgba(17,17,17,0.14)' : 'rgba(17,17,17,0.08)',
              }}
            />
          );
        })}

        {/* Availability veil — faint light hint only (does not gate booking).
            Rendered BEFORE the hour gridlines so the lines stay visible on top
            of the white availability blocks. */}
        {availTintByCol.map((wins, colIdx) =>
          wins.map(([sMin, eMin], i) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <View
                key={`avt-${colIdx}-${i}`}
                pointerEvents="none"
                style={[styles.availTint, { top, height, left: colX(colIdx), width: colW }]}
              />
            );
          }),
        )}

        {/* Hour gridlines + labels — drawn over the availability veils */}
        {hours.map((hour, idx) => (
          <View
            key={hour}
            pointerEvents="none"
            style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
          >
            <Text style={styles.hourLabel}>{pad(hour)}</Text>
            {idx > 0 && (
              <View style={{ position: 'absolute', top: 0, left: GUTTER_W, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#E2E2E2' }} />
            )}
          </View>
        ))}

        {/* Bookable free segments — invisible press-and-hold ghost surfaces */}
        {canBook && bookableByCol.map(({ segments }, colIdx) =>
          segments.map(([sMin, eMin], si) => {
            const top = ((sMin - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = ((eMin - sMin) / 60) * ROW_H;
            return (
              <GridBookableWindow
                key={`bk-${colIdx}-${si}`}
                top={top} height={height} left={colX(colIdx) + 2} width={colW - 4}
                windowStart={sMin} windowEnd={eMin}
                colIdx={colIdx} colW={colW} defaultDur={defaultDur} ghostOn={ghostOn}
                gCol={gCol} gStart={gStart} gDur={gDur} gLive={gLive} gFree={gFree}
                onArm={ghostArm} onStep={ghostStep} onPlace={ghostPlace}
                onTapCreate={ghostTapCreate}
              />
            );
          }),
        )}

        {/* Skeleton blocks */}
        {loading && appointments.length === 0 && SKELETON_BLOCKS.map((sk, i) => (
          <SkeletonBlock
            key={`sk-${i}`}
            style={{
              position: 'absolute',
              top: sk.top * ROW_H,
              height: sk.h * ROW_H,
              left: colX(sk.col) + 3,
              width: colW - 4,
              borderRadius: 12,
            }}
          />
        ))}

        {/* Individual guide pills (navy-filled, rounded, 3D) */}
        {eventsByCol.map(({ guide }, colIdx) =>
          guide.map((appt) => {
            const start = new Date(appt.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (appt.endsAt) dur = (new Date(appt.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const look = getLessonLook(appt, colorConfig);
            const label = [appt.student?.lastName, appt.student?.firstName].filter(Boolean).join(' ') || 'Guida';
            const showTime = height >= 40;
            // Terza riga solo se c'è spazio (da ~50pt, cioè un'ora o più).
            const vehicleLabel = showVehicle && height >= 50 ? agendaVehicleLabel(appt) : null;
            return (
              <Pressable
                key={appt.id}
                onPress={() => onPressAppointment(appt)}
                style={({ pressed }) => [
                  styles.lesson,
                  { top, height, left: colX(colIdx) + 2, width: colW - 4, backgroundColor: look.bg, opacity: pressed ? 0.8 : look.muted ? 0.7 : 1, boxShadow: tintShadow(look.glow) },
                  look.ring ? { borderWidth: AUTOMATIC_MARKER_WIDTH, borderColor: look.ring } : null,
                ]}
              >
                {look.bar ? <View style={[styles.eventBar, { backgroundColor: look.bar }]} /> : null}
                <View style={styles.lessonInner}>
                  <Text style={[styles.lessonName, { color: look.text }]} numberOfLines={1}>{label}</Text>
                  {showTime && (
                    <Text style={[styles.lessonTime, { color: look.sub }]} numberOfLines={1}>
                      {pad(start.getHours())}:{pad(start.getMinutes())}
                    </Text>
                  )}
                  {vehicleLabel ? (
                    <Text style={[styles.lessonVehicle, { color: look.sub }]} numberOfLines={1}>
                      {vehicleLabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Esami — card lavanda: icona + conteggio, orario, nomi se c'e' spazio */}
        {eventsByCol.map(({ exams }, colIdx) =>
          exams.map((appts) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const examStudents = appts.filter((a) => !isExamPlaceholder(a));
            const examCount = examStudents.length;
            const examNames = examStudents
              .map((a) => a.student?.firstName || a.student?.lastName || '')
              .filter(Boolean);
            // REG-585: l'esame può essere accompagnato da un collega. Il join sta
            // su OGNI riga-allievo → unione, non la prima riga.
            const withNames = sharedWithNames(
              { instructorId: a0.instructorId ?? null, instructorName: a0.instructor?.name ?? null, coInstructors: unionCoInstructors(appts) },
              myInstructorId,
            );
            return (
              <Pressable
                key={`exam-${colIdx}-${a0.id}`}
                onPress={() => onPressExam?.(appts)}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: colX(colIdx) + 2, width: colW - 4, backgroundColor: EXAM_LOOK.bg, opacity: pressed ? 0.8 : 1, boxShadow: tintShadow(EXAM_LOOK.glow) },
                ]}
              >
                {EXAM_LOOK.bar ? <View style={[styles.eventBar, { backgroundColor: EXAM_LOOK.bar }]} /> : null}
                <View style={[styles.eventInner, { backgroundColor: EXAM_LOOK.bg }]}>
                {/* In colonna da ~39pt utili il titolo a parole non ci sta: il
                    tipo lo dicono colore e icona, le parole restano nello sheet. */}
                <View style={styles.eventHead}>
                  <Ionicons name="school" size={12} color={EXAM_LOOK.text} />
                  {examCount > 0 ? (
                    <Text style={[styles.eventCount, { color: EXAM_LOOK.text }]} numberOfLines={1}>{examCount}</Text>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  {withNames.length ? <Ionicons name="link" size={9} color={EXAM_LOOK.text} /> : null}
                </View>
                {height >= 40 && (
                  <Text style={[styles.eventTime, { color: EXAM_LOOK.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}
                  </Text>
                )}
                <EventStudentNames names={examNames} height={height} color={EXAM_LOOK.text} />
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Guide di gruppo — card teal (arancio se moto): posti N/C + nomi */}
        {eventsByCol.map(({ groups }, colIdx) =>
          groups.map(({ groupLessonId, appts }) => {
            const a0 = appts[0];
            const start = new Date(a0.startsAt);
            const sm = start.getHours() * 60 + start.getMinutes();
            const top = ((sm - FIRST_HOUR * 60) / 60) * ROW_H;
            let dur = 60;
            if (a0.endsAt) dur = (new Date(a0.endsAt).getTime() - start.getTime()) / 60000;
            const height = Math.max((dur / 60) * ROW_H, 26);
            const look = a0.groupLessonKind === 'moto' ? GROUP_MOTO_LOOK : GROUP_LOOK;
            const glMotoType = a0.groupLessonKind === 'moto' ? asMotoLessonType(a0.groupLessonMotoType) : null;
            const glStudents = appts.filter((a) => !String(a.id).startsWith('gl-empty:'));
            const glNames = glStudents
              .map((a) => a.student?.firstName || a.student?.lastName || '')
              .filter(Boolean);
            // REG-585: guida di gruppo portata insieme a un collega.
            const withNames = sharedWithNames(
              { instructorId: a0.instructorId ?? null, instructorName: a0.instructor?.name ?? null, coInstructors: unionCoInstructors(appts) },
              myInstructorId,
            );
            return (
              <Pressable
                key={`group-${colIdx}-${groupLessonId ?? a0.id}`}
                onPress={() => { if (groupLessonId) onPressGroupLesson?.(groupLessonId); }}
                style={({ pressed }) => [
                  styles.eventCard,
                  { top, height, left: colX(colIdx) + 2, width: colW - 4, backgroundColor: look.bg, opacity: pressed ? 0.8 : 1, boxShadow: tintShadow(look.glow) },
                ]}
              >
                {look.bar ? <View style={[styles.eventBar, { backgroundColor: look.bar }]} /> : null}
                <View style={[styles.eventInner, { backgroundColor: look.bg }]}>
                {/* Stessa regola dell'esame: niente parole, il tipo sta nel
                    colore e nell'icona. Per i gruppi moto l'icona è già quella
                    di birilli/strada — la pill con la parola veniva tagliata. */}
                <View style={styles.eventHead}>
                  {a0.groupLessonKind === 'moto' ? (
                    <MaterialCommunityIcons
                      name={glMotoType ? MOTO_LESSON_TYPE_ICON[glMotoType] : 'motorbike'}
                      size={12}
                      color={look.text}
                    />
                  ) : (
                    <Ionicons name="people" size={12} color={look.text} />
                  )}
                  <Text style={[styles.eventCount, { color: look.text }]} numberOfLines={1}>
                    {glStudents.length}/{a0.groupLessonCapacity ?? GROUP_CAPACITY}
                  </Text>
                  <View style={{ flex: 1 }} />
                  {withNames.length ? <Ionicons name="link" size={9} color={look.text} /> : null}
                </View>
                {height >= 40 && (
                  <Text style={[styles.eventTime, { color: look.text }]} numberOfLines={1}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}
                  </Text>
                )}
                <EventStudentNames names={glNames} height={height} color={look.text} />
                </View>
              </Pressable>
            );
          }),
        )}

        {/* Instructor blocks — dashed, tinted (Malattia / Bloccato) */}
        {blocksByCol.map((colBlocks, colIdx) =>
          colBlocks.map((block) => {
            const bStart = new Date(block.startsAt);
            const bEnd = new Date(block.endsAt);
            const sm = bStart.getHours() * 60 + bStart.getMinutes();
            const em = bEnd.getHours() * 60 + bEnd.getMinutes();
            const clampedSm = Math.max(sm, FIRST_HOUR * 60);
            const clampedEm = Math.min(em || LAST_HOUR * 60, LAST_HOUR * 60);
            if (clampedEm <= clampedSm) return null;
            const top = ((clampedSm - FIRST_HOUR * 60) / 60) * ROW_H;
            const height = Math.max(((clampedEm - clampedSm) / 60) * ROW_H, 24);
            const bKind = blockKindOf(block.reason);
            const p = BLOCK_PRESENTATION[bKind];
            // REG-639 clay: blocchi neutri e quieti (bianco, tratteggio grigio,
            // testo grigio); la pausa tra guide si legge «Pausa».
            const tint = { bg: '#FFFFFF', border: 'rgba(17,17,17,0.18)', text: '#6A6A6A', icon: p.icon as any };
            const label = blockLabel(block.reason, p.short);
            // La lezione teorica è un evento (non un'assenza): rettangolo PIENO
            // indaco, niente bordo tratteggiato — come le guide/esami in griglia.
            const isTheory = bKind === 'theory';
            return (
              <Pressable
                key={`block-${block.id}`}
                onPress={() => onPressBlock?.(block)}
                disabled={!onPressBlock}
                style={[
                  styles.block,
                  isTheory && styles.blockSolid,
                  { top, height, left: colX(colIdx) + 2, width: colW - 4, backgroundColor: tint.bg, borderColor: isTheory ? tint.bg : tint.border },
                ]}
              >
                {/* Teorica: niente icona (in colonna stretta si sovrappone al titolo) */}
                {/* Spazio utile = altezza − bordo (2×1.5). Sotto 13pt niente scritta
                    (resta il tratteggio), sotto 20pt carattere più piccolo. */}
                {height - 3 >= 13 ? (
                  <Text
                    style={[styles.blockName, height - 3 < 20 && styles.blockNameSm, { color: tint.text }]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                ) : null}
                {height >= 36 && (
                  <Text style={[styles.blockTime, { color: tint.text }]} numberOfLines={1}>
                    {pad(bStart.getHours())}:{pad(bStart.getMinutes())}–{pad(bEnd.getHours())}:{pad(bEnd.getMinutes())}
                  </Text>
                )}
              </Pressable>
            );
          }),
        )}

        {/* Ghost block — the draggable draft of the new lesson */}
        {ghostOn && canBook && (
          <GhostBlock
            colW={colW}
            allowedDur={allowedDur}
            gCol={gCol} gStart={gStart} gDur={gDur} gLive={gLive} gFree={gFree}
            onLift={ghostLift} onStep={ghostStep} onPlace={ghostPlace}
            onDismiss={onGhostDismiss}
          />
        )}

        {/* Now line — only on today's column */}
        {nowLineTop !== null && todayColIdx >= 0 && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: nowLineTop, left: colX(todayColIdx), width: colW, height: 0, zIndex: 10 }}
          >
            <View style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 1.5, backgroundColor: '#111111' }} />
            <View style={{ position: 'absolute', top: -4, left: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#111111' }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Barra «crea» — tipo + giorno e fascia, una CTA (anteprima C-b)     */
/* ------------------------------------------------------------------ */

/**
 * Al posto della tab bar mentre c'è la bozza (anteprima C-b approvata da
 * Tiziano, 05/11/2026; come la barra di prenotazione di Airbnb): a sinistra il
 * tipo scelto «Guida ⌄» (il tocco apre «Cosa vuoi creare?») e sotto giorno e
 * fascia, che seguono la bozza dal vivo; a destra una sola CTA «Continua» che
 * apre il foglio del tipo.
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
  return (
    <Animated.View entering={BAR_IN} exiting={BAR_OUT} style={[styles.bar, { paddingBottom: bottomPad }]} testID="agenda-create-bar">
      <Pressable
        onPress={onChangeKind}
        style={({ pressed }) => [styles.barWhen, pressed && { opacity: 0.55 }]}
        hitSlop={{ top: 10, bottom: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`${CREATE_LABEL[kind]}, ${day} ${range}. Cambia tipo`}
        testID="agenda-create-kind"
      >
        <View style={styles.barKindRow}>
          <Text style={styles.barKind} numberOfLines={1}>{CREATE_LABEL[kind]}</Text>
          <Ionicons name="chevron-down" size={15} color={CLAY.ink} />
        </View>
        <Text style={styles.barDay} numberOfLines={1}>
          {day} · <Text style={styles.barRange}>{range}</Text>
        </Text>
      </Pressable>
      <ClayPressable kind="cta" onPress={onContinue} style={styles.barCta} accessibilityRole="button" testID="agenda-create-continue">
        <Text style={styles.barCtaText}>Continua</Text>
      </ClayPressable>
    </Animated.View>
  );
});

/* ------------------------------------------------------------------ */
/*  Component — horizontal week carousel                               */
/* ------------------------------------------------------------------ */

export default function WeeklyAgendaView({
  appointments,
  instructorBlocks = [],
  holidays = new Set(),
  anchorDate,
  readOnly = false,
  onPressAppointment,
  onPressExam,
  onPressGroupLesson,
  onPressBlock,
  myInstructorId,
  onCreateAt,
  createKinds = ALL_CREATE_KINDS,
  carColor,
  ghostIgnoresEvents = false,
  ghostResetKey = 0,
  allowedDurations,
  onGhostActiveChange,
  onDateChange,
  loading = false,
  studentCompletedMinutes = {},
  weekAvailabilityByDate = {},
  refreshing = false,
  onRefresh,
}: WeeklyAgendaViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  // La tab bar in vetro sta sopra l'agenda: la CTA del blocco fantasma va sopra la barra.
  const barOverlap = useTabBarOverlap();
  // Reclaim the wasted right margin (was -24) so the 6 day columns get a bit
  // more width; keep a small 8px breathing edge.
  const gridWidth = screenWidth - GUTTER_W - 8;
  const colW = (gridWidth - COL_GAP * 5) / 6;

  const today = useMemo(() => new Date(), []);

  // Fixed at mount: the carousel is the source of truth for the visible week.
  const baseMonday = useRef(getMonday(anchorDate ?? new Date())).current;
  const pages = useMemo(
    () => Array.from({ length: WEEK_SPAN * 2 + 1 }, (_, i) => addDays(baseMonday, (i - WEEK_SPAN) * 7)),
    [baseMonday],
  );

  const listRef = useRef<FlatList<Date>>(null);
  const indexRef = useRef(WEEK_SPAN);
  const [visibleMonday, setVisibleMonday] = useState<Date>(baseMonday);
  const [listH, setListH] = useState(0);
  const isCurrentWeek = isSameWeek(visibleMonday, today);

  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  /* ── Ghost draft + bottom CTA ── */
  const [ghostInfo, setGhostInfo] = useState<{ date: Date; startMin: number; durMin: number } | null>(null);
  const [ghostDismissTick, setGhostDismissTick] = useState(0);
  const handleGhostChange = useCallback(
    (info: { date: Date; startMin: number; durMin: number } | null) => setGhostInfo(info),
    [],
  );
  const dismissGhost = useCallback(() => {
    setGhostInfo(null);
    setGhostDismissTick((t) => t + 1);
  }, []);
  const onGhostActiveChangeRef = useRef(onGhostActiveChange);
  onGhostActiveChangeRef.current = onGhostActiveChange;
  useEffect(() => {
    onGhostActiveChangeRef.current?.(ghostInfo != null);
  }, [ghostInfo]);
  // Unmount (e.g. switching to the day view): release the parent's FAB.
  useEffect(() => () => { onGhostActiveChangeRef.current?.(false); }, []);
  // Tipo della bozza: il primo offerto (Guida, se l'istruttore può prenotare);
  // si cambia da «Cosa vuoi creare?» e torna al primo quando la bozza sparisce.
  const firstKind = createKinds[0] ?? 'block';
  const [draftKind, setDraftKind] = useState<AgendaCreateKind>(firstKind);
  useEffect(() => { ghostKindStore.set(draftKind); }, [draftKind]);
  useEffect(() => { if (!ghostInfo) setDraftKind(firstKind); }, [ghostInfo, firstKind]);

  const router = useRouter();
  const openKindSheet = useCallback(() => {
    if (!ghostInfo) return;
    createKindSheetStore.set({
      kinds: createKinds,
      selected: draftKind,
      subtitle: `${ghostDayLabel.get()} · ${ghostRangeLabel.get()}`,
      carColor,
      onPick: setDraftKind,
    });
    router.push('/(tabs)/home/create-kind');
  }, [ghostInfo, createKinds, draftKind, carColor, router]);

  // «Continua»: apre il foglio del tipo con il giorno e la fascia della bozza,
  // che resta sulla griglia (sparisce a creazione riuscita).
  const continueCreate = useCallback(() => {
    if (!ghostInfo || !onCreateAt) return;
    const { date, startMin, durMin } = ghostInfo;
    const wins = weekAvailabilityByDate[toDateKey(date)] ?? [];
    const outsideAvailability = !wins.some((w) => w.startMinutes <= startMin && w.endMinutes >= startMin + durMin);
    Haptics.selectionAsync();
    onCreateAt(draftKind, { date, startMin, durMin, outsideAvailability });
  }, [ghostInfo, onCreateAt, weekAvailabilityByDate, draftKind]);

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

  const settle = useCallback((i: number) => {
    if (i < 0 || i >= pages.length || i === indexRef.current) return;
    indexRef.current = i;
    setVisibleMonday(pages[i]);
    onDateChangeRef.current?.(pages[i]);
    dismissGhost();
  }, [pages, dismissGhost]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  }, [settle, pageWidth]);

  const goToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: WEEK_SPAN, animated: true });
    settle(WEEK_SPAN);
  }, [settle]);

  // Allowed lesson durations (same set as the booking modal). The ghost block
  // can only snap to these; `defaultDur` is the one used when a block is born.
  const allowedDur = useMemo(() => {
    const list = (allowedDurations && allowedDurations.length ? allowedDurations : FALLBACK_DURATIONS)
      .slice()
      .sort((a, b) => a - b);
    return list;
  }, [allowedDurations]);
  const defaultDur = useMemo(() => (allowedDur.includes(60) ? 60 : allowedDur[0]), [allowedDur]);

  const renderItem = useCallback(({ item }: { item: Date }) => (
    <WeekPage
      monday={item}
      pageWidth={pageWidth}
      pageHeight={listH}
      colW={colW}
      today={today}
      appointments={appointments}
      instructorBlocks={instructorBlocks}
      holidays={holidays}
      weekAvailabilityByDate={weekAvailabilityByDate}
      studentCompletedMinutes={studentCompletedMinutes}
      readOnly={readOnly}
      loading={loading}
      onPressAppointment={onPressAppointment}
      onPressExam={onPressExam}
      onPressGroupLesson={onPressGroupLesson}
      onPressBlock={onPressBlock}
      myInstructorId={myInstructorId}
      canBook={!!onCreateAt}
      allowedDur={allowedDur}
      defaultDur={defaultDur}
      onGhostChange={handleGhostChange}
      ghostDismissTick={ghostDismissTick}
      onGhostDismiss={dismissGhost}
      ghostIgnoresEvents={ghostIgnoresEvents}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  ), [pageWidth, listH, colW, today, appointments, instructorBlocks, holidays, weekAvailabilityByDate,
      studentCompletedMinutes, readOnly, loading, onPressAppointment, onPressExam, onPressGroupLesson, onPressBlock,
      myInstructorId, onCreateAt, allowedDur, defaultDur, handleGhostChange, ghostDismissTick, dismissGhost, ghostIgnoresEvents, refreshing, onRefresh]);

  return (
    <View style={styles.container}>
      {/* ── Header (Airbnb-clean): week range + "Oggi"; navigate by swipe ── */}
      <View style={styles.header}>
        <Text style={styles.weekLabel}>{formatWeekLabel(visibleMonday)}</Text>
        {!isCurrentWeek && (
          <Pressable
            onPress={goToday}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.55 }}
            accessibilityRole="button"
          >
            <Text style={styles.todayLink}>Oggi</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setListH(e.nativeEvent.layout.height)}>
        {listH > 0 && (
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(d) => String(d.getTime())}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={WEEK_SPAN}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            onMomentumScrollEnd={onMomentumEnd}
            onScrollToIndexFailed={() => { /* getItemLayout makes this unreachable */ }}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            decelerationRate="fast"
          />
        )}
      </View>

      {/* ── Barra «crea»: tipo, giorno e fascia, «Continua» (C-b) ── */}
      {barActive ? (
        <GhostBar
          bottomPad={barBottomPad}
          onChangeKind={openKindSheet}
          onContinue={continueCreate}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 12,
  },
  weekLabel: { fontSize: 19, fontWeight: '600', color: '#111111', letterSpacing: -0.4 },
  todayLink: { fontSize: 15, fontWeight: '600', color: '#111111' },
  // Nessun padding orizzontale: le colonne della griglia sono assolute (colX =
  // GUTTER_W + i·(colW + COL_GAP)) e ignorano il padding dello scroll; qui
  // spacer GUTTER_W + celle colW/COL_GAP → ogni etichetta è centrata sulla sua colonna.
  dayHeaderRow: { flexDirection: 'row', paddingBottom: 10 },
  dayHeaderCell: { alignItems: 'center' },
  dayLetter: { fontSize: 12.5, fontWeight: '500', color: '#6A6A6A', marginBottom: 4 },
  // Numero e cerchio di oggi nella stessa scatola alta 26: stessa linea di base.
  dayNumber: { fontSize: 15, fontWeight: '600', color: '#111111', height: 26, lineHeight: 26, textAlign: 'center' },
  todayCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#111111', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  todayCircleText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 26 },
  scrollView: { flex: 1 },
  hourLabel: {
    position: 'absolute', top: -7, left: 4, width: GUTTER_W - 8,
    fontSize: 10, fontWeight: '500', color: '#B0B0B0', fontVariant: ['tabular-nums'],
  },
  // REG-639 clay: la disponibilità è una tinta di fondo appena accennata.
  availTint: {
    position: 'absolute',
    backgroundColor: 'rgba(17,17,17,0.028)',
  },
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
  ghostEdge: { position: 'absolute', left: 0, width: GUTTER_W, zIndex: 12, backgroundColor: '#FFFFFF', paddingLeft: 1 },
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
  // Fondo pieno pastello, niente bordo; l'ombra morbida in tinta è inline (`tintShadow`).
  lesson: {
    position: 'absolute',
    borderRadius: 10,
    zIndex: 4,
  },
  // Barretta del colore (REG-639): a filo sinistro, raggio come il blocco.
  eventBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, zIndex: 1 },
  lessonName: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  lessonTime: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  lessonVehicle: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  // Card evento (esame / gruppo). Stile allineato UNO A UNO alla web app
  // (`.agenda-card` in assets/styles/globals.css + `rounded-[8px]` sui blocchi
  // della griglia) e a `examGroupCard` della vista giornaliera:
  //   · NIENTE bordo — sul web e' esplicito, "la separazione e' solo
  //     STRUTTURALE, niente bordo". Qui c'era un bordo da 1.5 saturato: e'
  //     quello che faceva sembrare il blocco un chip ritagliato.
  //   · raggio 8 come i blocchi della griglia web (i 22 della giornaliera
  //     sono di una card larga quanto lo schermo: su 52pt diventa una pillola).
  //   · ombra IN TINTA col tipo (shadowColor inline), 0.22 / 14 / y5 /
  //     elevation 4, gli stessi numeri della giornaliera.
  // NOTA iOS: `overflow: 'hidden'` e ombra sulla STESSA view si escludono —
  // RN lo traduce in `clipsToBounds`, che e' `layer.masksToBounds` e ritaglia
  // via anche l'ombra (disegnata fuori dai bounds). Era questo a rendere i
  // blocchi piatti nonostante i valori giusti. Quindi: guscio con l'ombra,
  // interno che ritaglia il contenuto.
  eventCard: {
    position: 'absolute',
    borderRadius: 10,
    zIndex: 4,
  },
  eventInner: {
    flex: 1,
    borderRadius: 10,
    paddingLeft: 7,
    paddingRight: 5,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  lessonInner: {
    flex: 1,
    borderRadius: 13,
    paddingHorizontal: 5,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  // Blocco in colonna stretta: icona del tipo a sinistra, catena "condivisa"
  // a destra, poi orario e conteggio uno sotto l'altro. Niente parole lunghe:
  // in ~39pt utili si spezzavano a meta'.
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 13 },
  eventCount: { flexShrink: 1, fontSize: 9, fontWeight: '700', opacity: 0.9 },
  eventTime: { fontSize: 11, fontWeight: '600', marginTop: 1, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  eventNames: { marginTop: 3 },
  eventNameLine: { fontSize: 8.5, fontWeight: '500', lineHeight: 11, opacity: 0.9 },
  // Timeless exams — canonical lavender exam card (matches day-detail style).
  timelessWrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  examBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 18,
    // Niente `overflow: 'hidden'` qui: taglierebbe l'ombra clay (§0.3). Si
    // ritaglia un figlio (`examBannerClip`) con la barretta.
    ...CLAY_SHADOW.raise,
  },
  examBannerClip: { ...StyleSheet.absoluteFillObject, borderRadius: 18, overflow: 'hidden' },
  examBannerBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#111111' },
  examBannerLabel: { fontSize: 13, fontWeight: '500', color: '#6A6A6A', textTransform: 'capitalize' },
  examBannerTitle: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.2, marginTop: 2 },
  block: {
    position: 'absolute',
    borderRadius: 13,
    paddingHorizontal: 8,
    // Testo centrato in verticale: nei blocchi bassi (pausa da 5', alti 24pt)
    // il padding verticale tagliava la scritta.
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  // Lezione teorica in griglia: pieno, bordo solido (override del dashed).
  blockSolid: { borderStyle: 'solid', borderWidth: 0, ...CLAY_SHADOW.raiseSm },
  blockName: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
  blockNameSm: { fontSize: 8.5, lineHeight: 11 },
  blockTime: { fontSize: 8.5, fontWeight: '500', marginTop: 2, opacity: 0.85 },
});
