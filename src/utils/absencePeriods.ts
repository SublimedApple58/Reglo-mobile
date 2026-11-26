import type { InstructorBlock } from '../types/regloApi';

/**
 * REG-794: malattie e ferie di un istruttore come PERIODI. Il backend
 * (instructor-sick-leave, instructor-vacation) scrive un blocco per ogni giorno
 * (00:00–23:59 di Roma; il primo dall'orario scelto): qui i blocchi consecutivi
 * con lo stesso motivo tornano un periodo solo, che si elimina tutto insieme.
 */

export type AbsenceKind = 'sick' | 'ferie';

export const ABSENCE_REASON: Record<AbsenceKind, string> = { sick: 'sick_leave', ferie: 'ferie' };

export type AbsencePeriod = {
  key: string;
  instructorId: string;
  kind: AbsenceKind;
  start: Date;
  end: Date;
  blockIds: string[];
};

/** Due blocchi di giorni vicini: 23:59 → 00:00 del giorno dopo (1 minuto). */
const JOIN_GAP_MS = 2 * 3600_000;

const kindOf = (reason: string | null): AbsenceKind | null =>
  reason === ABSENCE_REASON.sick ? 'sick' : reason === ABSENCE_REASON.ferie ? 'ferie' : null;

/** Periodi dal più recente (in cima quelli che verranno). */
export function groupAbsencePeriods(blocks: InstructorBlock[]): AbsencePeriod[] {
  const sorted = blocks
    .filter((b) => kindOf(b.reason))
    .sort((a, b) =>
      a.instructorId.localeCompare(b.instructorId)
      || (a.reason ?? '').localeCompare(b.reason ?? '')
      || +new Date(a.startsAt) - +new Date(b.startsAt));
  const out: AbsencePeriod[] = [];
  for (const b of sorted) {
    const kind = kindOf(b.reason)!;
    const start = new Date(b.startsAt);
    const end = new Date(b.endsAt);
    const last = out[out.length - 1];
    if (last && last.instructorId === b.instructorId && last.kind === kind && +start - +last.end <= JOIN_GAP_MS) {
      if (end > last.end) last.end = end;
      last.blockIds.push(b.id);
    } else {
      out.push({ key: b.id, instructorId: b.instructorId, kind, start, end, blockIds: [b.id] });
    }
  }
  return out.sort((a, b) => +b.start - +a.start);
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const absenceWord = (kind: AbsenceKind) => (kind === 'sick' ? 'Malattia' : 'Ferie');

/** Giorni di calendario toccati dal periodo. */
export const periodDays = (p: AbsencePeriod) =>
  Math.round((+startOfDay(p.end) - +startOfDay(p.start)) / 86400_000) + 1;

/** Il primo giorno parte da un orario (mezza giornata). */
const startTimeOf = (p: AbsencePeriod) =>
  p.start.getHours() || p.start.getMinutes() ? `${pad(p.start.getHours())}:${pad(p.start.getMinutes())}` : null;

/** «22 dic – 6 gen», «10 – 16 ago», «12 nov». */
export function periodRange(p: AbsencePeriod): string {
  const s = p.start;
  const e = p.end;
  if (dayKey(s) === dayKey(e)) return `${s.getDate()} ${MONTHS[s.getMonth()]}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
}

/** Riga del periodo: «Ferie · 22 dic – 6 gen». */
export const periodTitle = (p: AbsencePeriod) => `${absenceWord(p.kind)} · ${periodRange(p)}`;

/** «16 giorni · tutto il giorno», «Dalle 14:00», «3 giorni · dalle 14:00». */
export function periodSubtitle(p: AbsencePeriod): string {
  const days = periodDays(p);
  const from = startTimeOf(p);
  if (days === 1) return from ? `Dalle ${from}` : 'Tutto il giorno';
  return `${days} giorni · ${from ? `dalle ${from}` : 'tutto il giorno'}`;
}

/**
 * La prossima assenza in breve, per la riga «Assenze» di Oggi: quella in corso
 * («In ferie fino al 6 gen», «In malattia oggi») o la prossima («Ferie dal 22 dic»).
 */
export function nextAbsenceText(periods: AbsencePeriod[], now: Date): string | null {
  const current = periods.find((p) => p.start <= now && now < p.end);
  if (current) {
    const word = current.kind === 'sick' ? 'In malattia' : 'In ferie';
    return dayKey(current.end) === dayKey(now)
      ? `${word} oggi`
      : `${word} fino al ${current.end.getDate()} ${MONTHS[current.end.getMonth()]}`;
  }
  const next = periods.filter((p) => p.start > now).sort((a, b) => +a.start - +b.start)[0];
  if (!next) return null;
  return `${absenceWord(next.kind)} dal ${next.start.getDate()} ${MONTHS[next.start.getMonth()]}`;
}
