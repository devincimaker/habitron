export const COLORS_LIGHT = {
  primary: "#F5A623",
  primaryLight: "#FFD180",
  primaryDark: "#E09000",

  background: "#FFFFFF",
  surface: "#F5F5F5",

  text: "#333333",
  textStrong: "#1C1C1E", // iOS label — navigation bar titles
  textSecondary: "#666666",
  textLight: "#999999",

  success: "#4CAF50",
  error: "#F44336",
  skipped: "#9E9E9E",
  streak: "#FF6B6B",

  white: "#FFFFFF",
  black: "#000000",

  border: "#E0E0E0",
  hairline: "rgba(60, 60, 67, 0.29)", // iOS separator
  controlFill: "rgba(120, 120, 128, 0.12)", // iOS tertiary system fill
  controlIcon: "#3A3A3C",
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(255, 255, 255, 0.2)",
  backdrop: "rgba(0, 0, 0, 0.5)",
} as const;

export const COLORS_DARK: Colors = {
  primary: "#F5A623",
  primaryLight: "#5C4010",
  primaryDark: "#FFB84D",

  background: "#1C1C1E",
  surface: "#2C2C2E",

  text: "#F5F5F5",
  textStrong: "#F5F5F5",
  textSecondary: "#ADADAD",
  textLight: "#8E8E93",

  success: "#4CAF50",
  error: "#F44336",
  skipped: "#9E9E9E",
  streak: "#FF6B6B",

  white: "#FFFFFF",
  black: "#000000",

  border: "#38383A",
  hairline: "rgba(84, 84, 88, 0.65)",
  controlFill: "rgba(120, 120, 128, 0.24)",
  controlIcon: "#EBEBF0",
  shadow: "rgba(0, 0, 0, 0.3)",
  overlay: "rgba(255, 255, 255, 0.1)",
  backdrop: "rgba(0, 0, 0, 0.7)",
} as const;

export type Colors = { [K in keyof typeof COLORS_LIGHT]: string };

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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000000",
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
  sectionLabel: { fontSize: 15, fontWeight: "600" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
} as const;

// Avatar sizes
export const AVATAR_SIZES = {
  sm: { size: 32, fontSize: 14, borderRadius: 16 },
  md: { size: 48, fontSize: 18, borderRadius: 24 },
  lg: { size: 80, fontSize: 32, borderRadius: 40 },
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
  // Trailing controls share one language: 32pt circles, 12pt apart,
  // 16pt from the screen edge, each expanded to 44pt via hitSlop.
  controlSize: 32,
  controlRadius: 16,
  controlGap: 12,
  controlIconSize: 18,
  edgeMargin: SPACING.md,
  title: {
    fontSize: FONT_SIZES.body, // 17
    fontWeight: "600" as const,
    letterSpacing: -0.43, // SF Pro Text @ 17pt
  },
} as const;

// Grows a 32pt header control to the 44pt minimum touch target
const HEADER_CONTROL_SLOP = (TOUCH_TARGET.min - HEADER.controlSize) / 2;

export const HEADER_CONTROL_HIT_SLOP = {
  top: HEADER_CONTROL_SLOP,
  bottom: HEADER_CONTROL_SLOP,
  left: HEADER_CONTROL_SLOP,
  right: HEADER_CONTROL_SLOP,
} as const;
