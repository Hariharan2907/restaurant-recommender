export const colors = {
  black: '#000000',
  white: '#ffffff',
  textOnDark: '#ffffff',
  textOnDarkMuted: 'rgba(255, 255, 255, 0.72)',
  textOnDarkFaint: 'rgba(255, 255, 255, 0.5)',
  hairline: 'rgba(255, 255, 255, 0.18)',
  tabBarBg: 'rgba(0, 0, 0, 0.82)',
  tabActive: '#ffffff',
  tabInactive: 'rgba(255, 255, 255, 0.55)',
  primaryBg: '#000000',
  primaryText: '#ffffff',
  secondaryBorder: '#ffffff',
  secondaryText: '#ffffff',
  devChipOkBg: 'rgba(34, 197, 94, 0.85)',
  devChipErrBg: 'rgba(239, 68, 68, 0.85)',
  devChipLoadingBg: 'rgba(255, 255, 255, 0.18)',
} as const;

export const type = {
  display: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '200' as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '300' as const,
  },
  cta: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
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

export const heroImages = {
  search:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1080&q=80&fit=crop&auto=format',
  history:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1080&q=80&fit=crop&auto=format',
  profile:
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&q=80&fit=crop&auto=format',
} as const;
