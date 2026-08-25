import type {
  AgendaColorCriterion,
  AgendaColorExceptions,
  AgendaColorOverrides,
  AutoscuolaStudent,
  AutoscuolaVehicle,
} from '../types/regloApi';
import { isMotoLicenseCategory } from './license';

/**
 * Colore dei blocchi guida in agenda — porta lato mobile della logica web
 * `reglo/lib/autoscuole/agenda-color-criterion.ts` (pannello "Aspetto").
 *
 * Vale SOLO per le guide individuali normali: esami, gruppi, blocchi istruttore
 * e stati no-show/annullata mantengono sempre il loro colore per tipo/stato.
 * Il criterio ("durata" default | "patente"), gli override per-voce e le
 * eccezioni pre-costruite arrivano dai settings company (`AutoscuolaSettings`,
 * già esposti da `GET /api/autoscuole/settings`). Gli hex, le soglie e l'ordine
 * delle eccezioni sono allineati 1:1 al web per coerenza cross-platform.
 */

export const AGENDA_COLOR_CRITERIA = ['durata', 'patente'] as const;
export const DEFAULT_AGENDA_COLOR_CRITERION: AgendaColorCriterion = 'durata';

export function asAgendaColorCriterion(value: unknown): AgendaColorCriterion {
  return AGENDA_COLOR_CRITERIA.includes(value as AgendaColorCriterion)
    ? (value as AgendaColorCriterion)
    : DEFAULT_AGENDA_COLOR_CRITERION;
}

// ─── Voci colore ──────────────────────────────────────────────────────────────
export type AgendaColorEntry = {
  key: string;
  label: string;
  short: string;
  bgHex: string;
  /** rgba dell'ombra in tinta (come il web). */
  shadowRgba: string;
};

const ENTRY = (
  key: string,
  label: string,
  short: string,
  bgHex: string,
  shadowRgba: string,
): AgendaColorEntry => ({ key, label, short, bgHex, shadowRgba });

/** Bucket del criterio "durata" (default storici dei blocchi). */
export const DURATION_COLOR_ENTRIES: AgendaColorEntry[] = [
  ENTRY('d30', 'Fino a 30 minuti', '30 min', '#E3EEFF', 'rgba(59,130,246,0.22)'),
  ENTRY('d45', '31–45 minuti', '45 min', '#EAF7CE', 'rgba(132,204,22,0.22)'),
  ENTRY('d60', '46–60 minuti', '60 min', '#FCEFC7', 'rgba(245,158,11,0.22)'),
  ENTRY('d90', '61–90 minuti', '90 min', '#F9DDF3', 'rgba(217,70,239,0.22)'),
  ENTRY('d90plus', 'Oltre 90 minuti', '> 90', '#FBD9DD', 'rgba(244,63,94,0.22)'),
];

export const LICENSE_COLOR_ENTRIES: AgendaColorEntry[] = [
  ENTRY('b', 'Patente B', 'B', '#E3EEFF', 'rgba(59,130,246,0.22)'),
  ENTRY('autom', 'Cambio automatico (B autom., …)', 'B autom.', '#CFFAFE', 'rgba(6,182,212,0.22)'),
  ENTRY('be', 'Patente BE', 'BE', '#E6E9FF', 'rgba(99,102,241,0.22)'),
  ENTRY('am', 'Patente AM', 'AM', '#EAF7CE', 'rgba(132,204,22,0.22)'),
  ENTRY('a1', 'Patente A1', 'A1', '#D6F5E3', 'rgba(16,185,129,0.22)'),
  ENTRY('a2', 'Patente A2', 'A2', '#FFE8D1', 'rgba(249,115,22,0.22)'),
  ENTRY('a', 'Patente A', 'A', '#FBD9DD', 'rgba(244,63,94,0.22)'),
  ENTRY('c', 'Patente C / CE', 'C', '#FCEFC7', 'rgba(245,158,11,0.22)'),
  ENTRY('d', 'Patente D / DE', 'D', '#F9DDF3', 'rgba(217,70,239,0.22)'),
  ENTRY('none', 'Patente non impostata', 'Nessuna', '#F3F4F8', 'rgba(100,116,139,0.16)'),
];

