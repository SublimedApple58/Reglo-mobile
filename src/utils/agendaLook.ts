import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import {
  AGENDA_BLOCK_BAR,
  automaticMarkerColorFor,
  mixWithWhite,
  resolveGuideBlockStyle,
  type AgendaColorConfig,
} from './agendaColors';

/**
 * Aspetto di un evento in agenda (REG-639 clay, notte 28/10) — UN solo punto
 * per vista Giorno e vista Settimana.
 *
 * - `bar`: barretta piena a sinistra (il colore scelto dall'autoscuola).
 * - `wash`: tinta leggerissima dello stesso colore come fondo.
 * - testo sempre nero (`text`), secondario grigio (`sub`).
 * - `ring`: bordo delle guide col cambio automatico (REG-622).
 * - `muted`: annullata / assente → tutto più tenue.
 *
 * Priorità: annullata/assente > esame il giorno dopo (rosso) > criterio
 * colore (durata|patente + eccezioni). Interruttore per tornare al fondo
 * pastello: `AGENDA_BLOCK_BAR` in `agendaColors`.
 */
export type AgendaLook = {
  bar: string | null;
  wash: string;
  text: string;
  sub: string;
  ring: string | null;
  muted: boolean;
};

const INK = '#111111';
const SUB = 'rgba(17,17,17,0.58)';

const MUTED_LOOK: AgendaLook = { bar: '#CFCFCF', wash: '#FFFFFF', text: '#8E8E8E', sub: '#A6A6A6', ring: null, muted: true };
const RED = '#C13515';

export function guideLook(appt: AutoscuolaAppointmentWithRelations, config: AgendaColorConfig): AgendaLook {
  const status = (appt.status ?? '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'no_show') return MUTED_LOOK;
  const durationMin = appt.endsAt
    ? (new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 60000
    : 60;
  const ctx = { durationMin, student: appt.student, vehicle: appt.vehicle };
  if (appt.examNextDay) {
    return { bar: RED, wash: mixWithWhite(RED, 0.9), text: INK, sub: SUB, ring: automaticMarkerColorFor(ctx, config), muted: false };
  }
  const style = resolveGuideBlockStyle(ctx, config);
  const ring = style?.borderColor ?? null;
  if (!style) return { bar: INK, wash: '#FFFFFF', text: INK, sub: SUB, ring, muted: false };
  if (!AGENDA_BLOCK_BAR) return { bar: null, wash: style.backgroundColor, text: INK, sub: SUB, ring, muted: false };
  return { bar: style.barColor ?? INK, wash: style.washColor ?? '#FFFFFF', text: INK, sub: SUB, ring, muted: false };
}

/** Esami: bianco con barretta nera (niente viola). */
export const EXAM_LOOK: AgendaLook = { bar: INK, wash: '#FFFFFF', text: INK, sub: SUB, ring: null, muted: false };
/** Guide di gruppo: verde foglia; gruppi moto: ambra (stessi accenti delle icone §0.4). */
export const GROUP_LOOK: AgendaLook = { bar: '#2FA36B', wash: mixWithWhite('#2FA36B', 0.9), text: INK, sub: SUB, ring: null, muted: false };
export const GROUP_MOTO_LOOK: AgendaLook = { bar: '#F5A524', wash: mixWithWhite('#F5A524', 0.88), text: INK, sub: SUB, ring: null, muted: false };

/** Etichetta dei blocchi istruttore: la pausa tra guide (REG-484) si legge «Pausa». */
export function blockLabel(reason: string | null | undefined, short: string): string {
  return reason === 'lesson_buffer' ? 'Pausa' : short;
}
