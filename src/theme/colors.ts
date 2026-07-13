// ─── Color Scales ────────────────────────────────────────────
// Brand scale: dark navy (mono). Replaces the former pink scale 1:1.
export const navy = {
  50: '#F4F5F9',
  100: '#E9EBF2',
  200: '#D6D9E6',
  300: '#AEB4CC',
  400: '#6E7596',
  500: '#1A1A2E',
  600: '#14141F',
  700: '#0D0D16',
} as const;

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
  primary: '#1A1A2E',
  accent: '#FACC15',
  destructive: '#C13515', // rosso mattone Airbnb, allineato al web (era #EF4444)
  positive: '#22C55E',

  // Text — grigi neutri caldi allineati al web (erano slate #1F2937/#6B7280/#9CA3AF)
  textPrimary: '#222222',
  textSecondary: '#6A6A6A',
  textMuted: '#929292',

  // Surface
  surface: '#FFFFFF',
  background: '#FDFDFD',
  border: '#DDDDDD', // neutro come il web (era slate #E5E7EB)

  // Shadow
  shadow: 'rgba(0, 0, 0, 0.08)',

  // Status
  statusScheduledText: '#CA8A04',
  statusScheduledBg: '#FEF9C3',
  statusCompletedText: '#6A6A6A',

  // Brand & accent scales (for direct access)
  navy,
  yellow,
} as const;
