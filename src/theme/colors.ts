// ─── Color Scales ────────────────────────────────────────────
export const pink = {
  50: '#FDF2F8',
  100: '#FCE7F3',
  200: '#FBCFE8',
  300: '#F9A8D4',
  400: '#F472B6',
  500: '#EC4899',
  600: '#DB2777',
  700: '#BE185D',
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
  primary: '#EC4899',
  accent: '#FACC15',
  destructive: '#EF4444',
  positive: '#22C55E',

  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Surface
  surface: '#FFFFFF',
  background: '#FFFFFF',
  border: '#E5E7EB',

  // Shadow
  shadow: 'rgba(0, 0, 0, 0.08)',

  // Status
  statusScheduledText: '#CA8A04',
  statusScheduledBg: '#FEF9C3',
  statusCompletedText: '#64748B',

  // Pink & Yellow scales (for direct access)
  pink,
  yellow,

  // ─── DEPRECATED (used by GlassTabBar.ios.tsx only) ─────
  navy: '#EC4899', // DEPRECATED → use colors.primary
  glass: '#FFFFFF', // DEPRECATED → use colors.surface
  glassStrong: '#FFFFFF', // DEPRECATED → use colors.surface
  glassBorder: '#E5E7EB', // DEPRECATED → use colors.border
} as const;
