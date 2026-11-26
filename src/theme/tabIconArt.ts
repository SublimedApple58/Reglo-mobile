/**
 * REG-800 — set icone della tab bar, disegnato da noi (approvato da Tiziano
 * il 26/11/2026, anteprime v3). Sorgente UNICA delle icone:
 * - a riposo: tratto 1,8 grigio (`currentColor`, griglia 28 pt, terminali e
 *   giunti tondi, nella grammatica di SF Symbols);
 * - accesa: la stessa sagoma con i suoi colori realistici, piatti (niente 3D,
 *   niente sfumature), pochi colori condivisi tra le icone.
 *
 * Android disegna questi SVG così come sono (`SvgXml` nella `AppTabBar`); iOS
 * usa i PNG @1x/@2x/@3x generati da qui con `npx tsx scripts/build-tab-icons.ts`
 * (le tab native vogliono immagini). Se cambi un disegno, rigenera i PNG.
 *
 * Modulo puro (solo stringhe): lo importa anche lo script dei PNG.
 */

export type TabIconKey =
  | 'oggi'
  | 'agenda'
  | 'road'
  | 'allievi'
  | 'tu'
  | 'home'
  | 'guide'
  | 'scambi'
  | 'quiz'
  | 'notifiche';

export const TAB_ICON_KEYS: TabIconKey[] = ['oggi', 'agenda', 'road', 'allievi', 'tu', 'home', 'guide', 'scambi', 'quiz', 'notifiche'];

/** Lato della tela in punti (viewBox 0 0 28 28). */
export const TAB_ICON_SIZE = 28;

/** Grigio delle voci spente (systemGray di iOS), anche per le etichette. */
export const TAB_ICON_OFF = '#8E8E93';

/* ── Geometria condivisa ── */

