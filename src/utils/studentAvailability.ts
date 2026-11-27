import type {
  StudentAvailabilityBand,
  StudentAvailabilityPayload,
  StudentBandKey,
  StudentRangeRules,
  StudentRangesByDay,
  StudentTimeRange,
} from '../types/regloApi';

/**
 * Disponibilità dell'allievo: testi e conti puri, condivisi da onboarding,
 * Profilo › Disponibilità e dettaglio allievo dello staff.
 *
 * REG-813 — la verità sono gli ORARI in minuti per giorno (`ranges`). Le tre
 * fasce (mattina, pomeriggio, sera) restano come scorciatoia: un giorno «è
 * a fasce» quando i suoi orari coincidono con delle fasce intere, altrimenti è
 * «un orario preciso» e si legge dalle ore («15–17»). Fasce e regole vere
 * arrivano dal server; queste valgono finché la risposta non c'è.
 */
export const DEFAULT_BANDS: StudentAvailabilityBand[] = [
  { key: 'morning', label: 'Mattina', startMinutes: 8 * 60, endMinutes: 13 * 60 },
  { key: 'afternoon', label: 'Pomeriggio', startMinutes: 13 * 60, endMinutes: 18 * 60 },
  { key: 'evening', label: 'Sera', startMinutes: 18 * 60, endMinutes: 21 * 60 },
];

/** «Un orario preciso»: fra le 6 e le 22, passi da 30 minuti, due al giorno. */
export const DEFAULT_RULES: StudentRangeRules = {
  minMinutes: 6 * 60,
  maxMinutes: 22 * 60,
  stepMinutes: 30,
  maxPerDay: 2,
  minDurationMinutes: 60,
};

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

type Ranges = readonly StudentTimeRange[] | undefined;

/** Ordinati e fusi dove si toccano o si sovrappongono. */
export function mergeRanges(ranges: Ranges): StudentTimeRange[] {
  const sorted = (ranges ?? [])
    .filter((r) => r.endMinutes > r.startMinutes)
    .map((r) => ({ startMinutes: r.startMinutes, endMinutes: r.endMinutes }))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const out: StudentTimeRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.startMinutes <= last.endMinutes) last.endMinutes = Math.max(last.endMinutes, r.endMinutes);
    else out.push(r);
  }
  return out;
}

/** Fasce scelte → orari (mattina + pomeriggio = 8–18). */
export const bandRanges = (keys: readonly StudentBandKey[], bands: StudentAvailabilityBand[]) =>
  mergeRanges(bands.filter((b) => keys.includes(b.key)));

/**
 * Le fasce di un giorno quando i suoi orari coincidono con fasce intere
 * (vuoto = nessun orario); null quando è «un orario preciso».
 */
export function bandsOf(ranges: Ranges, bands: StudentAvailabilityBand[]): StudentBandKey[] | null {
  const merged = mergeRanges(ranges);
  if (!merged.length) return [];
  const inside = bands.filter((b) =>
    merged.some((r) => r.startMinutes <= b.startMinutes && r.endMinutes >= b.endMinutes),
  );
  const back = mergeRanges(inside);
  const same =
    back.length === merged.length &&
    back.every((r, i) => r.startMinutes === merged[i].startMinutes && r.endMinutes === merged[i].endMinutes);
  return same ? inside.map((b) => b.key) : null;
}

const hour = (m: number) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m / 60}`);

/** «15:00» */
export const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/** «18–21», «8–13, 18–21», «15–17:30». */
export const hoursText = (ranges: Ranges) =>
  mergeRanges(ranges)
    .map((r) => `${hour(r.startMinutes)}–${hour(r.endMinutes)}`)
    .join(', ');

/** «Sera», «Mattina e pomeriggio», «Tutto il giorno»; null se il giorno non è a fasce intere. */
export function bandsText(ranges: Ranges, bands: StudentAvailabilityBand[]): string | null {
  const keys = bandsOf(ranges, bands);
  if (!keys?.length) return null;
  if (keys.length === bands.length) return 'Tutto il giorno';
  const labels = keys.map((k) => bands.find((b) => b.key === k)!.label);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1].toLowerCase()}`;
}

