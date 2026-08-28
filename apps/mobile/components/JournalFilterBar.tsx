import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { JournalMood } from '@habits-coach/shared';
import { JOURNAL_MOODS, JOURNAL_MOOD_STYLES } from '../constants/journal';
import {
  BORDER_RADIUS,
  INPUT_HEIGHTS,
  SPACING,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface JournalFilterBarProps {
  query: string;
  mood: JournalMood | null;
  onQueryChange: (query: string) => void;
  onMoodChange: (mood: JournalMood | null) => void;
  matchCount: number;
}

/**
 * Search and the mood filter, always on screen.
 *
 * The mood chips carry their emoji alone: six 44pt targets fit a 390pt screen
 * only without labels, and a row that scrolls hides the filters people came
 * for. The label lives in `accessibilityLabel`, where it still reads out.
 */
export function JournalFilterBar({
  query,
  mood,
  onQueryChange,
  onMoodChange,
  matchCount,
}: JournalFilterBarProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const isFiltering = Boolean(query.trim()) || mood !== null;

  return (
    <View style={styles.bar}>
      <View style={[styles.field, query ? styles.fieldActive : null]}>
        <Feather name="search" size={18} color={colors.textLight} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search entries"
          placeholderTextColor={colors.textLight}
          returnKeyType="search"
          accessibilityLabel="Search entries"
        />
        {query ? (
          <Pressable
            onPress={() => onQueryChange('')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <Pressable
          style={[styles.allChip, mood === null ? styles.allChipSelected : null]}
          onPress={() => onMoodChange(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: mood === null }}
          accessibilityLabel="All moods"
        >
          <Text style={[styles.allLabel, mood === null ? styles.allLabelSelected : null]}>All</Text>
        </Pressable>

        {JOURNAL_MOODS.map((option) => {
          const isSelected = mood === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.moodChip,
                isSelected
                  ? {
                      backgroundColor: JOURNAL_MOOD_STYLES[option.value].surface,
                      borderColor: colors.primary,
                    }
                  : null,
              ]}
              onPress={() => onMoodChange(isSelected ? null : option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
            >
              <Text style={styles.moodEmoji}>{option.emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {isFiltering ? (
        <Text style={styles.count}>
          {matchCount} {matchCount === 1 ? 'entry' : 'entries'}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      gap: SPACING.xs,
    },
    field: {
      height: INPUT_HEIGHTS.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md - 4,
      borderRadius: BORDER_RADIUS.md + 2,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    fieldActive: {
      borderColor: colors.primary,
    },
    input: {
      flex: 1,
      ...TYPOGRAPHY.bodyMedium,
      color: colors.text,
      padding: 0,
    },
    chipRow: {
      height: TOUCH_TARGET.min,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    allChip: {
      height: TOUCH_TARGET.min,
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    allChipSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    allLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
    },
    allLabelSelected: {
      color: colors.primaryDark,
    },
    moodChip: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET.min / 2,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    moodEmoji: {
      fontSize: 20,
    },
    count: {
      fontSize: 12,
      color: colors.textLight,
      paddingHorizontal: SPACING.xs,
    },
  });
