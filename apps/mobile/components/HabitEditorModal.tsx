import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  Habit,
  HabitDraft,
  HabitFrequency,
  HabitTimeOfDay,
  HabitWeekday,
} from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { SPACING, type Colors } from '../constants/theme';
import { OptionChips } from './OptionChips';
import { useThemedStyles } from '../hooks/useColors';
import { getDefaultWeeklyDays, HABIT_WEEKDAYS } from '../utils/habitSchedule';
import { WeeklyCountPicker } from './WeeklyCountPicker';

interface HabitEditorModalProps {
  visible: boolean;
  habit?: Habit | null;
  onClose: () => void;
  onSave: (draft: HabitDraft) => Promise<void>;
}

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'daily' as const },
  { label: 'Weekly', value: 'weekly' as const },
];

const TIME_OPTIONS = [
  { label: 'Anytime', value: 'anytime' as const },
  { label: 'Morning', value: 'morning' as const },
  { label: 'Afternoon', value: 'afternoon' as const },
  { label: 'Evening', value: 'evening' as const },
];

export function HabitEditorModal({
  visible,
  habit,
  onClose,
  onSave,
}: HabitEditorModalProps) {
  const [styles] = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [weeklyDays, setWeeklyDays] = useState<HabitWeekday[]>(getDefaultWeeklyDays());
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('anytime');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(habit?.name ?? '');
    setReason(habit?.reason ?? '');
    setFrequency(habit?.frequency ?? 'daily');
    setWeeklyDays(habit?.weeklyDays ?? getDefaultWeeklyDays());
    setWeeklyCount(habit?.weeklyCount ?? 1);
    setTimeOfDay(habit?.timeOfDay ?? 'anytime');
    setScheduleError(null);
  }, [visible, habit]);

  const toggleWeeklyDay = (day: HabitWeekday) => {
    setScheduleError(null);
    setWeeklyDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (frequency === 'daily' && weeklyDays.length === 0) {
      setScheduleError('Select at least one day for a daily habit.');
      Alert.alert('Pick Days', 'Choose at least one day for this daily habit.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        reason: reason.trim() || undefined,
        frequency,
        weeklyDays: frequency === 'daily' ? weeklyDays : undefined,
        weeklyCount: frequency === 'weekly' ? weeklyCount : undefined,
        timeOfDay,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <HeadingLarge style={styles.title}>
            {habit ? 'Edit Habit' : 'New Habit'}
          </HeadingLarge>

          <Input
            label="Habit"
            placeholder="Read before bed"
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <Input
            label="Why it matters"
            placeholder="What this supports in your life"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <View style={styles.section}>
            <Label>Frequency</Label>
            <OptionChips
              options={FREQUENCY_OPTIONS}
              selectedValue={frequency}
              onChange={(nextFrequency) => {
                setScheduleError(null);
                setFrequency(nextFrequency);
              }}
            />
          </View>

          {frequency === 'daily' ? (
            <View style={styles.section}>
              <Label>Pick days</Label>
              <View style={styles.dayChipGrid}>
                {HABIT_WEEKDAYS.map((day) => {
                  const isSelected = weeklyDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      style={[
                        styles.dayChip,
                        isSelected && styles.dayChipSelected,
                      ]}
                      onPress={() => toggleWeeklyDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          isSelected && styles.dayChipTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {scheduleError ? (
                <Caption style={styles.errorText}>{scheduleError}</Caption>
              ) : null}
            </View>
          ) : (
            <View style={styles.section}>
              <Label>Times per week</Label>
              <View style={styles.weeklyCountRow}>
                <WeeklyCountPicker value={weeklyCount} onChange={setWeeklyCount} />
                <Text style={styles.weeklyCountLabel}>
                  {weeklyCount === 1 ? 'day per week' : 'days per week'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Label>When</Label>
            <OptionChips
              options={TIME_OPTIONS}
              selectedValue={timeOfDay}
              onChange={setTimeOfDay}
            />
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <Button title="Cancel" variant="ghost" onPress={onClose} size="md" />
          <Button
            title={habit ? 'Save Habit' : 'Create Habit'}
            onPress={handleSave}
            loading={isSaving}
            disabled={!name.trim()}
            size="md"
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  title: {
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.md,
  },
  dayChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayChip: {
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
  dayChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dayChipText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  weeklyCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  weeklyCountLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  errorText: {
    color: colors.error,
    marginTop: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