const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const RAYS = 'M14 2.8V5.3M14 22.7V25.2M2.8 14H5.3M22.7 14H25.2M6.1 6.1L7.85 7.85M21.9 6.1L20.15 7.85M6.1 21.9L7.85 20.15M21.9 21.9L20.15 20.15';
const CAL_RINGS = 'M9 3.6V7.6M19 3.6V7.6';
const CAL_BODY = 'M8.6 5.8H19.4A4.4 4.4 0 0 1 23.8 10.2V19.6A4.4 4.4 0 0 1 19.4 24H8.6A4.4 4.4 0 0 1 4.2 19.6V10.2A4.4 4.4 0 0 1 8.6 5.8Z';
const CAL_HEAD = 'M8.6 5.8H19.4A4.4 4.4 0 0 1 23.8 10.2V11.4H4.2V10.2A4.4 4.4 0 0 1 8.6 5.8Z';
const CAL_DOTS_ALL = [9.4, 14, 18.6].flatMap((x) => [15.4, 19.6].map((y) => C(x, y, 1.3))).join('');
const PIN = 'M20.5 14.2C17.5 11.3 15.6 9.2 15.6 7.3A4.9 4.9 0 0 1 25.4 7.3C25.4 9.2 23.5 11.3 20.5 14.2Z';
const ROUTE = 'M8.6 21.6H16.6A3.05 3.05 0 0 0 16.6 15.5H10.6A3.05 3.05 0 0 1 10.6 9.4H12.6';
const HEAD1 = C(11, 9.4, 3.7);
const HEAD2 = C(19.8, 10.2, 3.1);
const BODY1 = 'M4.3 22.3C4.3 18.5 7.3 15.9 11 15.9S17.7 18.5 17.7 22.3C17.7 22.9 17.3 23.3 16.7 23.3H5.3C4.7 23.3 4.3 22.9 4.3 22.3Z';
const BODY2 = 'M19 16.2C22.6 15.8 25.2 18.3 25.2 21.6C25.2 22.2 24.8 22.6 24.2 22.6H20.6';
const BODY2_FULL = 'M19.4 16.1C22.8 15.8 25.2 18.3 25.2 21.6C25.2 22.2 24.8 22.6 24.2 22.6H20.4C20.2 19.6 19.4 17.6 18 16.3Z';
const IDCARD = 'M6.6 6.2H21.4A3.4 3.4 0 0 1 24.8 9.6V18.4A3.4 3.4 0 0 1 21.4 21.8H6.6A3.4 3.4 0 0 1 3.2 18.4V9.6A3.4 3.4 0 0 1 6.6 6.2Z';
const ID_HEAD = C(9.7, 11.9, 2.2);
const ID_SHOULDERS = 'M6.3 18C6.9 16.3 8.2 15.3 9.7 15.3S12.5 16.3 13.1 18';
const ID_SHOULDERS_FULL = 'M6.1 18.2C6.6 16.2 8 15 9.7 15S12.8 16.2 13.3 18.2Z';
const ID_LINES = 'M16.4 11.2H21.2M16.4 14.4H21.2M16.4 17.6H19.4';
const HOUSE = 'M5.4 12.3L14 5.1L22.6 12.3V21.5A2 2 0 0 1 20.6 23.5H16.6V18.2A2.6 2.6 0 0 0 11.4 18.2V23.5H7.4A2 2 0 0 1 5.4 21.5Z';
const DOOR = 'M11.4 23.5V18.2A2.6 2.6 0 0 1 16.6 18.2V23.5Z';
const ROOF = 'M3.9 13.1L14 4.7L24.1 13.1';
const WHEEL_SPOKES = 'M3.8 13.4Q8.2 12.6 11.6 14.4M24.2 13.4Q19.8 12.6 16.4 14.4M14 17.7V24.3';
const WHEEL_SPOKES_BOLD = 'M4.4 13.3Q8.2 12.4 11.6 14.2M23.6 13.3Q19.8 12.4 16.4 14.2M14 17.9V23.6';
const TICKET = 'M7 7H21A3.5 3.5 0 0 1 24.5 10.5V11.6A2.4 2.4 0 0 0 24.5 16.4V17.5A3.5 3.5 0 0 1 21 21H7A3.5 3.5 0 0 1 3.5 17.5V16.4A2.4 2.4 0 0 0 3.5 11.6V10.5A3.5 3.5 0 0 1 7 7Z';
const TICKET_ARROWS = 'M9.6 12.1H17.6M15.7 10.2L17.6 12.1L15.7 14M18.4 15.9H10.4M12.3 14L10.4 15.9L12.3 17.8';
const BOOK = 'M14 7.6C11.6 5.9 8.2 5.5 4.6 6.2V21.7C8.2 21.1 11.6 21.5 14 23.1C16.4 21.5 19.8 21.1 23.4 21.7V6.2C19.8 5.5 16.4 5.9 14 7.6Z';
const BOOK_L = 'M12.9 7.1C10.7 5.8 7.8 5.5 4.6 6.2V21.7C7.8 21.1 10.7 21.4 12.9 22.5Z';
const BOOK_R = 'M15.1 7.1C17.3 5.8 20.2 5.5 23.4 6.2V21.7C20.2 21.1 17.3 21.4 15.1 22.5Z';
const BELL = 'M14 4.3C10.5 4.3 8.1 7 8.1 10.6V14.9L5.9 18.4C5.4 19.2 6 20.1 6.9 20.1H21.1C22 20.1 22.6 19.2 22.1 18.4L19.9 14.9V10.6C19.9 7 17.5 4.3 14 4.3Z';
const CLAPPER = 'M11.4 22.7C12 23.7 12.9 24.2 14 24.2S16 23.7 16.6 22.7';

/* ── Pennelli ── */

const stroke = (d: string, color = 'currentColor', w = 1.8) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Pieno con il bordo dello stesso colore: stessa sagoma (e peso) della versione a tratto. */
const solid = (d: string, color: string) =>
  `<path d="${d}" fill="${color}" fill-rule="evenodd" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>`;
const flat = (d: string, color: string) => `<path d="${d}" fill="${color}" fill-rule="evenodd"/>`;
const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">${inner}</svg>`;

/** Colori condivisi dalle icone accese. */
const K = {
  red: '#E5484D',
  sun: '#FFC21A',
  ray: '#FF9F0A',
  gold: '#F5B400',
  goldDark: '#A86F00',
  goldLight: '#FFE08A',
  brick: '#C9966A',
  brickDark: '#7A4E2E',
  ink: '#1C1C1E',
  ink2: '#3A3A3C',
  asphalt: '#48484A',
  grey: '#8E8E93',
  paper: '#FFFFFF',
  paperLine: '#C7C7CC',
  cream: '#FFF6E3',
  bookEdge: '#B8732A',
  bookText: '#D9B98C',
  pink: '#F59BBE',
  pinkDark: '#B8406F',
  skin: '#F2C29B',
  skinDark: '#B9825A',
  orange: '#F28C28',
  green: '#2FA65A',
};

