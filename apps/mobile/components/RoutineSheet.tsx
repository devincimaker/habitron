import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  HABIT_WEEKDAYS,
  type Habit,
  type HabitSection,
  type HabitSectionDraft,
  type HabitWeekday,
  getTodayDate,
} from '@habits-coach/shared';
import { BodyLarge, Caption, Label } from './ui';
import { HeaderIconButton } from './HeaderIconButton';
import { RoutineWeekStrip } from './RoutineWeekStrip';
import { TimePickerModal } from './TimePickerModal';
import { createHabitCardStyles } from './habitComposerStyles';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import RoutineAlarms from '../modules/routine-alarms';
import { getRoutineProgress } from '../utils/routineProgress';
import { seedWeek } from '../utils/routineWeek';

interface RoutineSheetProps {
  visible: boolean;
  section: HabitSection | null;
  habits: Habit[];
  /** Every other routine's name, so a rename can refuse a collision inline. */
  takenNames: string[];
  onClose: () => void;
  onSave: (sectionId: string, draft: HabitSectionDraft) => Promise<unknown>;
}

/** A routine's alarm, its week and its name. */
export function RoutineSheet({
  visible,
  section,
  habits,
  takenNames,
  onClose,
  onSave,
}: RoutineSheetProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [cards] = useThemedStyles(createHabitCardStyles);

  const [name, setName] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmByDay, setAlarmByDay] = useState<Partial<Record<HabitWeekday, string>>>({});
  const [selected, setSelected] = useState<HabitWeekday[]>([]);
  const [authorizationDenied, setAuthorizationDenied] = useState(false);
  const [pickingTime, setPickingTime] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible || !section) return;
    setName(section.name);
    setAlarmEnabled(section.alarmEnabled);
    setAlarmByDay(section.alarmByDay);
    setSelected(HABIT_WEEKDAYS.filter((weekday) => section.alarmByDay[weekday]));
    setAuthorizationDenied(false);
  }, [section, visible]);

  const progress = section
    ? getRoutineProgress(section.id, habits, new Map(), getTodayDate())
    : null;

  const nameError =
    name.trim() && takenNames.includes(name.trim().toLowerCase())
      ? 'A routine already has that name.'
      : undefined;

  const handleToggleAlarm = async (next: boolean) => {
    setAlarmEnabled(next);
    if (!next) return;

    // Seeding here rather than on save keeps the strip honest: "on" with a
    // blank week would be a switch that promises a ring it never schedules.
    if (HABIT_WEEKDAYS.every((weekday) => !alarmByDay[weekday])) {
      const seeded = seedWeek();
      setAlarmByDay(seeded);
      setSelected([...HABIT_WEEKDAYS]);
    }

    const authorization = await RoutineAlarms.requestAuthorization();
    // The week stays editable when the permission is refused: the schedule is
    // kept, and nothing is scheduled until Settings says otherwise.
    setAuthorizationDenied(authorization !== 'authorized');
  };

  const handleToggleDay = (weekday: HabitWeekday) =>
    setSelected((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday]
    );

  const applyTime = (time?: string) => {
    setAlarmByDay((current) => {
      const next = { ...current };
      for (const weekday of selected) {
        if (time) next[weekday] = time;
        else delete next[weekday];
      }
      return next;
    });
    setPickingTime(false);
  };

  const saveDisabled = isSaving || Boolean(nameError) || !name.trim();

  const handleSave = async () => {
    if (saveDisabled || !section) return;
    setIsSaving(true);
    try {
      await onSave(section.id, { name: name.trim(), alarmEnabled, alarmByDay });
      onClose();
    } catch (error) {
      // The sheet stays open holding the week, because the write may have got
      // as far as clearing the old rows: closing here would look like a save.
      console.warn('Failed to save the routine:', error);
      Alert.alert('Could not save the routine', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTime = selected.map((weekday) => alarmByDay[weekday]).find(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderIconButton name="close" accessibilityLabel="Close routine" onPress={onClose} />
          <Text style={styles.headerTitle}>Routine</Text>
          <HeaderIconButton
            name="checkmark"
            accessibilityLabel="Save routine"
            onPress={() => void handleSave()}
            color={saveDisabled ? colors.textLight : colors.primary}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {RoutineAlarms.isAvailable ? (
            <>
              <View style={cards.surfaceCard}>
                <View style={cards.cardHeader}>
                  <BodyLarge>Alarm</BodyLarge>
                  <Switch
                    value={alarmEnabled}
                    onValueChange={handleToggleAlarm}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
                {authorizationDenied ? (
                  <Pressable onPress={() => void Linking.openSettings()}>
                    <Caption color={colors.error}>
                      Alarms are off for Habits Coach in Settings. Open Settings
                    </Caption>
                  </Pressable>
                ) : (
                  <Caption>
                    Rings until you dismiss it, through Silent and Focus. Habits keep their own
                    reminders.
                  </Caption>
                )}
              </View>

              <View style={cards.surfaceCard}>
                <Label>Week</Label>
                <RoutineWeekStrip
                  alarmByDay={alarmByDay}
                  selected={selected}
                  onToggleDay={handleToggleDay}
                  onPressSummary={() => setPickingTime(true)}
                />
              </View>

              <View style={cards.surfaceCard}>
                <Label>When it rings</Label>
                <BodyLarge>
                  {progress?.current
                    ? `First up · ${progress.current.name}`
                    : 'Nothing due in this routine today'}
                </BodyLarge>
                <Caption>
                  {`Start opens ${section?.name ?? 'the routine'} on the first habit you have not logged yet.`}
                </Caption>
              </View>
            </>
          ) : null}

          <View style={cards.surfaceCard}>
            <Label>Name</Label>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Routine name"
              placeholderTextColor={colors.textLight}
              accessibilityLabel="Routine name"
            />
            {nameError ? <Caption color={colors.error}>{nameError}</Caption> : null}
          </View>
        </ScrollView>

        <TimePickerModal
          visible={pickingTime}
          value={selectedTime}
          onCancel={() => setPickingTime(false)}
          onDone={applyTime}
          onClear={() => applyTime(undefined)}
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
    headerTitle: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.text,
    },
    content: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xxl,
    },
    nameInput: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      paddingVertical: SPACING.sm,
    },
  });
