import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface OptionChip<T extends string | number> {
  label: string;
  value: T;
}

interface OptionChipsProps<T extends string | number> {
  options: Array<OptionChip<T>>;
  selectedValue?: T;
  onChange: (value: T) => void;
  allowDeselect?: boolean;
  onClear?: () => void;
  size?: 'sm' | 'md';
}

export function OptionChips<T extends string | number>({
  options,
  selectedValue,
  onChange,
  allowDeselect = false,
  onClear,
  size = 'md',
}: OptionChipsProps<T>) {
  const [styles] = useThemedStyles(createStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              if (allowDeselect && isSelected) {
                onClear?.();
                return;
              }

              onChange(option.value);
            }}
            style={[
              styles.chip,
              size === 'sm' && styles.chipSm,
              isSelected && styles.chipSelected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                size === 'sm' && styles.chipTextSm,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSm: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    ...TYPOGRAPHY.bodyMedium,
    color: colors.textSecondary,
  },
  chipTextSm: {
    ...TYPOGRAPHY.bodySmall,
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
