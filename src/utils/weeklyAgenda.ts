import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

// ─────────────────────────────────────────────────────────────
// Pure data layer for the weekly "control in words" overview.
// Computes, for a single day, the availability windows, booked rows,
// free (bookable) windows and a textual summary — WITHOUT any UI. The
// free-window logic mirrors the daily itinerary in IstruttoreHomeScreen
// (availability − occupied, merged windows, 15-min scrub grid).
// ─────────────────────────────────────────────────────────────

export type AvailWindow = { startMinutes: number; endMinutes: number };
export type Interval = [number, number];

export const MIN_FREE = 30;
const MANDATORY_MINUTES_THRESHOLD = 480; // 8h — matches IstruttoreHomeScreen
const SCRUB_STEP = 15;
const DEFAULT_LESSON_MIN = 60;

// Quick-book is NOT gated by availability: the instructor can book any free time
// of the working day, as long as it doesn't overlap another event (lesson, exam,
// group lesson, block). Bounds mirror the weekly grid (07:00–24:00). Availability
// stays informational (markers / veil), it no longer clips the bookable surface.
export const BOOK_DAY_START = 7 * 60;
export const BOOK_DAY_END = 24 * 60;

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

const sameDay = (date: Date, iso: string) => {
  const t = new Date(iso);
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
};

const startMinutesOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const durationMinutesOf = (a: { startsAt: string; endsAt?: string | null }) =>
  a.endsAt ? Math.max(0, Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000)) : DEFAULT_LESSON_MIN;

export type LessonBadge = { label: string; bg: string; text: string; isExam: boolean };

// Mirrors timelineStatusConfig in IstruttoreHomeScreen (mono-navy palette).
export const lessonBadge = (
  a: AutoscuolaAppointmentWithRelations,
  completedMinutes: Record<string, number> = {},
): LessonBadge => {
  const s = norm(a.status);
  if (a.type === 'esame' && s !== 'cancelled' && s !== 'no_show') {
    return { label: 'Esame', bg: '#EEF2FF', text: '#4338CA', isExam: true };
  }
  if (s === 'pending_review') return { label: 'Da confermare', bg: '#FFF7ED', text: '#EA580C', isExam: false };
  if (s === 'checked_in') return { label: 'In corso', bg: '#EEF0F4', text: '#1A1A2E', isExam: false };
  if (s === 'completed') return { label: 'Completata', bg: '#F0FDF4', text: '#16A34A', isExam: false };
  if (s === 'no_show' || s === 'cancelled') return { label: s === 'no_show' ? 'Assente' : 'Annullata', bg: '#F1F5F9', text: '#64748B', isExam: false };
  const completed = completedMinutes[a.studentId] ?? 0;
  if (completed < MANDATORY_MINUTES_THRESHOLD && durationMinutesOf(a) >= 60) {
    return { label: 'Obbligatoria', bg: '#F0F9FF', text: '#0369A1', isExam: false };
  }
  return { label: 'Programmata', bg: '#FEF9C3', text: '#CA8A04', isExam: false };
};

export type DayLessonRow = {
  appt: AutoscuolaAppointmentWithRelations;
  startMin: number;
  endMin: number;
  durationMin: number;
  badge: LessonBadge;
};
export type DayBlockRow = { block: InstructorBlock; startMin: number; endMin: number; isSick: boolean };
export type DaySegment = { startMin: number; endMin: number; kind: 'booked' | 'exam' | 'block' | 'group' };

// Group lessons (Guide di gruppo): participant appointments (type="group_lesson")
// sharing the same groupLessonId collapse into ONE teal card. Capacity is
// configurable per lesson (3 or 4) — read from the BE row annotation
// `groupLessonCapacity`, with 3 as fallback for stale caches.
export type DayGroupLessonGroup = {
  id: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  count: number;
  capacity: number;
  kind: 'standard' | 'moto'; // moto groups get a dedicated orange tint
  appts: AutoscuolaAppointmentWithRelations[];
};
export const GROUP_LESSON_CAPACITY = 3;
// Exams sharing the same slot (start|end|instructor) collapse into ONE block,
// mirroring the daily timeline's examGroup. Rendered as a single rich card.
export type DayExamGroup = {
  id: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  count: number;
  appts: AutoscuolaAppointmentWithRelations[];
};

export type DayPlan = {
  date: Date;
  isHoliday: boolean;
  hasFullDaySick: boolean;
  availWindows: Interval[];
  availStart: number | null;
  availEnd: number | null;
  lessons: DayLessonRow[];      // non-exam, non-group timed lessons
  examRows: DayLessonRow[];     // timed exams (flat — used for density strip / counts)
  examGroups: DayExamGroup[];   // timed exams grouped by slot — one card per group
  timelessExamCount: number;    // exams with no time yet (rendered as banners elsewhere)
  groupLessonGroups: DayGroupLessonGroup[]; // group lessons — one teal card per lesson
  groupLessonCount: number;     // number of group lessons in the day
  blocks: DayBlockRow[];
  freeWindows: Interval[];
  bookableStarts: number[];
  segments: DaySegment[];       // for the density strip
  lessonCount: number;          // guide (non-exam)
  examCount: number;            // timed + timeless
  freeMinutes: number;
  canBook: boolean;
  isEmptyAvail: boolean;        // no availability configured → "Riposo"
  isFull: boolean;              // availability exists but no bookable free slot
};

