import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import {
  AGENDA_BLOCK_BAR,
  automaticMarkerColorFor,
  mixWithWhite,
  resolveGuideBlockStyle,
  type AgendaColorConfig,
} from './agendaColors';

/**
 * Aspetto di un evento nella griglia settimanale dell'agenda (REG-639) — UN
 * solo punto per i colori dei blocchi.
 *
 * - `wash`: fondo pieno in tinta pastello (con `AGENDA_BLOCK_BAR` acceso: tinta
 *   leggerissima + `bar`, barretta piena a sinistra — bocciata da Tiziano 29/10).
 * - `glow`: ombra morbida in tinta.
 * - testo sempre nero (`text`), secondario grigio (`sub`).
 * - `ring`: bordo delle guide col cambio automatico (REG-622).
 * - `muted`: annullata / assente → tutto più tenue.
 *
 * Priorità: annullata/assente > esame il giorno dopo (rosso) > criterio
 * colore (durata|patente + eccezioni). Interruttore barretta/fondo pieno:
 * `AGENDA_BLOCK_BAR` in `agendaColors` (oggi spento = fondo pieno pastello).
 */
export type AgendaLook = {
  bar: string | null;
  wash: string;
  text: string;
  sub: string;
  ring: string | null;
  muted: boolean;
  /** Ombra morbida IN TINTA del blocco (rgba). */
  glow: string;
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const INK = '#111111';
const SUB = 'rgba(17,17,17,0.58)';

const MUTED_LOOK: AgendaLook = { bar: '#CFCFCF', wash: '#F3F3F3', text: '#8E8E8E', sub: '#A6A6A6', ring: null, muted: true, glow: 'rgba(17,17,17,0.10)' };
const RED = '#C13515';

export function guideLook(appt: AutoscuolaAppointmentWithRelations, config: AgendaColorConfig): AgendaLook {
  const status = (appt.status ?? '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'no_show') return MUTED_LOOK;
  const durationMin = appt.endsAt
    ? (new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 60000
    : 60;
  const ctx = { durationMin, student: appt.student, vehicle: appt.vehicle };
  if (appt.examNextDay) {
    return { bar: AGENDA_BLOCK_BAR ? RED : null, wash: mixWithWhite(RED, AGENDA_BLOCK_BAR ? 0.9 : 0.8), text: INK, sub: SUB, ring: automaticMarkerColorFor(ctx, config), muted: false, glow: rgba(RED, 0.3) };
  }
  const style = resolveGuideBlockStyle(ctx, config);
  const ring = style?.borderColor ?? null;
  if (!style) return { bar: INK, wash: '#FFFFFF', text: INK, sub: SUB, ring, muted: false, glow: rgba(INK, 0.16) };
  const vivid = style.barColor ?? INK;
  // Colore esattamente da «Aspetto agenda» (anche blu/azzurro: Tiziano 29/10).
  const glow = vivid === INK ? rgba(INK, 0.16) : rgba(vivid, 0.38);
  if (!AGENDA_BLOCK_BAR) return { bar: null, wash: style.backgroundColor, text: INK, sub: SUB, ring, muted: false, glow };
  return { bar: vivid, wash: style.washColor ?? '#FFFFFF', text: INK, sub: SUB, ring, muted: false, glow };
}

/** Esami: bianco con barretta nera (niente viola). */
export const EXAM_LOOK: AgendaLook = { bar: AGENDA_BLOCK_BAR ? INK : null, wash: '#FFFFFF', text: INK, sub: SUB, ring: null, muted: false, glow: rgba(INK, 0.16) };
/** Guide di gruppo: verde foglia; gruppi moto: ambra (stessi accenti delle icone §0.4). */
export const GROUP_LOOK: AgendaLook = { bar: AGENDA_BLOCK_BAR ? '#2FA36B' : null, wash: mixWithWhite('#2FA36B', AGENDA_BLOCK_BAR ? 0.9 : 0.8), text: INK, sub: SUB, ring: null, muted: false, glow: rgba('#2FA36B', 0.34) };
export const GROUP_MOTO_LOOK: AgendaLook = { bar: AGENDA_BLOCK_BAR ? '#F5A524' : null, wash: mixWithWhite('#F5A524', AGENDA_BLOCK_BAR ? 0.88 : 0.78), text: INK, sub: SUB, ring: null, muted: false, glow: rgba('#F5A524', 0.38) };

/** Etichetta dei blocchi istruttore: la pausa tra guide (REG-484) si legge «Pausa». */
export function blockLabel(reason: string | null | undefined, short: string): string {
  return reason === 'lesson_buffer' ? 'Pausa' : short;
}
