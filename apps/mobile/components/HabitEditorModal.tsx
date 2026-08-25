/* eslint-disable max-lines -- HAB-89: split pending */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  HABIT_BUILTIN_UNITS,
  getTodayDate,
  type Habit,
  type HabitDraft,
  type HabitFrequency,
  type HabitGoal,
  type HabitSection,
  type HabitWeekday,
} from '@habits-coach/shared';
import { Button, Caption, Input, Label } from './ui';
import {
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { OptionChips } from './OptionChips';
import { WheelPicker } from './WheelPicker';
import { GoalPickerModal } from './GoalPickerModal';
import { GoalDaysPickerModal, formatGoalDays } from './GoalDaysPickerModal';
import { DatePickerModal, formatPickerDate } from './DatePickerModal';
import { TimePickerModal } from './TimePickerModal';
import { useThemedStyles } from '../hooks/useColors';
import { getDefaultWeeklyDays, HABIT_WEEKDAYS } from '../utils/habitSchedule';
import { formatReminderTime } from '../utils/habitTime';
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_OPTIONS,
  getHabitIconLabel,
  getHabitIconOption,
  getSuggestedHabitIcon,
  resolveHabitIcon,
  type HabitIconName,
} from '../utils/habitIcons';

interface HabitEditorModalProps {
  visible: boolean;
  habit?: Habit | null;
  sections: HabitSection[];
  /** All habits, used to surface previously created custom units. */
  allHabits: Habit[];
  onClose: () => void;
  onSave: (draft: HabitDraft) => Promise<void>;
  onAddSection: (name: string) => Promise<HabitSection>;
  onRemoveSection: (sectionId: string) => Promise<void>;
}

type ComposerStep = 'basics' | 'details';
type ActivePicker = 'goal' | 'startDate' | 'goalDays' | 'reminder' | null;

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

const DEFAULT_GOAL: HabitGoal = { goalType: 'boolean', checkInMode: 'auto' };

function describeGoal(goal: HabitGoal): string {
  if (goal.goalType === 'boolean') return 'Achieve it all';
  const unit = goal.unit ?? 'Count';
  return `${goal.targetAmount ?? 1} ${unit}`;
}

