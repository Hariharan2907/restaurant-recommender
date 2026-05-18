export const colors = {
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

  // Brand accent (warm orange)
  accent: '#f97316',
  accentPressed: '#ea580c',

  // Buttons
  primaryBg: '#f97316',
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
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;
