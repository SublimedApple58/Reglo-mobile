import type { AutoscuolaAppointmentWithRelations, AutoscuolaAvailabilitySlot, InstructorBlock } from '../../types/regloApi';
import { lessonInvolvesInstructor } from '../../utils/coInstructors';
import { blockKindOf } from '../../utils/weeklyAgenda';
import type { AvailWindow, SchoolAvailability, SchoolInstructor } from './types';

/**
 * Modello del giorno della scuola (REG-794), puro e senza React: ordine delle
 * colonne, impegni di ogni istruttore nel giorno, disponibilità di tutti.
 * Serve a qualunque vista del giorno (colonne, timeline, elenco).
 */

export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Colonne: prima il titolare-istruttore («Tu»), poi l'ordine scelto sul web
 * («Aspetto», REG-449), poi tutti gli altri in ordine alfabetico — come il
 * comparatore web `agendaInstructorComparator`. Gli istruttori disattivati no.
 */
export function orderInstructors(
  list: Array<{ id: string; name: string; userId?: string | null; status?: string | null }>,
  order: string[] | null | undefined,
  meId: string | null | undefined,
): SchoolInstructor[] {
  const rank = new Map<string, number>();
  (order ?? []).forEach((id, i) => { if (!rank.has(id)) rank.set(id, i); });
  return list
    .filter((i) => (i.status ?? 'active') !== 'inactive')
    .map((i) => ({ id: i.id, name: i.name, userId: i.userId ?? null, isMe: !!meId && i.id === meId }))
    .sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return a.name.localeCompare(b.name, 'it');
    });
}

export type SchoolGroup = { groupLessonId: string | null; appts: AutoscuolaAppointmentWithRelations[] };

/** Gli impegni di un istruttore in un giorno, divisi per tipo. */
export type InstructorDay = {
  guide: AutoscuolaAppointmentWithRelations[];
  /** Esami con orario, una riga per allievo raccolte per fascia. */
  exams: AutoscuolaAppointmentWithRelations[][];
  groups: SchoolGroup[];
  blocks: InstructorBlock[];
  /** Esami senza orario (fascia da definire). */
  timeless: AutoscuolaAppointmentWithRelations[];
  /** Guide del giorno (un gruppo conta una volta; annullate escluse). */
  lessonCount: number;
  /** In malattia o in ferie per tutta la giornata visibile. */
  absence: 'sick' | 'holiday' | null;
};

const EMPTY_DAY: InstructorDay = { guide: [], exams: [], groups: [], blocks: [], timeless: [], lessonCount: 0, absence: null };

export function buildSchoolDay(
  date: Date,
  instructors: SchoolInstructor[],
  appointments: AutoscuolaAppointmentWithRelations[],
  blocks: InstructorBlock[],
): Map<string, InstructorDay> {
  const out = new Map<string, InstructorDay>();
  const ofDay = appointments.filter((a) => sameDay(new Date(a.startsAt), date));
  const blocksOfDay = blocks.filter((b) => sameDay(new Date(b.startsAt), date) || (new Date(b.startsAt) < date && new Date(b.endsAt) > date));
  const slotKey = (a: AutoscuolaAppointmentWithRelations) => `${a.startsAt}|${a.endsAt ?? ''}`;
  for (const ins of instructors) {
    const guide: AutoscuolaAppointmentWithRelations[] = [];
    const timeless: AutoscuolaAppointmentWithRelations[] = [];
    const examMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
    const groupMap = new Map<string, AutoscuolaAppointmentWithRelations[]>();
    for (const a of ofDay) {
      if (!lessonInvolvesInstructor(a, ins.id)) continue;
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
    const groups = Array.from(groupMap.entries()).map(([key, appts]) => ({
      groupLessonId: appts[0].groupLessonId ?? (key.includes('|') ? null : key),
      appts,
    }));
    const own = blocksOfDay.filter((b) => b.instructorId === ins.id);
    const live = guide.filter((a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled').length;
    // Assenza «di giornata»: malattia o ferie che coprono la giornata lavorativa.
    const long = own.find((b) => {
      const k = blockKindOf(b.reason);
      if (k !== 'sick' && k !== 'ferie') return false;
      return (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) >= 6 * 3600_000;
    });
    out.set(ins.id, {
      guide,
      exams: Array.from(examMap.values()),
      groups,
      blocks: own,
      timeless,
      lessonCount: live + groups.length,
      absence: long ? (blockKindOf(long.reason) === 'sick' ? 'sick' : 'holiday') : null,
    });
  }
  return out;
}

export const emptyInstructorDay = () => EMPTY_DAY;

/**
 * Slot da 30' di `availability/slots` (senza ownerId = tutti gli istruttori)
 * → fasce continue per istruttore e giorno.
 * Nota: è il ripiego fino alla rotta dedicata (sotto-task backend di REG-794):
 * non conosce le settimane pubblicate, quindi può differire dalle bande del web.
 */
export function mergeAvailabilitySlots(slots: AutoscuolaAvailabilitySlot[]): SchoolAvailability {
  const raw: Record<string, Record<string, Array<[number, number]>>> = {};
  for (const slot of slots) {
    if (!slot.ownerId) continue;
    const s = new Date(slot.startsAt);
    const e = new Date(slot.endsAt);
    const key = toDateKey(s);
    const sm = s.getHours() * 60 + s.getMinutes();
    const em = sameDay(s, e) ? e.getHours() * 60 + e.getMinutes() : 24 * 60;
    if (em <= sm) continue;
    ((raw[slot.ownerId] ??= {})[key] ??= []).push([sm, em]);
  }
  const out: SchoolAvailability = {};
  for (const [owner, days] of Object.entries(raw)) {
    out[owner] = {};
    for (const [day, list] of Object.entries(days)) {
      list.sort((a, b) => a[0] - b[0]);
      const merged: AvailWindow[] = [];
      for (const [s, e] of list) {
        const last = merged[merged.length - 1];
        if (last && s <= last.endMinutes) last.endMinutes = Math.max(last.endMinutes, e);
        else merged.push({ startMinutes: s, endMinutes: e });
      }
      out[owner][day] = merged;
    }
  }
  return out;
}

/** Lunedì della settimana di `d` (00:00). */
export const mondayOf = (d: Date) => {
  const m = new Date(d);
  const dow = m.getDay();
  m.setDate(m.getDate() + (dow === 0 ? -6 : 1 - dow));
  m.setHours(0, 0, 0, 0);
  return m;
};