export function HabitEditorModal({
  visible,
  habit,
  sections,
  allHabits,
  onClose,
  onSave,
  onAddSection,
  onRemoveSection,
}: HabitEditorModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const isEditing = Boolean(habit);

  const [step, setStep] = useState<ComposerStep>('basics');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [weeklyDays, setWeeklyDays] = useState<HabitWeekday[]>(getDefaultWeeklyDays());
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [intervalDays, setIntervalDays] = useState(2);
  const [goal, setGoal] = useState<HabitGoal>(DEFAULT_GOAL);
  const [startDate, setStartDate] = useState(getTodayDate());
  const [goalDays, setGoalDays] = useState<number | undefined>(undefined);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [constantReminder, setConstantReminder] = useState(false);
  const [autoPopupLog, setAutoPopupLog] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<HabitIconName>(DEFAULT_HABIT_ICON);
  const [hasCustomIcon, setHasCustomIcon] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [editingReminder, setEditingReminder] = useState<string | null>(null);
  const suggestedIcon = useMemo(() => getSuggestedHabitIcon(name), [name]);

  const customUnits = useMemo(() => {
    const builtIns = new Set<string>(HABIT_BUILTIN_UNITS);
    return Array.from(
      new Set(
        allHabits
          .map((candidate) => candidate.unit)
          .filter((unit): unit is string => Boolean(unit) && !builtIns.has(unit!))
      )
    );
  }, [allHabits]);

  const defaultSectionId = useMemo(
    () => sections.find((section) => section.name === 'Others')?.id ?? sections[0]?.id,
    [sections]
  );

  useEffect(() => {
    if (!visible) return;

    setStep(habit ? 'details' : 'basics');
    setName(habit?.name ?? '');
    setReason(habit?.reason ?? '');
    setFrequency(habit?.frequency ?? 'daily');
    setWeeklyDays(habit?.weeklyDays ?? getDefaultWeeklyDays());
    setWeeklyCount(habit?.weeklyCount ?? 1);
    setIntervalDays(habit?.intervalDays ?? 2);
    setGoal(
      habit
        ? {
            goalType: habit.goalType,
            targetAmount: habit.targetAmount,
            unit: habit.unit,
            checkInMode: habit.checkInMode,
            recordIncrement: habit.recordIncrement,
          }
        : DEFAULT_GOAL
    );
    setStartDate(habit?.startDate ?? getTodayDate());
    setGoalDays(habit?.goalDays);
    setSectionId(habit?.sectionId ?? defaultSectionId);
    setReminderTimes(habit?.reminderTimes ?? []);
    setConstantReminder(habit?.constantReminder ?? false);
    setAutoPopupLog(habit?.autoPopupLog ?? false);
    setSelectedIcon(resolveHabitIcon(habit?.name, habit?.icon));
    setHasCustomIcon(Boolean(habit?.icon));
    setScheduleError(null);
    setActivePicker(null);
    setEditingReminder(null);
  }, [visible, habit, defaultSectionId]);

  useEffect(() => {
    if (!visible || hasCustomIcon) {
      return;
    }

    setSelectedIcon(suggestedIcon);
  }, [hasCustomIcon, suggestedIcon, visible]);

  const handleSelectIcon = (icon: HabitIconName) => {
    if (selectedIcon === icon && hasCustomIcon) {
      return;
    }

    void Haptics.selectionAsync();
    setSelectedIcon(icon);
    setHasCustomIcon(true);
  };

  const toggleWeeklyDay = (day: HabitWeekday) => {
    setScheduleError(null);
    setWeeklyDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day]
    );
  };

  const handleAdvance = () => {
    if (!name.trim()) {
      return;
    }

    setStep('details');
  };

  const handleClosePress = () => {
    if (!isEditing && step === 'details') {
      setStep('basics');
      return;
    }

    onClose();
  };

  const handleAddSection = () => {
    Alert.prompt('New Section', 'Name for the new section', async (text) => {
      const sectionName = text?.trim();
      if (!sectionName) return;
      if (sections.some((section) => section.name.toLowerCase() === sectionName.toLowerCase())) {
        Alert.alert('Section exists', `You already have a "${sectionName}" section.`);
        return;
      }
      const section = await onAddSection(sectionName);
      setSectionId(section.id);
    });
  };

  const handleRemoveSection = (section: HabitSection) => {
    Alert.alert(
      'Delete Section',
      `Delete "${section.name}"? Habits in it will become unsorted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await onRemoveSection(section.id);
            if (sectionId === section.id) {
              setSectionId(undefined);
            }
          },
        },
      ]
    );
  };

  const handleReminderDone = (time: string) => {
    setReminderTimes((current) => {
      const next = current.filter((existing) => existing !== editingReminder);
      if (!next.includes(time)) next.push(time);
      return next.sort();
    });
    setActivePicker(null);
    setEditingReminder(null);
  };

  const handleReminderClear = () => {
    setReminderTimes((current) => current.filter((existing) => existing !== editingReminder));
    setActivePicker(null);
    setEditingReminder(null);
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
        icon: selectedIcon,
        frequency,
        weeklyDays: frequency === 'daily' ? weeklyDays : undefined,
        weeklyCount: frequency === 'weekly' ? weeklyCount : undefined,
        intervalDays: frequency === 'interval' ? intervalDays : undefined,
        startDate,
        goalDays,
        ...goal,
        sectionId,
        reminderTimes,
        constantReminder,
        autoPopupLog,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const headerTitle = isEditing
    ? 'Edit Habit'
    : step === 'basics'
      ? 'New Habit'
      : 'Habit Details';

  const selectedOption = getHabitIconOption(selectedIcon);
  const showsBackButton = !isEditing && step === 'details';

  const renderBasicsStep = () => (
    <>
      <View style={styles.surfaceCard}>
        <Caption style={styles.cardEyebrow}>Habit name</Caption>
        <Input
          placeholder="Daily check-in"
          value={name}
          onChangeText={setName}
          autoFocus
          containerStyle={styles.fieldNoMargin}
        />
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Icon</Text>
            <Caption>{getHabitIconLabel(selectedIcon)}</Caption>
          </View>
          {selectedOption ? (
            <View
              style={[
                styles.selectedIconChip,
                { backgroundColor: selectedOption.accentColor },
              ]}
            >
              <Ionicons name={selectedIcon} size={16} color={colors.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.iconGrid}>
          {HABIT_ICON_OPTIONS.map((option) => {
            const isSelected = option.icon === selectedIcon;

            return (
              <Pressable
                key={option.icon}
                style={[
                  styles.iconChoice,
                  isSelected && styles.iconChoiceSelected,
                ]}
                onPress={() => handleSelectIcon(option.icon)}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${option.label} icon`}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: option.accentColor },
                    isSelected && styles.iconBubbleSelected,
                  ]}
                >
                  <Ionicons name={option.icon} size={18} color={colors.white} />
                </View>
                {isSelected ? (
                  <View style={styles.iconCheck}>
                    <Ionicons name="checkmark" size={11} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderFrequencyCard = () => (
    <View style={styles.surfaceCard}>
      <Label>Frequency</Label>
      <OptionChips
        options={FREQUENCY_OPTIONS}
        selectedValue={frequency}
        onChange={(nextFrequency) => {
          setScheduleError(null);
          setFrequency(nextFrequency);
        }}
      />

      {frequency === 'daily' ? (
        <>
          <Label style={styles.subLabel}>Pick Days</Label>
          <View style={styles.dayChipGrid}>
            {HABIT_WEEKDAYS.map((day) => {
              const isSelected = weeklyDays.includes(day);
              return (
                <Pressable
                  key={day}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => toggleWeeklyDay(day)}
                >
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
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
              onChange={setWeeklyCount}
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
              onChange={setIntervalDays}
              visibleRows={3}
            />
            <Text style={styles.wheelLabel}>days</Text>
          </View>
        </>
      ) : null}
    </View>
  );

  const renderSettingsRow = (
    label: string,
    value: string,
    onPress: () => void,
    help?: string
  ) => (
    <Pressable style={styles.settingsRow} onPress={onPress} accessibilityRole="button">
      <View style={styles.settingsLabelRow}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {help ? (
          <Pressable hitSlop={8} onPress={() => Alert.alert(label, help)}>
            <Ionicons name="help-circle-outline" size={18} color={colors.textLight} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.settingsValueRow}>
        <Text style={styles.settingsValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </View>
    </Pressable>
  );

  const renderDetailsStep = () => (
    <>
      {!isEditing ? (
        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIcon,
              { backgroundColor: selectedOption?.accentColor ?? colors.primary },
            ]}
          >
            <Ionicons name={selectedIcon} size={20} color={colors.white} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{name.trim() || 'New habit'}</Text>
            <Caption>{getHabitIconLabel(selectedIcon)}</Caption>
          </View>
        </View>
      ) : null}

      {renderFrequencyCard()}

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

      <View style={styles.surfaceCard}>
        <View style={styles.cardHeader}>
          <Label>Section</Label>
          <Pressable hitSlop={8} onPress={handleAddSection} accessibilityLabel="Add section">
            <Ionicons name="add" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.sectionChips}>
            {sections.map((section) => {
              const isSelected = section.id === sectionId;
              return (
                <Pressable
                  key={section.id}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => setSectionId(section.id)}
                  onLongPress={() => handleRemoveSection(section)}
                >
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                    {section.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.surfaceCard}>
        <Label>Reminder</Label>
        <View style={styles.reminderRow}>
          {reminderTimes.map((time) => (
            <Pressable
              key={time}
              style={[styles.dayChip, styles.dayChipSelected]}
              onPress={() => {
                setEditingReminder(time);
                setActivePicker('reminder');
              }}
            >
              <Text style={[styles.dayChipText, styles.dayChipTextSelected]}>
                {formatReminderTime(time)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.addReminder}
            onPress={() => {
              setEditingReminder(null);
              setActivePicker('reminder');
            }}
            accessibilityLabel="Add reminder"
          >
            <Ionicons name="add" size={20} color={colors.primaryDark} />
            <Text style={styles.addReminderText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.toggleRow}>
          <Text style={styles.settingsLabel}>Constant Reminder</Text>
          <Switch
            value={constantReminder}
            onValueChange={setConstantReminder}
            trackColor={{ true: colors.primary }}
            disabled={reminderTimes.length === 0}
          />
        </View>
        {reminderTimes.length === 0 ? (
          <Caption>Add a reminder time to keep nudging until you log the habit.</Caption>
        ) : null}
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.settingsLabel}>Auto pop-up of habit log</Text>
          <Switch
            value={autoPopupLog}
            onValueChange={setAutoPopupLog}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Input
          label="Why it matters"
          placeholder="What this supports in your life"
          value={reason}
          onChangeText={setReason}
          multiline
          containerStyle={styles.fieldNoMargin}
        />
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClosePress}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={handleClosePress}
            accessibilityRole="button"
            accessibilityLabel={showsBackButton ? 'Back' : 'Close'}
          >
            <Ionicons
              name={showsBackButton ? 'chevron-back' : 'close'}
              size={24}
              color={colors.text}
            />
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'basics' || isEditing ? renderBasicsStep() : null}
          {step === 'details' || isEditing ? renderDetailsStep() : null}
        </ScrollView>

        <View style={styles.footer}>
          {!isEditing && step === 'details' ? (
            <Button title="Back" variant="ghost" onPress={() => setStep('basics')} size="md" />
          ) : (
            <Button title="Cancel" variant="ghost" onPress={onClose} size="md" />
          )}

          <Button
            title={
              !isEditing && step === 'basics'
                ? 'Next'
                : isEditing
                  ? 'Save Habit'
                  : 'Create Habit'
            }
            onPress={!isEditing && step === 'basics' ? handleAdvance : handleSave}
            loading={isSaving}
            disabled={!name.trim()}
            size="md"
          />
        </View>

        <GoalPickerModal
          visible={activePicker === 'goal'}
          value={goal}
          frequency={frequency}
          customUnits={customUnits}
          onCancel={() => setActivePicker(null)}
          onDone={(nextGoal) => {
            setGoal(nextGoal);
            setActivePicker(null);
          }}
        />
        <DatePickerModal
          visible={activePicker === 'startDate'}
          title="Date"
          value={startDate}
          onCancel={() => setActivePicker(null)}
          onDone={(date) => {
            setStartDate(date);
            setActivePicker(null);
          }}
        />
        <GoalDaysPickerModal
          visible={activePicker === 'goalDays'}
          value={goalDays}
          onCancel={() => setActivePicker(null)}
          onDone={(days) => {
            setGoalDays(days);
            setActivePicker(null);
          }}
        />
        <TimePickerModal
          visible={activePicker === 'reminder'}
          value={editingReminder ?? undefined}
          onCancel={() => {
            setActivePicker(null);
            setEditingReminder(null);
          }}
          onDone={handleReminderDone}
          onClear={editingReminder ? handleReminderClear : undefined}
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: {
    ...TYPOGRAPHY.headingLarge,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  surfaceCard: {
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  settingsCard: {
    paddingVertical: SPACING.xs,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    ...TYPOGRAPHY.headingMedium,
    color: colors.text,
    marginBottom: 2,
  },
  cardEyebrow: {
    marginBottom: SPACING.sm,
    color: colors.textSecondary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    ...TYPOGRAPHY.headingMedium,
    color: colors.text,
    marginBottom: 2,
  },
  selectedIconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldNoMargin: {
    marginBottom: 0,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  iconChoice: {
    width: '20%',
    maxWidth: '20%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  iconChoiceSelected: {
    transform: [{ scale: 1.04 }],
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleSelected: {
    ...SHADOWS.small,
  },
  iconCheck: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  sectionChips: {
    flexDirection: 'row',
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
  settingsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  settingsLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.text,
  },
  settingsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  settingsValue: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: SPACING.xs,
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  addReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 42,
    paddingHorizontal: SPACING.sm,
  },
  addReminderText: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  errorText: {
    color: colors.error,
    marginTop: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
