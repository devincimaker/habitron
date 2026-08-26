import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { formatChipLabel } from '../utils/dayTrend';
import { FONT_SIZES, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface DayGapChipsProps {
  dates: string[];
  onPress: (date: string) => void;
}

/**
 * The unreviewed days in the window, as targets.
 *
 * The strip cannot be tapped — a column is far under 44pt — and the days worth
 * reaching are exactly the ones with nothing in the list below, so they get
 * their own row of chips rather than a row nobody can find.
 */
export function DayGapChips({ dates, onPress }: DayGapChipsProps) {
  const [styles] = useThemedStyles(createStyles);
  if (dates.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Unreviewed</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {dates.map((date) => (
          <Pressable
            key={date}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onPress(date)}
            accessibilityRole="button"
            accessibilityLabel={`Review ${formatChipLabel(date)}`}
          >
            <View style={styles.ring} />
            <Text style={styles.chipLabel}>{formatChipLabel(date)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    heading: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    rail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingRight: SPACING.md,
    },
    chip: {
      height: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 10,
      paddingRight: SPACING.sm + 4,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    chipPressed: {
      opacity: 0.7,
    },
    ring: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    chipLabel: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '500',
      color: colors.primaryDark,
    },
  });
