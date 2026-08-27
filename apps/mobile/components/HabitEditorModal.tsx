import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  HABIT_BUILTIN_UNITS,
  type Habit,
  type HabitDraft,
  type HabitSection,
} from '@habits-coach/shared';
import { HabitBasicsStep } from './HabitBasicsStep';
import { HabitComposerFooter } from './HabitComposerFooter';
import { HabitDetailsStep } from './HabitDetailsStep';
import { SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useSheetKeyboard } from '../hooks/useSheetKeyboard';
import {
  buildHabitDraft,
  detailsStateFor,
  scheduleErrorFor,
  type HabitDetailsState,
} from '../utils/habitDraft';
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

/**
 * onShow fires once the sheet's presentation completes. The quick-create sheet
 * still waits this long before raising the keyboard, so the sheet is at rest
 * when the keyboard's own animation starts; this composer does the same.
 */
const FOCUS_AFTER_SHOW_MS = 250;

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
  const { keyboardHeight, bottomInset } = useSheetKeyboard();
  const nameRef = useRef<TextInput>(null);
  const isEditing = Boolean(habit);

  const [step, setStep] = useState<ComposerStep>('basics');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
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
    setReason(habit?.reason ?? '');
    setDetails(detailsStateFor(habit, defaultSectionId));
    setCustomIcon(habit?.icon ? resolveHabitIcon(habit.name, habit.icon) : null);
    setScheduleError(null);
  }, [visible, habit, initialName, defaultSectionId]);

  const handleShow = () => {
    if (isEditing) return;

    setTimeout(() => nameRef.current?.focus(), FOCUS_AFTER_SHOW_MS);
  };

  const handleSelectIcon = (icon: HabitIconName) => {
    if (customIcon === icon) {
      return;
    }

    void Haptics.selectionAsync();
    setCustomIcon(icon);
  };

  const handleDetailsChange = (patch: Partial<HabitDetailsState>) => {
    setDetails((current) => ({ ...current, ...patch }));
    if ('frequency' in patch || 'weeklyDays' in patch) {
      setScheduleError(null);
    }
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
    const error = scheduleErrorFor(details);
    if (error) {
      setScheduleError(error);
      Alert.alert('Pick Days', 'Choose at least one day for this daily habit.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(buildHabitDraft({ name, reason, icon: selectedIcon, ...details }));
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
  const showsBasics = step === 'basics' || isEditing;
  const showsDetails = step === 'details' || isEditing;

  const action =
    step === 'basics'
      ? { title: 'Next', onPress: () => setStep('details') }
      : { title: isEditing ? 'Save Habit' : 'Create Habit', onPress: handleSave };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleShow}
      onRequestClose={handleClosePress}
    >
      <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
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
          keyboardDismissMode="on-drag"
        >
          {showsBasics ? (
            <HabitBasicsStep
              name={name}
              onNameChange={setName}
              nameRef={nameRef}
              reason={reason}
              onReasonChange={setReason}
              selectedIcon={selectedIcon}
              onSelectIcon={handleSelectIcon}
            />
          ) : null}
          {showsDetails ? (
            <HabitDetailsStep
              summary={isEditing ? undefined : { name, reason, icon: selectedIcon }}
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

        <HabitComposerFooter
          title={isSaving ? 'Saving...' : action.title}
          disabled={!name.trim() || isSaving}
          onPress={action.onPress}
          bottomInset={bottomInset}
        />
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
  });
