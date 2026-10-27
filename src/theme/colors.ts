// ─── Color Scales ────────────────────────────────────────────
// Brand scale: nero/neutri (REG-638, «via il blu»: era navy #1A1A2E). Stessi
// valori del web (--primary #111111). Niente blu né navy nell'app.
export const ink = {
  50: '#F4F4F4',
  100: '#EBEBEB',
  200: '#D9D9D9',
  300: '#B0B0B0',
  400: '#6A6A6A',
  500: '#111111',
  600: '#0A0A0A',
  700: '#000000',
} as const;

/** @deprecated alias storico di `ink`: i valori ormai sono neutri. */
export const navy = ink;

export const yellow = {
  50: '#FEFCE8',
  100: '#FEF9C3',
  200: '#FEF08A',
  300: '#FDE047',
  400: '#FACC15',
  500: '#EAB308',
  600: '#CA8A04',
  700: '#A16207',
} as const;

// ─── Semantic Tokens ─────────────────────────────────────────
export const colors = {
  // Brand
  primary: '#111111', // nero come il web e Road (era navy #1A1A2E)
  accent: '#FACC15',
  destructive: '#C13515', // rosso mattone Airbnb, allineato al web (era #EF4444)
  positive: '#22C55E',

  // Text — grigi neutri caldi allineati al web (erano slate #1F2937/#6B6B6B/#9C9C9C)
  textPrimary: '#222222',
  textSecondary: '#6A6A6A',
  textMuted: '#929292',

  // Surface
  surface: '#FFFFFF',
  background: '#FDFDFD',
  border: '#DDDDDD', // neutro come il web (era slate #E5E5E5)

  // Shadow
  shadow: 'rgba(0, 0, 0, 0.08)',

  // Status
  statusScheduledText: '#CA8A04',
  statusScheduledBg: '#FEF9C3',
  statusCompletedText: '#6A6A6A',

  // Brand & accent scales (for direct access)
  ink,
  navy,
  yellow,
} as const;