const licenseEntryByKey = new Map(LICENSE_COLOR_ENTRIES.map((e) => [e.key, e]));

/** Bucket durata per minuti (stesse soglie storiche del web). */
export function durationColorEntry(minutes: number): AgendaColorEntry {
  if (minutes <= 30) return DURATION_COLOR_ENTRIES[0];
  if (minutes <= 45) return DURATION_COLOR_ENTRIES[1];
  if (minutes <= 60) return DURATION_COLOR_ENTRIES[2];
  if (minutes <= 90) return DURATION_COLOR_ENTRIES[3];
  return DURATION_COLOR_ENTRIES[4];
}

/**
 * Risolve il tag patente ("B", "B autom.", "AM", …) nella voce colore.
 * Il suffisso " autom." vince sulla categoria (nativo del criterio patente).
 */
export function licenseColorEntryForTag(tag: string | null | undefined): AgendaColorEntry {
  const none = licenseEntryByKey.get('none')!;
  if (!tag) return none;
  const t = tag.trim().toUpperCase();
  if (!t) return none;
  if (t.includes('AUTOM')) return licenseEntryByKey.get('autom')!;
  if (t.startsWith('AM')) return licenseEntryByKey.get('am')!;
  if (t.startsWith('A1')) return licenseEntryByKey.get('a1')!;
  if (t.startsWith('A2')) return licenseEntryByKey.get('a2')!;
  if (t.startsWith('A')) return licenseEntryByKey.get('a')!;
  if (t.startsWith('BE')) return licenseEntryByKey.get('be')!;
  if (t.startsWith('B')) return licenseEntryByKey.get('b')!;
  if (t.startsWith('C')) return licenseEntryByKey.get('c')!;
  if (t.startsWith('D')) return licenseEntryByKey.get('d')!;
  return none;
}

/** Costruisce il tag patente della guida dall'allievo (categoria + " autom."). */
export function licenseTagForStudent(student?: AutoscuolaStudent | null): string | null {
  const category = student?.licenseCategory?.trim();
  if (!category) return null;
  return student?.transmission === 'automatic' ? `${category} autom.` : category;
}

// ─── Eccezioni pre-costruite ──────────────────────────────────────────────────
export type AgendaColorException = {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Criteri in cui l'eccezione ha senso (mostrata + applicata solo lì). */
  criteria: AgendaColorCriterion[];
  entry: AgendaColorEntry;
};

export const AGENDA_COLOR_EXCEPTIONS: AgendaColorException[] = [
  {
    key: 'automatic',
    label: 'Cambio automatico in evidenza',
    description:
      'Le guide con veicolo o percorso a cambio automatico sono sempre in ciano invece del colore per durata.',
    defaultEnabled: true,
    criteria: ['durata'],
    entry: ENTRY('automatic', 'Cambio automatico', 'Autom.', '#CFFAFE', 'rgba(6,182,212,0.22)'),
  },
  {
    key: 'exam_ready',
    label: "Pronti per l'esame in evidenza",
    description:
      'Le guide degli allievi segnati “Pronto per l\'esame” si accendono di viola.',
    defaultEnabled: false,
    criteria: ['durata', 'patente'],
    entry: ENTRY('exam_ready', "Pronto per l'esame", 'Esame', '#F0E9FF', 'rgba(139,92,246,0.22)'),
  },
  {
    key: 'moto',
    label: 'Guide moto in evidenza',
    description:
      'Tutte le guide degli allievi con patente moto (AM, A1, A2, A) hanno lo stesso colore arancio, come i gruppi moto.',
    defaultEnabled: false,
    criteria: ['durata', 'patente'],
    entry: ENTRY('moto', 'Guida moto', 'Moto', '#FFEDD5', 'rgba(249,115,22,0.22)'),
  },
];

/** Normalizza il JSON grezzo delle eccezioni: solo chiavi note, default dal registry. */
export function asAgendaColorExceptions(value: unknown): AgendaColorExceptions {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: AgendaColorExceptions = {};
  for (const exc of AGENDA_COLOR_EXCEPTIONS) {
    out[exc.key] = typeof raw[exc.key] === 'boolean' ? (raw[exc.key] as boolean) : exc.defaultEnabled;
  }
  return out;
}

