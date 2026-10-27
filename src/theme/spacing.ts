export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
};

export const radii = {
  sm: 20,
  lg: 35,
} as const;

/**
 * CTA a capsula (Tiziano 27/10): la CTA più tonda già in uso diventa la regola
 * per tutte le CTA primarie e secondarie. Raggio = metà altezza.
 */
export const CTA_HEIGHT = 54;
export const CTA_RADIUS = CTA_HEIGHT / 2;

