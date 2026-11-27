import type { StudentAvailabilityBand, StudentBandKey, StudentBandsByDay } from '../types/regloApi';

/**
 * REG-802 — disponibilità dell'allievo a fasce: testi e conti puri, condivisi
 * da onboarding, Profilo › Disponibilità e dettaglio allievo dello staff.
 * Le fasce vere arrivano dal server (`bands`); queste sono quelle della V1,
 * usate solo finché la risposta non c'è.
 */
export const DEFAULT_BANDS: StudentAvailabilityBand[] = [
  { key: 'morning', label: 'Mattina', startMinutes: 8 * 60, endMinutes: 13 * 60 },
  { key: 'afternoon', label: 'Pomeriggio', startMinutes: 13 * 60, endMinutes: 18 * 60 },
  { key: 'evening', label: 'Sera', startMinutes: 18 * 60, endMinutes: 21 * 60 },
];

export type DayKey = '0' | '1' | '2' | '3' | '4' | '5' | '6';

/** Da lunedì a domenica, come la settimana italiana. */
export const WEEK: Array<{ key: DayKey; full: string; short: string; ab: string }> = [
  { key: '1', full: 'Lunedì', short: 'lun', ab: 'Lun' },
  { key: '2', full: 'Martedì', short: 'mar', ab: 'Mar' },
  { key: '3', full: 'Mercoledì', short: 'mer', ab: 'Mer' },
  { key: '4', full: 'Giovedì', short: 'gio', ab: 'Gio' },
  { key: '5', full: 'Venerdì', short: 'ven', ab: 'Ven' },
  { key: '6', full: 'Sabato', short: 'sab', ab: 'Sab' },
  { key: '0', full: 'Domenica', short: 'dom', ab: 'Dom' },
];

/** Fasce ordinate come `bands` (mattina → sera), senza doppioni. */
export const orderBands = (keys: readonly StudentBandKey[] | undefined, bands: StudentAvailabilityBand[]) =>
  bands.map((b) => b.key).filter((k) => keys?.includes(k));

/** «Sera», «Mattina e pomeriggio», «Tutto il giorno»; null se nessuna. */
export function bandsText(keys: readonly StudentBandKey[] | undefined, bands: StudentAvailabilityBand[]): string | null {
  const ordered = orderBands(keys, bands);
  if (!ordered.length) return null;
  if (ordered.length === bands.length) return 'Tutto il giorno';
  const labels = ordered.map((k) => bands.find((b) => b.key === k)!.label);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1].toLowerCase()}`;
}

/** Intervalli in minuti, fasce adiacenti fuse (mattina + pomeriggio = 8–18). */
export function mergedRanges(keys: readonly StudentBandKey[] | undefined, bands: StudentAvailabilityBand[]) {
  const out: Array<{ startMinutes: number; endMinutes: number; cuts: number[] }> = [];
  for (const band of bands) {
    if (!keys?.includes(band.key)) continue;
    const last = out[out.length - 1];
    if (last && last.endMinutes === band.startMinutes) {
      last.cuts.push(band.startMinutes);
      last.endMinutes = band.endMinutes;
    } else {
      out.push({ startMinutes: band.startMinutes, endMinutes: band.endMinutes, cuts: [] });
    }
  }
  return out;
}

const hour = (m: number) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m / 60}`);

/** «18–21», «8–13, 18–21». */
export const hoursText = (keys: readonly StudentBandKey[] | undefined, bands: StudentAvailabilityBand[]) =>
  mergedRanges(keys, bands)
    .map((r) => `${hour(r.startMinutes)}–${hour(r.endMinutes)}`)
    .join(', ');

/** «8:00 – 13:00» per la riga della fascia. */
export const bandHours = (band: StudentAvailabilityBand) => {
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return `${hm(band.startMinutes)} – ${hm(band.endMinutes)}`;
};

export const activeDays = (days: StudentBandsByDay) => WEEK.filter((d) => (days[d.key]?.length ?? 0) > 0);

/** «4 giorni», oppure l'invito a iniziare. */
export const countText = (days: StudentBandsByDay) => {
  const n = activeDays(days).length;
  return n ? `${n} ${n === 1 ? 'giorno' : 'giorni'}` : 'Tocca un giorno per iniziare';
};

/** Riassunto in una riga: «Lun sera · Mer mattina e pomeriggio · +2». */
export function summaryText(days: StudentBandsByDay, bands: StudentAvailabilityBand[]): string | null {
  const parts = activeDays(days).map((d) => `${d.ab} ${bandsText(days[d.key], bands)!.toLowerCase()}`);
  if (!parts.length) return null;
  return parts.length > 2 ? `${parts.slice(0, 2).join(' · ')} · +${parts.length - 2}` : parts.join(' · ');
}

/** «Lun, mer, ven e sab» per il riepilogo. */
export function daysListText(days: StudentBandsByDay): string | null {
  const list = activeDays(days).map((d, i) => (i === 0 ? d.ab : d.ab.toLowerCase()));
  if (!list.length) return null;
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}

export const hasAnyBand = (days: StudentBandsByDay | null | undefined) =>
  !!days && Object.values(days).some((b) => (b?.length ?? 0) > 0);

/** Tutte le fasce, tutti i giorni. */
export const everyBand = (bands: StudentAvailabilityBand[]): StudentBandsByDay =>
  Object.fromEntries(WEEK.map((d) => [d.key, bands.map((b) => b.key)])) as StudentBandsByDay;

export const isEveryBand = (days: StudentBandsByDay, bands: StudentAvailabilityBand[]) =>
  WEEK.every((d) => (days[d.key]?.length ?? 0) === bands.length);

/** Uguaglianza delle scelte (per «Salva» solo con modifiche). */
export const sameDays = (a: StudentBandsByDay, b: StudentBandsByDay, bands: StudentAvailabilityBand[]) =>
  WEEK.every((d) => orderBands(a[d.key], bands).join() === orderBands(b[d.key], bands).join());