type ComputeOpts = {
  now: Date;
  canBook: boolean;
  isHoliday: boolean;
  completedMinutes?: Record<string, number>;
};

const mergeWindows = (raw: Interval[]): Interval[] => {
  const sorted = [...raw].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else out.push([w[0], w[1]]);
  }
  return out;
};

export function computeDayPlan(
  date: Date,
  appointments: AutoscuolaAppointmentWithRelations[],
  blocks: InstructorBlock[],
  availabilitySlots: AvailWindow[],
  opts: ComputeOpts,
): DayPlan {
  const { now, canBook, isHoliday, completedMinutes = {} } = opts;

  const lessons: DayLessonRow[] = [];
  const examRows: DayLessonRow[] = [];
  const groupRows: DayLessonRow[] = [];
  let timelessExamCount = 0;

  for (const a of appointments) {
    if (norm(a.status) === 'cancelled' || !sameDay(date, a.startsAt)) continue;
    const isExam = a.type === 'esame';
    const isGroup = a.type === 'group_lesson';
    if (isExam && !a.endsAt) { timelessExamCount += 1; continue; }
    const startMin = startMinutesOf(a.startsAt);
    const durationMin = durationMinutesOf(a);
    const row: DayLessonRow = { appt: a, startMin, endMin: startMin + durationMin, durationMin, badge: lessonBadge(a, completedMinutes) };
    if (isGroup) groupRows.push(row);
    else if (isExam) examRows.push(row);
    else lessons.push(row);
  }
  lessons.sort((a, b) => a.startMin - b.startMin);
  examRows.sort((a, b) => a.startMin - b.startMin);
  groupRows.sort((a, b) => a.startMin - b.startMin);

  // Group participant rows by their groupLessonId → one card per group lesson.
  const groupMap = new Map<string, DayLessonRow[]>();
  for (const r of groupRows) {
    const key = r.appt.groupLessonId ?? `${r.appt.startsAt}|${r.appt.instructorId ?? ''}`;
    const list = groupMap.get(key) ?? [];
    list.push(r);
    groupMap.set(key, list);
  }
  const groupLessonGroups: DayGroupLessonGroup[] = [...groupMap.entries()]
    .map(([key, rowsG]) => ({
      id: key,
      startMin: rowsG[0].startMin,
      endMin: rowsG[0].endMin,
      durationMin: rowsG[0].durationMin,
      // Synthetic empty-lesson rows (id `gl-empty:`) count as 0 participants.
      count: rowsG.filter((r) => !String(r.appt.id).startsWith('gl-empty:')).length,
      capacity: rowsG[0].appt.groupLessonCapacity ?? GROUP_LESSON_CAPACITY,
      kind: (rowsG[0].appt.groupLessonKind === 'moto' ? 'moto' : 'standard') as 'standard' | 'moto',
      appts: rowsG.map((r) => r.appt),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Group timed exams by slot (start|end|instructor) — same key as the daily
  // timeline — so a multi-student exam renders as ONE block, not duplicates.
  const examGroupMap = new Map<string, DayLessonRow[]>();
  for (const r of examRows) {
    const a = r.appt;
    const key = `${a.startsAt}|${a.endsAt ?? ''}|${a.instructorId ?? ''}`;
    const list = examGroupMap.get(key) ?? [];
    list.push(r);
    examGroupMap.set(key, list);
  }
  const examGroups: DayExamGroup[] = [...examGroupMap.values()]
    .map((rowsG) => ({
      id: `${rowsG[0].appt.startsAt}|${rowsG[0].appt.endsAt ?? ''}|${rowsG[0].appt.instructorId ?? ''}`,
      startMin: rowsG[0].startMin,
      endMin: rowsG[0].endMin,
      durationMin: rowsG[0].durationMin,
      count: rowsG.length,
      appts: rowsG.map((r) => r.appt),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const dayBlocks: DayBlockRow[] = blocks
    .filter((b) => sameDay(date, b.startsAt))
    .map((b) => ({ block: b, startMin: startMinutesOf(b.startsAt), endMin: startMinutesOf(b.endsAt), isSick: b.reason === 'sick_leave' }))
    .sort((a, b) => a.startMin - b.startMin);

  const availWindows = mergeWindows(availabilitySlots.map((s) => [s.startMinutes, s.endMinutes] as Interval));
  const availStart = availWindows.length ? availWindows[0][0] : null;
  const availEnd = availWindows.length ? availWindows[availWindows.length - 1][1] : null;

  // Full-day sick = a sick block covering the whole availability span.
  const hasFullDaySick = availStart != null && availEnd != null &&
    dayBlocks.some((b) => b.isSick && b.startMin <= availStart && b.endMin >= availEnd);

  const occupied: Interval[] = [
    ...lessons.map((r) => [r.startMin, r.endMin] as Interval),
    ...examRows.map((r) => [r.startMin, r.endMin] as Interval),
    ...groupRows.map((r) => [r.startMin, r.endMin] as Interval),
    ...dayBlocks.map((r) => [r.startMin, r.endMin] as Interval),
  ].sort((a, b) => a[0] - b[0]);

  const todayNorm = new Date(now); todayNorm.setHours(0, 0, 0, 0);
  const dateNorm = new Date(date); dateNorm.setHours(0, 0, 0, 0);
  const nowMin = dateNorm.getTime() === todayNorm.getTime() ? now.getHours() * 60 + now.getMinutes() : null;

  // Free (bookable) windows = the whole working day minus occupied — NOT clipped
  // to availability. The instructor can quick-book any open time of the day.
  const freeWindows: Interval[] = [];
  const canShowFree = canBook && !isHoliday && !hasFullDaySick;
  if (canShowFree) {
    let cursor = BOOK_DAY_START;
    for (const [os, oe] of occupied) {
      if (oe <= cursor || os >= BOOK_DAY_END) continue;
      if (os > cursor) freeWindows.push([cursor, Math.min(os, BOOK_DAY_END)]);
      cursor = Math.max(cursor, oe);
      if (cursor >= BOOK_DAY_END) break;
    }
    if (cursor < BOOK_DAY_END) freeWindows.push([cursor, BOOK_DAY_END]);
  }
  const clampedFree = freeWindows
    .map(([s, e]) => [nowMin !== null && s < nowMin ? Math.ceil(nowMin / 15) * 15 : s, e] as Interval)
    .filter(([s, e]) => e - s >= MIN_FREE);

  const bookableStarts: number[] = [];
  for (const [s, e] of clampedFree) {
    for (let m = s; m <= e - SCRUB_STEP; m += SCRUB_STEP) bookableStarts.push(m);
  }

  const segments: DaySegment[] = [
    ...lessons.map((r) => ({ startMin: r.startMin, endMin: r.endMin, kind: 'booked' as const })),
    ...examRows.map((r) => ({ startMin: r.startMin, endMin: r.endMin, kind: 'exam' as const })),
    ...groupRows.map((r) => ({ startMin: r.startMin, endMin: r.endMin, kind: 'group' as const })),
    ...dayBlocks.map((r) => ({ startMin: r.startMin, endMin: r.endMin, kind: 'block' as const })),
  ];

  const freeMinutes = clampedFree.reduce((acc, [s, e]) => acc + (e - s), 0);

  return {
    date,
    isHoliday,
    hasFullDaySick,
    availWindows,
    availStart,
    availEnd,
    lessons,
    examRows,
    examGroups,
    timelessExamCount,
    groupLessonGroups,
    groupLessonCount: groupLessonGroups.length,
    blocks: dayBlocks,
    freeWindows: clampedFree,
    bookableStarts,
    segments,
    lessonCount: lessons.length,
    examCount: examRows.length + timelessExamCount,
    freeMinutes,
    canBook,
    isEmptyAvail: availWindows.length === 0,
    isFull: availWindows.length > 0 && clampedFree.length === 0,
  };
}

// ─── Formatting ───────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
// Compact clock: whole hour → "13", otherwise "13:30".
export const fmtClock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}` : `${h}:${pad(m)}`;
};
export const fmtClockFull = (min: number) => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`;

export const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}` : `${h}h`;
};

// "13–17, 15–18" — used in the per-day word summary. Caps at `max` windows then "+N".
export const fmtFreeWindows = (windows: Interval[], max = 2): string => {
  if (!windows.length) return '';
  const shown = windows.slice(0, max).map(([s, e]) => `${fmtClock(s)}–${fmtClock(e)}`);
  const extra = windows.length - max;
  return shown.join(', ') + (extra > 0 ? ` +${extra}` : '');
};

// One-line plain summary (subtitle for the day sheet / compact rows).
export const daySummary = (plan: DayPlan): string => {
  if (plan.isHoliday) return 'Festivo';
  if (plan.isEmptyAvail) return 'Riposo';
  if (plan.hasFullDaySick) return 'In malattia';
  if (plan.lessonCount === 0 && plan.examCount === 0 && plan.groupLessonCount === 0) return 'Nessuna guida';
  const parts: string[] = [];
  if (plan.examCount > 0) parts.push(`${plan.examCount} ${plan.examCount === 1 ? 'esame' : 'esami'}`);
  if (plan.groupLessonCount > 0) parts.push(`${plan.groupLessonCount} ${plan.groupLessonCount === 1 ? 'gruppo' : 'gruppi'}`);
  if (plan.lessonCount > 0) parts.push(`${plan.lessonCount} ${plan.lessonCount === 1 ? 'guida' : 'guide'}`);
  return parts.join(' · ');
};

export type WeekTotals = { lessons: number; exams: number; freeHours: number };
export const weekTotals = (plans: DayPlan[]): WeekTotals => ({
  lessons: plans.reduce((a, p) => a + p.lessonCount, 0),
  exams: plans.reduce((a, p) => a + p.examCount, 0),
  freeHours: Math.round(plans.reduce((a, p) => a + p.freeMinutes, 0) / 60),
});
