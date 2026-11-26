import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';
import { lessonInvolvesInstructor } from '../../utils/coInstructors';
import { blockKindOf } from '../../utils/weeklyAgenda';
import type { AvailWindow, SchoolInstructor } from '../schoolDay/types';

/**
 * «Oggi» del titolare (REG-794, rilascio 2), puro e senza React: cosa succede
 * adesso a scuola, lo stato a parole di ogni istruttore e la sua giornata.
 * Lavora solo sui dati già caricati (bootstrap di oggi, blocchi, disponibilità).
 */

type Appt = AutoscuolaAppointmentWithRelations;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const statusOf = (a: Appt) => (a.status ?? '').trim().toLowerCase();
const endOf = (a: Appt) => (a.endsAt ? new Date(a.endsAt) : new Date(+new Date(a.startsAt) + 60 * 60 * 1000));
const fullName = (a: Appt) => `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim();
export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Un impegno della giornata: una guida, un gruppo (una volta sola) o un esame (una fascia). */
export type TodayItem = {
  key: string;
  kind: 'lesson' | 'group' | 'exam';
  start: Date;
  end: Date;
  /** «Federico Gallo», «Guida di gruppo», «Esame». */
  label: string;
  /** Allievo assente (la guida resta nella giornata, con la sua parola). */
  absent: boolean;
  /** La guida da aprire (per una guida singola). */
  appointment: Appt;
};

export type InstructorToday = {
  instructor: SchoolInstructor;
  items: TodayItem[];
  /** Guide e gruppi (gli esami non contano, come nell'agenda). */
  lessonCount: number;
  current: TodayItem | null;
  next: TodayItem | null;
  absence: 'sick' | 'holiday' | null;
  windows: AvailWindow[];
  /** Lavora oggi: ha impegni o disponibilità, e non è assente. */
  working: boolean;
  /** Stato a parole per la riga: «In guida fino alle 11:00 · Federico Gallo». */
  line: string;
  /** Stato a parole per il foglio: «In guida con Federico Gallo · fino alle 11:00». */
  sheetLine: string;
};

const itemsOf = (instructorId: string, appointments: Appt[], now: Date): TodayItem[] => {
  const out: TodayItem[] = [];
  const groups = new Map<string, Appt[]>();
  const exams = new Map<string, Appt[]>();
  for (const a of appointments) {
    if (!sameDay(new Date(a.startsAt), now) || !lessonInvolvesInstructor(a, instructorId)) continue;
    if (statusOf(a) === 'cancelled') continue;
    if (a.type === 'esame') {
      if (!a.endsAt) continue; // esame senza orario: non occupa la giornata
      const k = `${a.startsAt}|${a.endsAt}`;
      exams.set(k, [...(exams.get(k) ?? []), a]);
    } else if (a.type === 'group_lesson' || a.groupLessonId) {
      const k = a.groupLessonId ?? `${a.startsAt}|${a.endsAt ?? ''}`;
      groups.set(k, [...(groups.get(k) ?? []), a]);
    } else {
      out.push({
        key: a.id,
        kind: 'lesson',
        start: new Date(a.startsAt),
        end: endOf(a),
        label: fullName(a) || 'Guida',
        absent: statusOf(a) === 'no_show',
        appointment: a,
      });
    }
  }
  for (const [k, appts] of groups) {
    out.push({ key: `g:${k}`, kind: 'group', start: new Date(appts[0].startsAt), end: endOf(appts[0]), label: 'Guida di gruppo', absent: false, appointment: appts[0] });
  }
  for (const [k, appts] of exams) {
    out.push({ key: `e:${k}`, kind: 'exam', start: new Date(appts[0].startsAt), end: endOf(appts[0]), label: 'Esame', absent: false, appointment: appts[0] });
  }
  return out.sort((a, b) => +a.start - +b.start);
};

const describe = (
  d: Pick<InstructorToday, 'current' | 'next' | 'absence' | 'items' | 'windows'>,
  now: Date,
): { line: string; sheetLine: string } => {
  if (d.absence === 'sick') return { line: 'In malattia oggi', sheetLine: 'In malattia oggi' };
  if (d.absence === 'holiday') return { line: 'In ferie oggi', sheetLine: 'In ferie oggi' };
  const c = d.current;
  if (c) {
    const until = `fino alle ${hhmm(c.end)}`;
    if (c.kind === 'exam') return { line: `All'esame ${until}`, sheetLine: `All'esame ${until}` };
    if (c.kind === 'group') return { line: `Guida di gruppo ${until}`, sheetLine: `Guida di gruppo ${until}` };
    return { line: `In guida ${until} · ${c.label}`, sheetLine: `In guida con ${c.label} · ${until}` };
  }
  if (d.next) {
    const what = d.next.kind === 'exam' ? "l'esame" : 'la prossima';
    const text = `Libero, ${what} alle ${hhmm(d.next.start)}`;
    return { line: text, sheetLine: text };
  }
  if (d.items.length) return { line: 'Giornata finita', sheetLine: 'Giornata finita' };
  const later = d.windows.find((w) => w.endMinutes > now.getHours() * 60 + now.getMinutes());
  if (later) return { line: 'Disponibile, nessuna guida', sheetLine: 'Disponibile, nessuna guida' };
  return { line: 'Non lavora oggi', sheetLine: 'Non lavora oggi' };
};

/** La giornata di ogni istruttore, nell'ordine delle colonne dell'agenda. */
export function buildInstructorsToday(
  instructors: SchoolInstructor[],
  appointments: Appt[],
  blocks: InstructorBlock[],
  windowsById: Record<string, AvailWindow[] | undefined>,
  now: Date,
): InstructorToday[] {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(+dayStart + 24 * 3600_000);
  return instructors.map((instructor) => {
    const items = itemsOf(instructor.id, appointments, now);
    const long = blocks.find((b) => {
      if (b.instructorId !== instructor.id) return false;
      const k = blockKindOf(b.reason);
      if (k !== 'sick' && k !== 'ferie') return false;
      const s = new Date(b.startsAt);
      const e = new Date(b.endsAt);
      return s < dayEnd && e > dayStart && +e - +s >= 6 * 3600_000;
    });
    const absence: InstructorToday['absence'] = long ? (blockKindOf(long.reason) === 'sick' ? 'sick' : 'holiday') : null;
    const current = items.find((i) => i.start <= now && now < i.end) ?? null;
    const next = items.find((i) => i.start > now) ?? null;
    const windows = windowsById[instructor.id] ?? [];
    const lessonCount = items.filter((i) => i.kind !== 'exam').length;
    const base = { current, next, absence, items, windows };
    return {
      instructor,
      items,
      lessonCount,
      current,
      next,
      absence,
      windows,
      working: !absence && (items.length > 0 || windows.length > 0),
      ...describe(base, now),
    };
  });
}

export type SchoolNow = {
  /** Istruttori in guida, in gruppo o all'esame adesso. */
  busyNow: number;
  working: number;
  totalLessons: number;
  doneLessons: number;
  /** «Giulia è all'esame»: chi è all'esame adesso (primo nome). */
  examNow: string[];
  /** Le prossime guide che partono (al massimo 3). */
  upcoming: Array<{ key: string; instructor: SchoolInstructor; start: Date; label: string }>;
  /** Giornata con guide ma nessuna in corso o in arrivo. */
  allDone: boolean;
};

export function buildSchoolNow(days: InstructorToday[], now: Date): SchoolNow {
  let busyNow = 0;
  let working = 0;
  let totalLessons = 0;
  let doneLessons = 0;
  const examNow: string[] = [];
  const upcoming: SchoolNow['upcoming'] = [];
  let pending = 0;
  for (const d of days) {
    if (d.current) busyNow += 1;
    if (d.working) working += 1;
    if (d.current?.kind === 'exam') examNow.push(firstNameOf(d.instructor.name));
    for (const i of d.items) {
      if (i.kind !== 'exam') {
        totalLessons += 1;
        if (i.end <= now) doneLessons += 1;
      }
      if (i.end > now) pending += 1;
      if (i.start > now && i.kind !== 'exam') upcoming.push({ key: `${d.instructor.id}:${i.key}`, instructor: d.instructor, start: i.start, label: i.label });
    }
  }
  upcoming.sort((a, b) => +a.start - +b.start || a.instructor.name.localeCompare(b.instructor.name, 'it'));
  return {
    busyNow,
    working,
    totalLessons,
    doneLessons,
    examNow,
    upcoming: upcoming.slice(0, 3),
    allDone: totalLessons > 0 && pending === 0,
  };
}

/** «8–13, 14–18:30»: le fasce di oggi in breve. */
export function windowsText(windows: AvailWindow[]): string {
  const t = (m: number) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
  return windows.map((w) => `${t(w.startMinutes)}–${t(w.endMinutes)}`).join(', ');
}