// ─── Overrides del titolare ───────────────────────────────────────────────────
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const OVERRIDE_NAMESPACES = ['durata', 'patente', 'eccezioni'] as const;

const VALID_OVERRIDE_KEYS: Record<(typeof OVERRIDE_NAMESPACES)[number], Set<string>> = {
  durata: new Set(DURATION_COLOR_ENTRIES.map((e) => e.key)),
  patente: new Set(LICENSE_COLOR_ENTRIES.map((e) => e.key)),
  eccezioni: new Set(AGENDA_COLOR_EXCEPTIONS.map((e) => e.key)),
};

/** Normalizza il JSON grezzo dei limits: solo chiavi note + hex validi. */
export function asAgendaColorOverrides(value: unknown): AgendaColorOverrides {
  const out: AgendaColorOverrides = {};
  if (!value || typeof value !== 'object') return out;
  for (const namespace of OVERRIDE_NAMESPACES) {
    const raw = (value as Record<string, unknown>)[namespace];
    if (!raw || typeof raw !== 'object') continue;
    const rec: Record<string, string> = {};
    for (const [key, hex] of Object.entries(raw)) {
      if (VALID_OVERRIDE_KEYS[namespace].has(key) && typeof hex === 'string' && HEX_RE.test(hex)) {
        rec[key] = hex.toUpperCase();
      }
    }
    if (Object.keys(rec).length) out[namespace] = rec;
  }
  return out;
}

// ─── Stile del blocco ─────────────────────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

/**
 * Resa "Airbnb soft" richiesta dal design mobile: tinte sussurrate, pulite, mai
 * sgargianti. Desatura leggermente verso il grigio di pari luminanza, poi
 * schiarisce verso il bianco. Applicata a TUTTE le voci (default + override del
 * titolare) così la palette resta coerente e ariosa. NB: divergenza voluta
 * dall'intensità del web (che è più satura) — vedi docs/features/agenda-block-colors.md.
 */
const DESAT = 0.18;
const LIGHTEN = 0.42;
export function softenTint(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  r += (gray - r) * DESAT; g += (gray - g) * DESAT; b += (gray - b) * DESAT;
  r += (255 - r) * LIGHTEN; g += (255 - g) * LIGHTEN; b += (255 - b) * LIGHTEN;
  return toHex(r, g, b);
}

/** Stile React Native del blocco: background in tinta soft + ombra in tinta. */
export type AgendaBlockStyle = { backgroundColor: string; shadowColor: string };

/**
 * Colore del blocco per una voce (default o override del titolare), reso in
 * tinta "Airbnb soft" (vedi `softenTint`). L'override (hex saturo dal picker
 * web) viene ammorbidito come i default, così la resa resta pulita e leggibile.
 */
export function agendaBlockStyle(
  entry: AgendaColorEntry,
  overrideHex?: string | null,
): AgendaBlockStyle {
  const bg = softenTint(overrideHex || entry.bgHex);
  return { backgroundColor: bg, shadowColor: bg };
}

// ─── Config risolta + risoluzione per-guida ───────────────────────────────────
export type AgendaColorConfig = {
  criterion: AgendaColorCriterion;
  overrides: AgendaColorOverrides;
  exceptions: AgendaColorExceptions;
};

/** Estrae/normalizza la config dai settings company (default sicuri se assenti). */
export function resolveAgendaColorConfig(settings?: {
  agendaColorCriterion?: unknown;
  agendaColorOverrides?: unknown;
  agendaColorExceptions?: unknown;
} | null): AgendaColorConfig {
  return {
    criterion: asAgendaColorCriterion(settings?.agendaColorCriterion),
    overrides: asAgendaColorOverrides(settings?.agendaColorOverrides),
    exceptions: asAgendaColorExceptions(settings?.agendaColorExceptions),
  };
}

export type GuideColorContext = {
  durationMin: number;
  student?: AutoscuolaStudent | null;
  vehicle?: AutoscuolaVehicle | null;
};

const isAutomaticGuide = (ctx: GuideColorContext): boolean =>
  ctx.vehicle?.transmission === 'automatic' || ctx.student?.transmission === 'automatic';

