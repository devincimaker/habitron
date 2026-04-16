import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type {
  Habit,
  HabitDraft,
  HabitFrequency,
  HabitTimeOfDay,
  HabitWeekday,
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
import { useThemedStyles } from '../hooks/useColors';
import { getDefaultWeeklyDays, HABIT_WEEKDAYS } from '../utils/habitSchedule';
import { WeeklyCountPicker } from './WeeklyCountPicker';
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
  onClose: () => void;
  onSave: (draft: HabitDraft) => Promise<void>;
}

type ComposerStep = 'basics' | 'details';

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
  const [styles, colors] = useThemedStyles(createStyles);
  const isEditing = Boolean(habit);

  const [step, setStep] = useState<ComposerStep>('basics');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [weeklyDays, setWeeklyDays] = useState<HabitWeekday[]>(getDefaultWeeklyDays());
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('anytime');
  const [selectedIcon, setSelectedIcon] = useState<HabitIconName>(DEFAULT_HABIT_ICON);
  const [hasCustomIcon, setHasCustomIcon] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const suggestedIcon = useMemo(() => getSuggestedHabitIcon(name), [name]);

  useEffect(() => {
    if (!visible) return;

    setStep(habit ? 'details' : 'basics');
    setName(habit?.name ?? '');
    setReason(habit?.reason ?? '');
    setFrequency(habit?.frequency ?? 'daily');
    setWeeklyDays(habit?.weeklyDays ?? getDefaultWeeklyDays());
    setWeeklyCount(habit?.weeklyCount ?? 1);
    setTimeOfDay(habit?.timeOfDay ?? 'anytime');
    setSelectedIcon(resolveHabitIcon(habit?.name, habit?.icon));
    setHasCustomIcon(Boolean(habit?.icon));
    setScheduleError(null);
  }, [visible, habit]);

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
        icon: selectedIcon,
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

  const renderDetailsStep = () => (
    <>
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
      </View>

      <View style={styles.surfaceCard}>
        {frequency === 'daily' ? (
          <>
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
          </>
        ) : (
          <>
            <Label>Times per week</Label>
            <View style={styles.weeklyCountRow}>
              <WeeklyCountPicker value={weeklyCount} onChange={setWeeklyCount} />
              <Text style={styles.weeklyCountLabel}>
                {weeklyCount === 1 ? 'day per week' : 'days per week'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Label>When</Label>
        <OptionChips
          options={TIME_OPTIONS}
          selectedValue={timeOfDay}
          onChange={setTimeOfDay}
        />
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
    marginBottom: SPACING.md,
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
  dayChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
    marginTop: SPACING.sm,
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
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