/** A riposo: tratto in `currentColor` (Android lo colora con `color`, i PNG col grigio). */
export const TAB_ICON_OUTLINE: Record<TabIconKey, string> = {
  oggi: svg(stroke(C(14, 14, 5)) + stroke(RAYS)),
  agenda: svg(stroke(CAL_BODY) + stroke('M4.2 11H23.8') + stroke(CAL_RINGS) + flat(CAL_DOTS_ALL, 'currentColor')),
  road: svg(stroke(PIN) + stroke(C(20.5, 7.3, 1.7)) + stroke(C(6.4, 21.6, 2.2)) + stroke(ROUTE)),
  allievi: svg(stroke(HEAD1) + stroke(BODY1) + stroke(HEAD2) + stroke(BODY2)),
  tu: svg(stroke(IDCARD) + stroke(ID_HEAD, 'currentColor', 1.6) + stroke(ID_SHOULDERS, 'currentColor', 1.6) + stroke(ID_LINES, 'currentColor', 1.6)),
  home: svg(stroke(HOUSE)),
  guide: svg(stroke(C(14, 14, 10.4)) + stroke(C(14, 15.2, 2.5)) + stroke(WHEEL_SPOKES)),
  scambi: svg(stroke(TICKET) + stroke(TICKET_ARROWS, 'currentColor', 1.6)),
  quiz: svg(stroke(BOOK) + stroke('M14 7.6V23')),
  notifiche: svg(stroke(BELL) + stroke(CLAPPER)),
};

/** Accesa: colori realistici, piatti. */
export const TAB_ICON_COLOR: Record<TabIconKey, string> = {
  oggi: svg(stroke(RAYS, K.ray, 2.2) + solid(C(14, 14, 5.2), K.sun)),
  agenda: svg(
    `<path d="${CAL_BODY}" fill="${K.paper}" stroke="${K.paperLine}" stroke-width="1.5"/>` +
      solid(CAL_HEAD, K.red) +
      flat([9.4, 18.6].flatMap((x) => [15.6, 19.6].map((y) => C(x, y, 1.3))).join('') + C(14, 19.6, 1.3), K.asphalt) +
      flat(C(14, 15.6, 1.45), K.red) +
      stroke(CAL_RINGS, K.asphalt, 2.1),
  ),
  road: svg(
    stroke(ROUTE, K.asphalt, 2.4) +
      `<path d="${C(6.4, 21.6, 2.2)}" fill="${K.paper}" stroke="${K.asphalt}" stroke-width="1.9"/>` +
      solid(PIN, K.red) +
      flat(C(20.5, 7.3, 1.75), K.paper),
  ),
  allievi: svg(solid(HEAD2, K.skinDark) + solid(BODY2_FULL, K.green) + solid(HEAD1, K.skin) + solid(BODY1, K.orange)),
  tu: svg(solid(IDCARD, K.pink) + flat(ID_HEAD, K.pinkDark) + flat(ID_SHOULDERS_FULL, K.pinkDark) + stroke(ID_LINES, K.pinkDark, 1.8)),
  home: svg(solid(HOUSE, K.brick) + flat(DOOR, K.brickDark) + stroke(ROOF, K.red, 3.2)),
  guide: svg(
    `<path d="${C(14, 14, 9.9)}" fill="none" stroke="${K.ink}" stroke-width="3.2"/>` +
      stroke(WHEEL_SPOKES_BOLD, K.ink2, 3.1) +
      solid(C(14, 15.2, 3), K.ink) +
      flat(C(14, 15.2, 1.1), K.grey),
  ),
  scambi: svg(solid(TICKET, K.red) + stroke(TICKET_ARROWS, K.paper, 1.8)),
  quiz: svg(
    `<path d="${BOOK_L}" fill="${K.cream}" stroke="${K.bookEdge}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="${BOOK_R}" fill="${K.cream}" stroke="${K.bookEdge}" stroke-width="1.5" stroke-linejoin="round"/>` +
      stroke('M7.2 10.4H10.6M7.2 13.3H10.6M7.2 16.2H9.8M17.4 13.3H20.8M17.4 16.2H20', K.bookText, 1.2) +
      flat('M18.6 6.1V11.4L19.9 10.2L21.2 11.4V6.1Z', K.red),
  ),
  notifiche: svg(solid(BELL, K.gold) + stroke(CLAPPER, K.goldDark, 2.2) + stroke('M10.6 9.2C11 7.8 12 6.9 13.2 6.6', K.goldLight, 1.5)),
};
