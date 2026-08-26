import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HabitFrequency, HabitWeekday } from '@habits-coach/shared';
import { BodyLarge, Caption, Label } from './ui';
import { HabitChip } from './HabitChip';
import { OptionChips } from './OptionChips';
import { WheelPicker } from './WheelPicker';
import { GoalPickerModal } from './GoalPickerModal';
import { GoalDaysPickerModal, formatGoalDays } from './GoalDaysPickerModal';
import { DatePickerModal, formatPickerDate } from './DatePickerModal';
import { createHabitCardStyles } from './habitComposerStyles';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { describeGoal, type HabitDetailsState } from '../utils/habitDraft';
import { HABIT_WEEKDAYS } from '../utils/habitSchedule';

type SchedulePicker = 'goal' | 'startDate' | 'goalDays' | null;

const FREQUENCY_OPTIONS: Array<{ label: string; value: HabitFrequency }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Interval', value: 'interval' },
];

const WEEKLY_COUNT_OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}));
const INTERVAL_OPTIONS = Array.from({ length: 364 }, (_, index) => ({
  label: String(index + 2),
  value: index + 2,
}));

interface HabitScheduleSectionProps {
  details: HabitDetailsState;
  onChange: (patch: Partial<HabitDetailsState>) => void;
  scheduleError: string | null;
  /** Units earlier habits introduced, offered again by the goal picker. */
  customUnits: string[];
}

/** The frequency card and the Goal / Start Date / Goal Days rows, with their pickers. */
export function HabitScheduleSection({
  details,
  onChange,
  scheduleError,
  customUnits,
}: HabitScheduleSectionProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [activePicker, setActivePicker] = useState<SchedulePicker>(null);
  const { frequency, weeklyDays, weeklyCount, intervalDays, goal, startDate, goalDays } = details;

  const toggleWeeklyDay = (day: HabitWeekday) => {
    onChange({
      weeklyDays: weeklyDays.includes(day)
        ? weeklyDays.filter((currentDay) => currentDay !== day)
        : [...weeklyDays, day],
    });
  };

  const renderSettingsRow = (
    label: string,
    value: string,
    onPress: () => void,
    help?: string
  ) => (
    <Pressable style={styles.settingsRow} onPress={onPress} accessibilityRole="button">
      <View style={styles.settingsSide}>
        <BodyLarge>{label}</BodyLarge>
        {help ? (
          <Pressable hitSlop={8} onPress={() => Alert.alert(label, help)}>
            <Ionicons name="help-circle-outline" size={18} color={colors.textLight} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.settingsSide}>
        <Text style={styles.settingsValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </View>
    </Pressable>
  );

  return (
    <>
      <View style={styles.surfaceCard}>
        <Label>Frequency</Label>
        <OptionChips
          options={FREQUENCY_OPTIONS}
          selectedValue={frequency}
          onChange={(nextFrequency) => onChange({ frequency: nextFrequency })}
        />

        {frequency === 'daily' ? (
          <>
            <Label style={styles.subLabel}>Pick Days</Label>
            <View style={styles.dayChipGrid}>
              {HABIT_WEEKDAYS.map((day) => (
                <HabitChip
                  key={day}
                  label={day}
                  selected={weeklyDays.includes(day)}
                  onPress={() => toggleWeeklyDay(day)}
                />
              ))}
            </View>
            {scheduleError ? <Caption style={styles.errorText}>{scheduleError}</Caption> : null}
          </>
        ) : null}

        {frequency === 'weekly' ? (
          <>
            <Label style={styles.subLabel}>Times per week</Label>
            <View style={styles.wheelRow}>
              <WheelPicker
                options={WEEKLY_COUNT_OPTIONS}
                value={weeklyCount}
                onChange={(value) => onChange({ weeklyCount: value })}
                visibleRows={3}
              />
              <Text style={styles.wheelLabel}>
                {weeklyCount === 1 ? 'day per week' : 'days per week'}
              </Text>
            </View>
          </>
        ) : null}

        {frequency === 'interval' ? (
          <>
            <Label style={styles.subLabel}>Repeat every</Label>
            <View style={styles.wheelRow}>
              <WheelPicker
                options={INTERVAL_OPTIONS}
                value={intervalDays}
                onChange={(value) => onChange({ intervalDays: value })}
                visibleRows={3}
              />
              <Text style={styles.wheelLabel}>days</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.surfaceCard, styles.settingsCard]}>
        {renderSettingsRow('Goal', describeGoal(goal), () => setActivePicker('goal'))}
        <View style={styles.divider} />
        {renderSettingsRow('Start Date', formatPickerDate(startDate), () =>
          setActivePicker('startDate')
        )}
        <View style={styles.divider} />
        {renderSettingsRow(
          'Goal Days',
          formatGoalDays(goalDays),
          () => setActivePicker('goalDays'),
          'How many days this habit runs from its start date. After that it stops showing up.'
        )}
      </View>

      <GoalPickerModal
        visible={activePicker === 'goal'}
        value={goal}
        frequency={frequency}
        customUnits={customUnits}
        onCancel={() => setActivePicker(null)}
        onDone={(nextGoal) => {
          onChange({ goal: nextGoal });
          setActivePicker(null);
        }}
      />
      <DatePickerModal
        visible={activePicker === 'startDate'}
        title="Date"
        value={startDate}
        onCancel={() => setActivePicker(null)}
        onDone={(date) => {
          onChange({ startDate: date });
          setActivePicker(null);
        }}
      />
      <GoalDaysPickerModal
        visible={activePicker === 'goalDays'}
        value={goalDays}
        onCancel={() => setActivePicker(null)}
        onDone={(days) => {
          onChange({ goalDays: days });
          setActivePicker(null);
        }}
      />
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    ...createHabitCardStyles(colors),
    settingsCard: {
      paddingVertical: SPACING.xs,
    },
    subLabel: {
      marginTop: SPACING.md,
    },
    dayChipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    wheelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    wheelLabel: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '500',
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
    },
    settingsSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    settingsValue: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.error,
      marginTop: SPACING.xs,
    },
  });
