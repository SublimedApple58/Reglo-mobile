import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { TONE } from '../components/ledger/LedgerUI';
import { CLAY } from '../theme/clay';
import { isLessonUnpaid } from './lessonPayments';

/**
 * REG-786 — tab «Guide» dell'allievo: cosa è una guida fatta, in arrivo,
 * pagata o da pagare. Regole pure, senza React: le usano la tab e il foglio
 * della guida fatta.
 */

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** Stati di una guida ancora da fare (stesso insieme della home). */
const UPCOMING_STATUSES = new Set(['scheduled', 'confirmed', 'checked_in', 'pending_review']);
/** Guide svolte. */
const DONE_STATUSES = new Set(['completed', 'checked_in']);

export const lessonStatus = (l: { status?: string | null }) => norm(l.status);
export const isExamLesson = (l: { type?: string | null }) => norm(l.type) === 'esame';

const endMs = (l: { startsAt: string; endsAt?: string | null }) =>
  l.endsAt ? new Date(l.endsAt).getTime() : new Date(l.startsAt).getTime() + 3600000;

/** In arrivo: non finita e ancora valida. */
export const isUpcomingLesson = (l: AutoscuolaAppointmentWithRelations, now = Date.now()) =>
  UPCOMING_STATUSES.has(lessonStatus(l)) && endMs(l) > now;

/**
 * Fatte: le svolte, le assenze e le annullate dall'allievo (REG-785). Fuori
 * gli esami (hanno la loro card), le rimozioni dallo storico e gli
 * annullamenti organizzativi della scuola.
 */
export const isPastLesson = (l: AutoscuolaAppointmentWithRelations, now = Date.now()) => {
  if (isExamLesson(l) || l.cancellationKind === 'record_cleanup') return false;
  const s = lessonStatus(l);
  if (s === 'cancelled') return l.cancellationKind === 'manual_cancel';
  if (s === 'no_show') return true;
  return DONE_STATUSES.has(s) && endMs(l) <= now;
};

export const isDoneLesson = (l: { status?: string | null }) => DONE_STATUSES.has(lessonStatus(l));

/**
 * REG-785/786: «Assente» nello stesso rosso dello storico dell'istruttore
 * (`LessonHistoryRow`, che lì dice «Allievo assente» col glifo); qui parla
 * all'allievo, e le annullate restano nella sua lista in grigio.
 */
export const LESSON_STATUS_LINE: Record<string, { label: string; color: string }> = {
  no_show: { label: 'Assente', color: TONE.red.ink },
  cancelled: { label: 'Annullata', color: CLAY.ink3 },
};

export type LessonPayment = 'paid' | 'due' | null;

/**
 * Pagamento della guida per l'allievo. «Da pagare» è la stessa regola del
 * blocco per debito (`isLessonUnpaid`, gemella del backend); «Pagata» solo per
 * le guide coperte da credito o segnate pagate. Le altre (annullate senza
 * penale, assenze non addebitate, posti di gruppo pagati fuori) non dicono niente.
 */
export const lessonPayment = (l: AutoscuolaAppointmentWithRelations, manualMode: boolean): LessonPayment => {
  if (isLessonUnpaid(l, manualMode)) return 'due';
  // «Pagata» solo se c'è una prova (credito o segnata pagata): mai a occhio.
  return l.creditApplied || l.manualPaymentStatus === 'paid' ? 'paid' : null;
};

/** Riga sotto «Pagata»: con un credito o in segreteria. */
export const paidHow = (l: AutoscuolaAppointmentWithRelations) =>
  l.creditApplied ? 'Con 1 guida di credito' : l.manualPaymentStatus === 'paid' ? 'Saldata in segreteria' : 'Saldata';

export const lessonMinutes = (l: { startsAt: string; endsAt?: string | null }) =>
  l.endsAt ? Math.max(0, Math.round((new Date(l.endsAt).getTime() - new Date(l.startsAt).getTime()) / 60000)) : null;

/** «1 ora», «1 ora e 30», «2 ore», «45 min». */
export const durationWords = (minutes: number | null) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? '1 ora' : `${h} ore`;
  return m ? `${hours} e ${m}` : hours;
};

/** Ore al volante del riepilogo: «9 ore e 30», «1 ora», «45 minuti». */
export const drivingTimeWords = (minutes: number) => {
  if (minutes < 60) return `${minutes} minuti`;
  return durationWords(minutes) as string;
};

const TYPE_LABELS: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
};

/** Tipo della guida in una parola: «Urbano», «Guida di gruppo», «Guida». */
export const lessonTypeWord = (l: AutoscuolaAppointmentWithRelations) => {
  if (l.groupLessonId || norm(l.type) === 'group_lesson') return 'Guida di gruppo';
  const first = (l.types?.length ? l.types : l.type ? [l.type] : []).map(norm).find((t) => TYPE_LABELS[t]);
  return first ? TYPE_LABELS[first] : 'Guida';
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Giovedì 20 novembre». */
export const longDay = (iso: string) =>
  cap(new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
/** «Giovedì». */
export const weekdayWord = (iso: string) => cap(new Date(iso).toLocaleDateString('it-IT', { weekday: 'long' }));
/** «nov». */
export const monthShort = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
/** «novembre». */
export const monthLong = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { month: 'long' });

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** «15:00 – 16:00», «9:00 – 10:00» (senza zero davanti, come le anteprime). */
export const timeRangeWords = (l: { startsAt: string; endsAt?: string | null }) =>
  `${hm(l.startsAt)}${l.endsAt ? ` – ${hm(l.endsAt)}` : ''}`;

/** Voto della singola voce in parole (niente stelle nel dettaglio dell'allievo). */
export const scoreWord = (score: number, scaleMax: number) => {
  const r = scaleMax > 0 ? score / scaleMax : 0;
  if (r >= 0.75) return 'Bene';
  if (r >= 0.5) return 'Da rifinire';
  return 'Da rivedere';
};

/**
 * REG-789 — perché una guida in programma NON si può lasciare a un compagno
 * (null = si può). Le stesse regole di `createSwapOffer` sul server
 * (`autoscuole-swap.actions.ts`): niente posti di gruppo, esami, guide con
 * auto al seguito; solo guide programmate/confermate; fino a un'ora prima;
 * una richiesta aperta per guida.
 */
export const swapBlockReason = (
  l: AutoscuolaAppointmentWithRelations,
  hasOpenRequest: boolean,
  now = Date.now(),
): string | null => {
  if (hasOpenRequest) return 'Già lasciata, in attesa di un compagno';
  if (l.groupLessonId || norm(l.type) === 'group_lesson') return 'Guida di gruppo: non si può lasciare';
  if (isExamLesson(l)) return 'Esame: non si può lasciare';
  if ((l as { followVehicleId?: string | null }).followVehicleId || l.followVehicle) return "Con l'auto al seguito: non si può lasciare";
  if (!['scheduled', 'confirmed'].includes(lessonStatus(l))) return 'Non si può lasciare';
  if (new Date(l.startsAt).getTime() - now < 3600000) return "Manca meno di un'ora";
  return null;
};
