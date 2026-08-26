import { Pressable, StyleSheet, Text } from 'react-native';
import { SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface HabitChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

/** The pill the composer uses for weekdays, sections and reminder times. */
export function HabitChip({ label, selected, onPress, onLongPress }: HabitChipProps) {
  const [styles] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    chip: {
      minWidth: 72,
      minHeight: 42,
      borderRadius: 21,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    chipText: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: colors.primaryDark,
      fontWeight: '700',
    },
  });