/** Il giorno in una riga: la fascia se coincide («Pomeriggio»), altrimenti le ore («15–17»); null se libero. */
export const dayText = (ranges: Ranges, bands: StudentAvailabilityBand[]): string | null =>
  mergeRanges(ranges).length ? (bandsText(ranges, bands) ?? hoursText(ranges)) : null;

/** Per lo staff: «Pomeriggio · 13–18», oppure solo «15–17». */
export const dayTextWithHours = (ranges: Ranges, bands: StudentAvailabilityBand[]): string | null => {
  if (!mergeRanges(ranges).length) return null;
  const label = bandsText(ranges, bands);
  return label ? `${label} · ${hoursText(ranges)}` : hoursText(ranges);
};

/** Barre della settimana disegnata; `cuts` = confini fra fasce attaccate (solo nei giorni a fasce). */
export function daySegments(ranges: Ranges, bands: StudentAvailabilityBand[]) {
  const banded = bandsOf(ranges, bands) !== null;
  return mergeRanges(ranges).map((r) => ({
    ...r,
    cuts: banded
      ? bands.map((b) => b.startMinutes).filter((m) => m > r.startMinutes && m < r.endMinutes)
      : [],
  }));
}

/** Scala della settimana disegnata: quella delle fasce (8–21), allargata se un orario preciso esce. */
export function weekScale(days: StudentRangesByDay, bands: StudentAvailabilityBand[]) {
  let from = bands[0]?.startMinutes ?? 8 * 60;
  let to = bands[bands.length - 1]?.endMinutes ?? 21 * 60;
  for (const list of Object.values(days)) {
    for (const r of list ?? []) {
      from = Math.min(from, Math.floor(r.startMinutes / 60) * 60);
      to = Math.max(to, Math.ceil(r.endMinutes / 60) * 60);
    }
  }
  return { from, to };
}

export const activeDays = (days: StudentRangesByDay) => WEEK.filter((d) => (days[d.key]?.length ?? 0) > 0);

/** «4 giorni», oppure l'invito a iniziare. */
export const countText = (days: StudentRangesByDay) => {
  const n = activeDays(days).length;
  return n ? `${n} ${n === 1 ? 'giorno' : 'giorni'}` : 'Tocca un giorno per iniziare';
};

/** Riassunto in una riga: «Lun sera · Mer 15–17 · +2». */
export function summaryText(days: StudentRangesByDay, bands: StudentAvailabilityBand[]): string | null {
  const parts = activeDays(days).map((d) => `${d.ab} ${dayText(days[d.key], bands)!.toLowerCase()}`);
  if (!parts.length) return null;
  return parts.length > 2 ? `${parts.slice(0, 2).join(' · ')} · +${parts.length - 2}` : parts.join(' · ');
}

/** «Lun, mer, ven e sab» per il riepilogo. */
export function daysListText(days: StudentRangesByDay): string | null {
  const list = activeDays(days).map((d, i) => (i === 0 ? d.ab : d.ab.toLowerCase()));
  if (!list.length) return null;
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}

export const hasAnyRange = (days: StudentRangesByDay | null | undefined) =>
  !!days && Object.values(days).some((r) => (r?.length ?? 0) > 0);

/** Lo stesso orario su tutta la settimana («Uguale per tutti i giorni»). */
export const sameForAll = (ranges: Ranges): StudentRangesByDay =>
  Object.fromEntries(WEEK.map((d) => [d.key, mergeRanges(ranges)])) as StudentRangesByDay;

/** Tutte le fasce, tutti i giorni («Va bene qualsiasi orario»). */
export const everyBand = (bands: StudentAvailabilityBand[]): StudentRangesByDay => sameForAll(bands);

const key = (ranges: Ranges) =>
  mergeRanges(ranges)
    .map((r) => `${r.startMinutes}-${r.endMinutes}`)
    .join();

