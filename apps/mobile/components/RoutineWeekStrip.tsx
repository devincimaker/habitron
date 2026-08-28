import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HABIT_WEEKDAYS, type HabitWeekday } from '@habits-coach/shared';
import { Caption } from './ui';
import { BORDER_RADIUS, FONT_SIZES, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { formatReminderTime } from '../utils/habitTime';
import { summariseWeekSelection } from '../utils/routineWeek';

const CHIP_SIZE = 40;

interface RoutineWeekStripProps {
  alarmByDay: Partial<Record<HabitWeekday, string>>;
  selected: HabitWeekday[];
  onToggleDay: (weekday: HabitWeekday) => void;
  onPressSummary: () => void;
}

/**
 * Seven day chips and the one row that edits them. Three states, so a glance
 * answers both questions at once: which days ring, and which of them the next
 * time picked will apply to.
 */
export function RoutineWeekStrip({
  alarmByDay,
  selected,
  onToggleDay,
  onPressSummary,
}: RoutineWeekStripProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const summary = summariseWeekSelection(selected, alarmByDay);

  return (
    <View>
      <View style={styles.strip}>
        {HABIT_WEEKDAYS.map((weekday) => {
          const time = alarmByDay[weekday];
          const isSelected = selected.includes(weekday);

          return (
            <Pressable
              key={weekday}
              style={styles.day}
              onPress={() => onToggleDay(weekday)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${weekday}${time ? `, ${formatReminderTime(time)}` : ', no alarm'}`}
            >
              <View
                style={[
                  styles.chip,
                  time ? styles.chipScheduled : null,
                  isSelected ? styles.chipSelected : null,
                ]}
              >
                <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                  {weekday}
                </Text>
              </View>
              <Text style={styles.time} numberOfLines={1}>
                {time ? formatReminderTime(time) : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.summary}
        onPress={onPressSummary}
        disabled={selected.length === 0}
        accessibilityRole="button"
        accessibilityLabel={`${summary.days}, ${summary.time}. Set the time`}
      >
        <Text style={styles.summaryDays}>{summary.days}</Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryTime}>{summary.time}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        </View>
      </Pressable>

      {selected.length === 0 ? (
        <Caption color={colors.textLight}>Pick a day to set its time.</Caption>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xs,
    },
    day: {
      alignItems: 'center',
      gap: 2,
    },
    chip: {
      width: CHIP_SIZE,
      height: CHIP_SIZE,
      borderRadius: BORDER_RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    // Has a time, but is not part of what the next picked time will change.
    chipScheduled: {
      borderColor: colors.primary,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    chipText: {
      fontSize: FONT_SIZES.footnote,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextSelected: {
      color: colors.text,
    },
    time: {
      fontSize: 10,
      color: colors.textLight,
      height: 13,
    },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm,
    },
    summaryDays: {
      fontSize: FONT_SIZES.body,
      color: colors.text,
      flexShrink: 1,
    },
    summaryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    summaryTime: {
      fontSize: FONT_SIZES.body,
      fontWeight: '600',
      color: colors.text,
    },
  });
