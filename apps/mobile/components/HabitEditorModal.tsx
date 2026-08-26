import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  HABIT_BUILTIN_UNITS,
  type Habit,
  type HabitDraft,
  type HabitSection,
} from '@habits-coach/shared';
import { Button } from './ui';
import { HabitBasicsStep } from './HabitBasicsStep';
import { HabitDetailsStep } from './HabitDetailsStep';
import { SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { buildHabitDraft, detailsStateFor, type HabitDetailsState } from '../utils/habitDraft';
import { getSuggestedHabitIcon, resolveHabitIcon, type HabitIconName } from '../utils/habitIcons';

interface HabitEditorModalProps {
  visible: boolean;
  habit?: Habit | null;
  /** Prefills the name when creating, so a desired habit can start itself. */
  initialName?: string;
  sections: HabitSection[];
  /** All habits, used to surface previously created custom units. */
  allHabits: Habit[];
  onClose: () => void;
  onSave: (draft: HabitDraft) => Promise<void>;
  onAddSection: (name: string) => Promise<HabitSection>;
  onRemoveSection: (sectionId: string) => Promise<void>;
}

type ComposerStep = 'basics' | 'details';

export function HabitEditorModal({
  visible,
  habit,
  initialName,
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
  const [details, setDetails] = useState<HabitDetailsState>(() => detailsStateFor(null));
  /** The icon the user picked by hand; until then the name suggests one. */
  const [customIcon, setCustomIcon] = useState<HabitIconName | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedIcon = useMemo(
    () => customIcon ?? getSuggestedHabitIcon(name),
    [customIcon, name]
  );

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
    setName(habit?.name ?? initialName ?? '');
    setDetails(detailsStateFor(habit, defaultSectionId));
    setCustomIcon(habit?.icon ? resolveHabitIcon(habit.name, habit.icon) : null);
    setScheduleError(null);
  }, [visible, habit, initialName, defaultSectionId]);

  const handleSelectIcon = (icon: HabitIconName) => {
    if (customIcon === icon) {
      return;
    }

    void Haptics.selectionAsync();
    setCustomIcon(icon);
  };

  const handleDetailsChange = useCallback((patch: Partial<HabitDetailsState>) => {
    setDetails((current) => ({ ...current, ...patch }));
    if ('frequency' in patch || 'weeklyDays' in patch) {
      setScheduleError(null);
    }
  }, []);

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
    if (details.frequency === 'daily' && details.weeklyDays.length === 0) {
      setScheduleError('Select at least one day for a daily habit.');
      Alert.alert('Pick Days', 'Choose at least one day for this daily habit.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(buildHabitDraft({ name, icon: selectedIcon, ...details }));
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

  const showsBackButton = !isEditing && step === 'details';

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
          {step === 'basics' || isEditing ? (
            <HabitBasicsStep
              name={name}
              onNameChange={setName}
              selectedIcon={selectedIcon}
              onSelectIcon={handleSelectIcon}
            />
          ) : null}
          {step === 'details' || isEditing ? (
            <HabitDetailsStep
              summary={isEditing ? undefined : { name, icon: selectedIcon }}
              details={details}
              onDetailsChange={handleDetailsChange}
              scheduleError={scheduleError}
              sections={sections}
              customUnits={customUnits}
              onAddSection={onAddSection}
              onRemoveSection={onRemoveSection}
            />
          ) : null}
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
