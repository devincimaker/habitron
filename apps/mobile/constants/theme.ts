export const COLORS = {
  primary: "#F5A623",
  primaryLight: "#FFD180",
  primaryDark: "#E09000",

  background: "#FFFFFF",
  surface: "#F5F5F5",

  text: "#333333",
  textSecondary: "#666666",
  textLight: "#999999",

  success: "#4CAF50",
  error: "#F44336",
  skipped: "#9E9E9E",

  white: "#FFFFFF",
  black: "#000000",

  border: "#E0E0E0",
  shadow: "rgba(0, 0, 0, 0.1)",
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
  footnote: 13, // iOS Footnote
  sm: 14,
  md: 16,
  body: 17, // iOS Body standard
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

// Typography variants (pre-composed styles)
export const TYPOGRAPHY = {
  displayLarge: { fontSize: 32, fontWeight: "bold" as const, lineHeight: 40 },
  displayMedium: { fontSize: 24, fontWeight: "600" as const, lineHeight: 32 },
  headingLarge: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
  headingMedium: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  bodyLarge: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: "400" as const, lineHeight: 22 },
  bodySmall: { fontSize: 12, fontWeight: "400" as const, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
} as const;

// Avatar sizes
export const AVATAR_SIZES = {
  sm: { size: 32, fontSize: 14, borderRadius: 16 },
  md: { size: 48, fontSize: 18, borderRadius: 24 },
  lg: { size: 80, fontSize: 32, borderRadius: 40 },
} as const;

// Icon button sizes
export const ICON_BUTTON_SIZES = {
  sm: 32,
  md: 40,
  lg: 48,
} as const;

// Category colors (centralized from profile.tsx and MemoryReviewCard.tsx)
export const CATEGORY_COLORS: Record<string, string> = {
  motivation: "#4CAF50",
  obstacle: "#F44336",
  preference: "#2196F3",
  personal: "#9C27B0",
  goal: "#FF9800",
  general: "#607D8B",
};

export const CATEGORY_LABELS: Record<string, string> = {
  motivation: "Motivation",
  obstacle: "Obstacle",
  preference: "Preference",
  personal: "Personal",
  goal: "Goal",
  general: "General",
};

// Touch targets (iOS minimum is 44pt)
export const TOUCH_TARGET = {
  min: 44,
  comfortable: 48,
} as const;

// Input heights
export const INPUT_HEIGHTS = {
  sm: 40,
  md: 44, // iOS minimum touch target
  lg: 48,
  xl: 56,
} as const;

// Screen padding
export const SCREEN_PADDING = {
  horizontal: SPACING.md,
  vertical: SPACING.lg,
} as const;

// List item margins
export const LIST_ITEM = {
  marginHorizontal: SPACING.md,
  marginVertical: SPACING.xs,
} as const;

// Card standard sizes
export const CARD = {
  padding: SPACING.md,
  marginBottom: SPACING.sm,
  borderRadius: BORDER_RADIUS.md,
} as const;

// Status indicator size
export const STATUS_INDICATOR = {
  size: 28,
  borderRadius: 14,
  borderWidth: 2,
} as const;

// Tab bar
export const TAB_BAR = {
  height: 56,
  iconSize: 24,
  labelSize: FONT_SIZES.xs,
} as const;

// Header (iOS navigation bar)
export const HEADER = {
  height: 44, // iOS standard navigation bar content height
  profileButtonSize: 32,
} as const;
