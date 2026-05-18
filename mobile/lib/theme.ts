export const colors = {
  // ---- DEPRECATED — removed in Task 14 ----
  // Old names kept so unmigrated files still compile during the migration window.
  // Values point at the new palette so visuals are consistent post-Task 1.
  black: '#0a0a0a',
  white: '#ffffff',
  textOnDark: '#0a0a0a',
  textOnDarkMuted: '#525252',
  textOnDarkFaint: '#a3a3a3',

  // ---- ACTIVE PALETTE ----
  // Surfaces
  bg: '#ffffff',
  surface: '#f5f5f7',
  surfaceAlt: '#fafafa',

  // Text
  text: '#0a0a0a',
  textMuted: '#525252',
  textFaint: '#a3a3a3',

  // Lines
  hairline: '#e5e5e5',

  // Buttons
  primaryBg: '#0a0a0a',
  primaryText: '#ffffff',
  primaryBgDisabled: '#e5e5e5',
  primaryTextDisabled: '#a3a3a3',
  secondaryBorder: '#0a0a0a',
  secondaryText: '#0a0a0a',

  // Status
  error: '#dc2626',

  // Tab bar
  tabBarBg: '#ffffff',
  tabActive: '#0a0a0a',
  tabInactive: '#a3a3a3',

  // Dev-only HealthCheck dots
  devChipOkBg: 'rgba(34, 197, 94, 0.85)',
  devChipErrBg: 'rgba(239, 68, 68, 0.85)',
  devChipLoadingBg: '#e5e5e5',
} as const;

export const type = {
  // Active scale
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  inputLabel: { fontSize: 13, fontWeight: '600' as const },
  input: { fontSize: 17, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  name: { fontSize: 17, fontWeight: '600' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  // ---- DEPRECATED — removed in Task 14 ----
  cta: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;

// ---- DEPRECATED — removed in Task 14 ----
// HeroScreen and the three unmigrated screens still reference this until later tasks.
export const heroImages = {
  search:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1080&q=80&fit=crop&auto=format',
  history:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1080&q=80&fit=crop&auto=format',
  profile:
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&q=80&fit=crop&auto=format',
} as const;