/** Predicati delle eccezioni (mirror dei predicati web in AutoscuoleAgendaPage). */
const EXCEPTION_MATCHERS: Record<string, (ctx: GuideColorContext) => boolean> = {
  automatic: (ctx) => isAutomaticGuide(ctx),
  exam_ready: (ctx) => ctx.student?.examReady === true,
  moto: (ctx) => isMotoLicenseCategory(ctx.student?.licenseCategory),
};

/**
 * Risolve lo stile del blocco per una guida individuale normale. Le eccezioni
 * attive e pertinenti al criterio VINCONO (prima che matcha, ordine registry);
 * altrimenti si applica il criterio (durata|patente). Restituisce `null` per le
 * guide che non vanno colorate col criterio (chiamante: esami/gruppi/blocchi e
 * stati annullata/assente restano col loro colore).
 */
export function resolveGuideBlockStyle(
  ctx: GuideColorContext,
  config: AgendaColorConfig,
): AgendaBlockStyle | null {
  // Eccezioni: prima che matcha vince (solo se attiva e valida per il criterio).
  for (const exc of AGENDA_COLOR_EXCEPTIONS) {
    if (!config.exceptions[exc.key]) continue;
    if (!exc.criteria.includes(config.criterion)) continue;
    if (EXCEPTION_MATCHERS[exc.key]?.(ctx)) {
      return agendaBlockStyle(exc.entry, config.overrides.eccezioni?.[exc.key]);
    }
  }
  // Criterio.
  if (config.criterion === 'patente') {
    const entry = licenseColorEntryForTag(licenseTagForStudent(ctx.student));
    return agendaBlockStyle(entry, config.overrides.patente?.[entry.key]);
  }
  const entry = durationColorEntry(ctx.durationMin);
  return agendaBlockStyle(entry, config.overrides.durata?.[entry.key]);
}

// ─── Editing (pannello "Aspetto agenda" owner) ────────────────────────────────
// Palette curata del picker — stessi 16 swatch del web (`INSTRUCTOR_COLOR_CHOICES`)
// così la scelta resta coerente cross-platform. Nei blocchi vengono poi
// ammorbiditi da `softenTint`.
export type AgendaSwatch = { hex: string; name: string };
export const AGENDA_SWATCHES: AgendaSwatch[] = [
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#0EA5E9', name: 'Azzurro' },
  { hex: '#10B981', name: 'Smeraldo' },
  { hex: '#F59E0B', name: 'Ambra' },
  { hex: '#8B5CF6', name: 'Viola' },
  { hex: '#F43F5E', name: 'Corallo' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#F97316', name: 'Arancio' },
  { hex: '#3B82F6', name: 'Blu' },
  { hex: '#6366F1', name: 'Indaco' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#06B6D4', name: 'Ciano' },
  { hex: '#D946EF', name: 'Fucsia' },
  { hex: '#EF4444', name: 'Rosso' },
  { hex: '#EAB308', name: 'Giallo' },
  { hex: '#64748B', name: 'Grigio' },
];

/** Le voci colore del criterio attivo (bucket durata o palette patenti). */
export function entriesForCriterion(criterion: AgendaColorCriterion): AgendaColorEntry[] {
  return criterion === 'patente' ? LICENSE_COLOR_ENTRIES : DURATION_COLOR_ENTRIES;
}

/** Il namespace override del criterio attivo. */
export function overrideNamespaceForCriterion(
  criterion: AgendaColorCriterion,
): 'durata' | 'patente' {
  return criterion === 'patente' ? 'patente' : 'durata';
}

/** Le eccezioni pertinenti al criterio attivo (mostrate + applicabili solo lì). */
export function exceptionsForCriterion(criterion: AgendaColorCriterion): AgendaColorException[] {
  return AGENDA_COLOR_EXCEPTIONS.filter((e) => e.criteria.includes(criterion));
}

/** Colore di anteprima (soft, come sui blocchi) per una voce + eventuale override. */
export function previewColor(entry: AgendaColorEntry, overrideHex?: string | null): string {
  return agendaBlockStyle(entry, overrideHex).backgroundColor;
}
