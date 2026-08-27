import { StyleSheet, type ViewStyle } from 'react-native';
import { BORDER_RADIUS, SHADOWS, SPACING, type Colors } from '../constants/theme';

/** The card chrome the composer steps share; each step spreads it into its own sheet. */
export const createHabitCardStyles = (colors: Colors) =>
  ({
    surfaceCard: {
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: SPACING.xs,
    },
  }) satisfies Record<string, ViewStyle>;
