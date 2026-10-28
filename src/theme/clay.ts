import type { BoxShadowValue, ViewStyle } from 'react-native';

/**
 * REG-639 Clay v2 — design system approvato da Tiziano (28/10/2026).
 *
 * Bianco puro e nero; il volume nasce da ombre morbide, bordo di luce e ombra
 * interna, MAI dal colore di fondo (niente crema, niente grigi di superficie).
 * Il colore arriva solo dalle icone 3D (`Icon3D`) e dalle foto.
 *
 * Le ombre sono `boxShadow` nativo (RN 0.81, New Architecture): esterne e
 * `inset` sullo stesso nodo, iOS e Android 9+. Regole: massimo 3 livelli per
 * preset, in una lista l'ombra va sul contenitore e non sulle righe, e
 * l'ombra non si anima mai (si animano solo transform/opacity).
 * Vedi docs/design-system.md §0.
 */

export const CLAY = {
  /** Fondo pagina e superfici: bianco puro. */
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  /** Testo e CTA primaria. */
  ink: '#111111',
  ink2: '#3A3A3C',
  /** Testo secondario (5.4:1 sul bianco). */
  ink3: '#6A6A6A',
  /** Placeholder. */
  ink4: '#8E8E8E',
  hairline: 'rgba(17,17,17,0.07)',
  chevron: '#BDBDBD',
} as const;

const shadow = (
  offsetY: number,
  blurRadius: number,
  spreadDistance: number,
  color: string,
  inset = false,
): BoxShadowValue => ({ offsetX: 0, offsetY, blurRadius, spreadDistance, color, inset });

/** Bordo di luce: 1px appena scuro che stacca il bianco dal bianco. */
const rim = (alpha: number): BoxShadowValue => shadow(0, 0, 1, `rgba(17,17,17,${alpha})`);

/**
 * Preset d'ombra, da stendere nello style (`[s.card, CLAY_SHADOW.raise]`).
 * - `raise`: superficie gonfia (card, liste, tab bar, CTA secondaria).
 * - `raiseSm`: elementi piccoli (bottone icona, cursore, bolla della tab).
 * - `sink`: incavo (ricerca, binario del segmentato) — solo ombra interna.
 * - `ink`: clay nero (CTA primaria, cursore del segmentato, bottone nero).
 * - `inkPressed`: CTA nera premuta (sprofonda).
 * - `avatar`: volume del volto (foto o iniziali).
 */
export const CLAY_SHADOW = {
  raise: {
    boxShadow: [rim(0.045), shadow(10, 24, -10, 'rgba(17,17,17,0.16)'), shadow(-2.5, 4, 0, 'rgba(17,17,17,0.035)', true)],
  },
  raiseSm: {
    boxShadow: [rim(0.05), shadow(6, 14, -6, 'rgba(17,17,17,0.18)'), shadow(-2, 3, 0, 'rgba(17,17,17,0.04)', true)],
  },
  sink: {
    boxShadow: [shadow(0, 0, 1, 'rgba(17,17,17,0.06)', true), shadow(2, 5, 0, 'rgba(17,17,17,0.08)', true)],
  },
  ink: {
    boxShadow: [
      shadow(10, 20, -8, 'rgba(17,17,17,0.45)'),
      shadow(1, 0, 0, 'rgba(255,255,255,0.18)', true),
      shadow(-2, 4, 0, 'rgba(0,0,0,0.4)', true),
    ],
  },
  inkPressed: {
    boxShadow: [shadow(1, 2, 0, 'rgba(17,17,17,0.15)'), shadow(2, 6, 0, 'rgba(0,0,0,0.55)', true)],
  },
  avatar: {
    boxShadow: [rim(0.04), shadow(4, 10, -4, 'rgba(17,17,17,0.22)'), shadow(-2, 4, 0, 'rgba(17,17,17,0.07)', true)],
  },
} satisfies Record<string, ViewStyle>;

/**
 * Volume delle CTA (Tiziano 28/10/2026, anteprima `cta-varianti`): la CTA nera
 * è un cuscino gonfio ma sobrio — sfumatura verticale (luce in alto, scuro in
 * basso), luce interna sul bordo alto, ombra interna in basso, ombra esterna
 * morbida. Via di mezzo tra le varianti A e B, poco più leggera di B.
 * Premuta sprofonda: la sfumatura si inverte e l'ombra diventa tutta interna.
 * La secondaria a riposo resta `raise`; premuta sprofonda come la nera.
 * La sfumatura è `experimental_backgroundImage` (RN 0.81, New Architecture).
 */
export const CLAY_CTA = {
  primary: {
    experimental_backgroundImage: 'linear-gradient(180deg, #353535 0%, #1C1C1C 50%, #0B0B0B 100%)',
    boxShadow: [
      shadow(14, 24, -10, 'rgba(17,17,17,0.48)'),
      shadow(2, 2, 0, 'rgba(255,255,255,0.3)', true),
      shadow(-7, 12, 0, 'rgba(0,0,0,0.6)', true),
    ],
  },
  primaryPressed: {
    experimental_backgroundImage: 'linear-gradient(180deg, #0B0B0B 0%, #151515 60%, #1E1E1E 100%)',
    boxShadow: [shadow(3, 6, -2, 'rgba(17,17,17,0.25)'), shadow(3, 9, 0, 'rgba(0,0,0,0.7)', true)],
  },
  secondaryPressed: {
    experimental_backgroundImage: 'linear-gradient(180deg, #F6F6F6 0%, #FFFFFF 70%)',
    boxShadow: [rim(0.06), shadow(2, 5, -2, 'rgba(17,17,17,0.14)'), shadow(3, 8, 0, 'rgba(17,17,17,0.11)', true)],
  },
} satisfies Record<string, ViewStyle>;
