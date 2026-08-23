import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  HABIT_BUILTIN_UNITS,
  type HabitCheckInMode,
  type HabitFrequency,
  type HabitGoal,
} from '@habits-coach/shared';
import { DropdownField } from './DropdownField';
import { PickerDialog, RadioRow } from './PickerDialog';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface GoalPickerModalProps {
  visible: boolean;
  value: HabitGoal;
  frequency: HabitFrequency;
  /** Units beyond the built-ins that the user has already created. */
  customUnits: string[];
  onCancel: () => void;
  onDone: (goal: HabitGoal) => void;
}

const CHECK_IN_OPTIONS: Array<{ label: string; value: HabitCheckInMode }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'Manual', value: 'manual' },
  { label: 'Complete all', value: 'complete_all' },
];

function parsePositiveNumber(text: string): number | undefined {
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function GoalPickerModal({
  visible,
  value,
  frequency,
  customUnits,
  onCancel,
  onDone,
}: GoalPickerModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [goalType, setGoalType] = useState(value.goalType);
  const [targetText, setTargetText] = useState(String(value.targetAmount ?? 1));
  const [unit, setUnit] = useState(value.unit ?? 'Count');
  const [checkInMode, setCheckInMode] = useState(value.checkInMode);
  const [incrementText, setIncrementText] = useState(String(value.recordIncrement ?? 1));
  const [extraUnits, setExtraUnits] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setGoalType(value.goalType);
    setTargetText(String(value.targetAmount ?? 1));
    setUnit(value.unit ?? 'Count');
    setCheckInMode(value.checkInMode);
    setIncrementText(String(value.recordIncrement ?? 1));
    setExtraUnits([]);
  }, [visible, value]);

  const unitOptions = Array.from(
    new Set<string>([...HABIT_BUILTIN_UNITS, ...customUnits, ...extraUnits, unit])
  ).map((label) => ({ label, value: label }));

  const periodLabel =
    frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Per day' : 'Per due day';

  const target = parsePositiveNumber(targetText);
  const increment = parsePositiveNumber(incrementText);
  const isQuantity = goalType === 'quantity';
  const doneDisabled = isQuantity && (!target || (checkInMode === 'auto' && !increment));

  const handleAddUnit = () => {
    Alert.prompt('Add Unit', 'Name for the new unit', (text) => {
      const name = text?.trim();
      if (!name) return;
      setExtraUnits((current) => [...current, name]);
      setUnit(name);
    });
  };

  const handleDone = () => {
    if (!isQuantity) {
      onDone({ goalType: 'boolean', checkInMode: 'auto' });
      return;
    }
    onDone({
      goalType: 'quantity',
      targetAmount: target,
      unit,
      checkInMode,
      recordIncrement: checkInMode === 'auto' ? increment : undefined,
    });
  };

  return (
    <PickerDialog
      visible={visible}
      title="Goal"
      onCancel={onCancel}
      onDone={handleDone}
      doneDisabled={doneDisabled}
    >
      <RadioRow
        label="Achieve it all"
        selected={goalType === 'boolean'}
        onPress={() => setGoalType('boolean')}
      />
      <RadioRow
        label="Reach a certain amount"
        selected={goalType === 'quantity'}
        onPress={() => setGoalType('quantity')}
      />

      {isQuantity ? (
        <View style={styles.fields}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{periodLabel}</Text>
            <TextInput
              style={styles.numberInput}
              value={targetText}
              onChangeText={setTargetText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholderTextColor={colors.textLight}
            />
            <DropdownField
              options={unitOptions}
              value={unit}
              onChange={setUnit}
              footerLabel="Add Unit"
              onFooterPress={handleAddUnit}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, styles.fieldLabelWide]}>When checking</Text>
            <DropdownField
              options={CHECK_IN_OPTIONS}
              value={checkInMode}
              onChange={setCheckInMode}
            />
          </View>

          {checkInMode === 'auto' ? (
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelWide]}>Record ({unit})</Text>
              <TextInput
                style={[styles.numberInput, styles.numberInputWide]}
                value={incrementText}
                onChangeText={setIncrementText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholderTextColor={colors.textLight}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </PickerDialog>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    fields: {
      marginTop: SPACING.sm,
      gap: SPACING.md,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    fieldLabel: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      width: 96,
    },
    fieldLabelWide: {
      flex: 1,
      width: undefined,
    },
    numberInput: {
      flex: 1,
      height: 44,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
    numberInputWide: {
      flex: 0,
      minWidth: 140,
    },
  });
