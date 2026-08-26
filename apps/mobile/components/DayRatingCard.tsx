import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  AXIS_LABELS,
  RATING_AXES,
  ratingWord,
  type DayRatings,
  type RatingAxis,
} from '../utils/dayRatings';
import {
  BORDER_RADIUS,
  FONT_SIZES,
  SPACING,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const VALUES = [1, 2, 3, 4, 5];

interface DayRatingCardProps {
  ratings: DayRatings;
  /** True when the values are the coach's reading of what was said, not taps. */
  prefilled: boolean;
  disabled: boolean;
  onRate: (axis: RatingAxis, value: number) => void;
  onSend: () => void;
}

/**
 * The 30-second version of a day review: five rows of five dots, one Send.
 *
 * It is an input affordance and not a data path — Send composes one ordinary
 * user message and the coach calls `save_day_review` itself. Nothing is ever
 * pre-selected to a middling 3: an unrated axis has to look unrated.
 */
export function DayRatingCard({
  ratings,
  prefilled,
  disabled,
  onRate,
  onSend,
}: DayRatingCardProps) {
  const [styles] = useThemedStyles(createStyles);
  const hasAnyRating = RATING_AXES.some((axis) => ratings[axis]);

  const renderRow = (axis: RatingAxis) => {
    const value = ratings[axis];
    const word = ratingWord(axis, value);

    return (
      <View key={axis} style={styles.row}>
        <Text style={styles.label}>{AXIS_LABELS[axis]}</Text>
        <View style={styles.dots}>
          {VALUES.map((v) => (
            <Pressable
              key={v}
              style={styles.dotTarget}
              onPress={() => onRate(axis, v)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: value === v }}
              accessibilityLabel={`${AXIS_LABELS[axis]} ${v} of 5`}
            >
              <View style={[styles.dot, value === v && styles.dotSelected]} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.word} numberOfLines={1}>
          {word ?? ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Rate the day</Text>
        <Text style={styles.hint}>
          {prefilled ? 'from what you said — change anything?' : '1 – 5, higher is better'}
        </Text>
      </View>

      {RATING_AXES.filter((axis) => axis !== 'overall').map(renderRow)}
      {/* The verdict is asked separately from the axes and is allowed to
          disagree with them, so it sits below the line. */}
      <View style={styles.divider} />
      {renderRow('overall')}

      <Pressable
        style={({ pressed }) => [
          styles.send,
          (!hasAnyRating || disabled) && styles.sendDisabled,
          pressed && styles.sendPressed,
        ]}
        onPress={onSend}
        disabled={!hasAnyRating || disabled}
        accessibilityRole="button"
        accessibilityLabel="Send ratings"
      >
        <Text style={styles.sendLabel}>Send ratings</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexShrink: 0,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm + 4,
      paddingBottom: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    title: {
      ...TYPOGRAPHY.label,
      fontSize: FONT_SIZES.sm,
      color: colors.text,
    },
    hint: {
      flexShrink: 1,
      fontSize: FONT_SIZES.xs,
      color: colors.textLight,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      gap: SPACING.sm + 4,
    },
    label: {
      width: 84,
      flexShrink: 0,
      ...TYPOGRAPHY.label,
      color: colors.text,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // The dot is 26pt but its target fills the 40pt row, so the tap area is
    // comfortable without the dots drifting apart.
    dotTarget: {
      width: 36,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.hairline,
    },
    dotSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    word: {
      flex: 1,
      textAlign: 'right',
      fontSize: FONT_SIZES.footnote,
      color: colors.text,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: SPACING.xs,
    },
    send: {
      height: TOUCH_TARGET.min,
      marginTop: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: {
      opacity: 0.4,
    },
    sendPressed: {
      opacity: 0.85,
    },
    sendLabel: {
      ...TYPOGRAPHY.label,
      fontSize: FONT_SIZES.md,
      color: colors.white,
    },
  });
