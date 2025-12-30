export const COLORS = {
  primary: '#F5A623',
  primaryLight: '#FFD180',
  primaryDark: '#E09000',

  background: '#FFFFFF',
  surface: '#F5F5F5',

  text: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',

  success: '#4CAF50',
  error: '#F44336',
  skipped: '#9E9E9E',

  white: '#FFFFFF',
  black: '#000000',

  border: '#E0E0E0',
  shadow: 'rgba(0, 0, 0, 0.1)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const SHADOWS = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
} as const;