export const isEveryBand = (days: StudentRangesByDay, bands: StudentAvailabilityBand[]) =>
  WEEK.every((d) => key(days[d.key]) === key(bands));

/** Uguaglianza delle scelte (per «Salva» solo con modifiche). */
export const sameDays = (a: StudentRangesByDay, b: StudentRangesByDay) =>
  WEEK.every((d) => key(a[d.key]) === key(b[d.key]));

/** Gli orari di una risposta del server; con un backend prima del REG-813 li ricava dalle fasce. */
export function payloadRanges(
  payload: Pick<StudentAvailabilityPayload, 'bands' | 'days' | 'ranges'> | null | undefined,
): StudentRangesByDay {
  if (!payload) return {};
  if (payload.ranges) return payload.ranges;
  const bands = payload.bands?.length ? payload.bands : DEFAULT_BANDS;
  const out: StudentRangesByDay = {};
  for (const d of WEEK) {
    const ranges = bandRanges(payload.days?.[d.key] ?? [], bands);
    if (ranges.length) out[d.key] = ranges;
  }
  return out;
}

/** «8:00 – 13:00» per la riga della fascia. */
export const bandHours = (band: StudentTimeRange) => `${clock(band.startMinutes)} – ${clock(band.endMinutes)}`;

// ── «Un orario preciso» ────────────────────────────────────────────────────

/** Gli orari che le rotelle offrono (6:00, 6:30 … 22:00). */
export const wheelValues = (rules: StudentRangeRules) => {
  const out: number[] = [];
  for (let m = rules.minMinutes; m <= rules.maxMinutes; m += rules.stepMinutes) out.push(m);
  return out;
};

const snap = (m: number, rules: StudentRangeRules) =>
  Math.min(rules.maxMinutes, Math.max(rules.minMinutes, Math.round(m / rules.stepMinutes) * rules.stepMinutes));

/** Durata minima a passi interi (una guida da 45' → 60'). */
const minLength = (rules: StudentRangeRules) =>
  Math.max(rules.stepMinutes, Math.ceil(rules.minDurationMinutes / rules.stepMinutes) * rules.stepMinutes);

/**
 * Un intervallo dopo che l'allievo ha mosso una rotella: resta dentro i limiti
 * e lungo almeno una guida; l'ALTRA rotella lo segue se serve.
 */
export function moveRange(
  range: StudentTimeRange,
  edge: 'start' | 'end',
  value: number,
  rules: StudentRangeRules,
): StudentTimeRange {
  const len = minLength(rules);
  if (edge === 'start') {
    const startMinutes = Math.min(snap(value, rules), rules.maxMinutes - len);
    return { startMinutes, endMinutes: Math.max(snap(range.endMinutes, rules), startMinutes + len) };
  }
  const endMinutes = Math.max(snap(value, rules), rules.minMinutes + len);
  return { startMinutes: Math.min(snap(range.startMinutes, rules), endMinutes - len), endMinutes };
}

/** Da dove parte «Un orario preciso»: gli orari già scelti, altrimenti 15–17. */
export function preciseSeed(ranges: Ranges, rules: StudentRangeRules): StudentTimeRange[] {
  const current = mergeRanges(ranges).slice(0, rules.maxPerDay);
  if (current.length) return current.map((r) => moveRange(r, 'start', r.startMinutes, rules));
  return [moveRange({ startMinutes: 15 * 60, endMinutes: 17 * 60 }, 'start', 15 * 60, rules)];
}

/** Il secondo orario proposto: due ore, un'ora dopo il primo; prima, se dopo non c'è posto. */
export function secondRange(first: StudentTimeRange, rules: StudentRangeRules): StudentTimeRange {
  const len = Math.max(minLength(rules), 120);
  const after = first.endMinutes + 60;
  if (after + minLength(rules) <= rules.maxMinutes) {
    return { startMinutes: after, endMinutes: Math.min(after + len, rules.maxMinutes) };
  }
  const end = Math.max(first.startMinutes - 60, rules.minMinutes + minLength(rules));
  return { startMinutes: Math.max(end - len, rules.minMinutes), endMinutes: end };
}
