import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TaskRepeatFrequency, TaskRepeatRule } from '@habits-coach/shared';
import { DatePickerModal, formatPickerDate } from './DatePickerModal';
import { OptionChips } from './OptionChips';
import { PickerDialog } from './PickerDialog';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { formatSheetDate } from '../utils/dateUtils';
import { describeTaskRepeat, getWeekday, nextRepeatDate } from '../utils/todoRepeat';

interface TaskRepeatPickerModalProps {
  visible: boolean;
  /** The rule on the task, if it already repeats. */
  rule?: TaskRepeatRule;
  /** The task's date: the default weekday, and where the series starts. */
  anchorDate: string;
  onCancel: () => void;
  onDone: (rule: TaskRepeatRule) => void;
  /** Present when the task repeats: stops the series here. */
  onClear?: () => void;
}

const FREQUENCIES: Array<{ label: string; value: TaskRepeatFrequency }> = [
  { label: 'Every week', value: 'weekly' },
  { label: 'Every 2 weeks', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** How a task repeats: the cadence, the days, and when it ends. */
export function TaskRepeatPickerModal({
  visible,
  rule,
  anchorDate,
  onCancel,
  onDone,
  onClear,
}: TaskRepeatPickerModalProps) {
  const [styles] = useThemedStyles(createStyles);
  const [frequency, setFrequency] = useState<TaskRepeatFrequency>('weekly');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<string | undefined>();
  const [isPickingEnd, setIsPickingEnd] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFrequency(rule?.frequency ?? 'weekly');
    setWeekdays(rule?.weekdays.length ? rule.weekdays : [getWeekday(anchorDate)]);
    setEndDate(rule?.endDate);
    setIsPickingEnd(false);
  }, [anchorDate, rule, visible]);

  const draft: TaskRepeatRule = {
    frequency,
    weekdays: frequency === 'monthly' ? [] : weekdays,
    ...(endDate ? { endDate } : {}),
  };
  const needsDays = frequency !== 'monthly' && weekdays.length === 0;
  const startDate = needsDays ? undefined : nextRepeatDate(draft, anchorDate);

  const toggleWeekday = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );

  return (
    <>
      <PickerDialog
        visible={visible && !isPickingEnd}
        title="Repeat"
        onCancel={onCancel}
        onDone={() => onDone(draft)}
        doneDisabled={needsDays || !startDate}
        clearLabel={onClear ? 'Clear' : undefined}
        onClear={onClear}
      >
        <OptionChips options={FREQUENCIES} selectedValue={frequency} onChange={setFrequency} wrap />

        {frequency !== 'monthly' ? (
          <View style={styles.weekdays}>
            {WEEKDAY_LETTERS.map((letter, day) => {
              const selected = weekdays.includes(day);
              return (
                <Pressable
                  key={WEEKDAY_NAMES[day]}
                  style={[styles.weekday, selected && styles.weekdaySelected]}
                  onPress={() => toggleWeekday(day)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={WEEKDAY_NAMES[day]}
                >
                  <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>
                    {letter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          style={styles.endsRow}
          onPress={() => setIsPickingEnd(true)}
          accessibilityRole="button"
          accessibilityLabel={endDate ? `Ends ${formatPickerDate(endDate)}. Change` : 'Ends never. Set an end date'}
        >
          <Text style={styles.endsLabel}>Ends</Text>
          <Text style={styles.endsValue}>{endDate ? formatPickerDate(endDate) : 'Never'}</Text>
        </Pressable>

        <Text style={styles.summary} accessibilityLabel="Repeat summary">
          {needsDays
            ? 'Pick at least one day'
            : startDate
              ? `${describeTaskRepeat(draft, startDate)}, from ${formatSheetDate(startDate)}`
              : 'Ends before it starts'}
        </Text>
      </PickerDialog>

      <DatePickerModal
        visible={visible && isPickingEnd}
        title="Ends"
        value={endDate}
        onCancel={() => setIsPickingEnd(false)}
        onDone={(date) => {
          setEndDate(date);
          setIsPickingEnd(false);
        }}
        onClear={
          endDate
            ? () => {
                setEndDate(undefined);
                setIsPickingEnd(false);
              }
            : undefined
        }
      />
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    weekdays: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
    },
    weekday: {
      width: 38,
      height: 38,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekdaySelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    weekdayText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textSecondary,
    },
    weekdayTextSelected: {
      color: colors.white,
      fontWeight: '600',
    },
    endsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
      marginTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    endsLabel: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
    endsValue: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.primaryDark,
      fontWeight: '600',
    },
    summary: {
      ...TYPOGRAPHY.caption,
      color: colors.textLight,
      marginTop: SPACING.sm,
    },
  });
