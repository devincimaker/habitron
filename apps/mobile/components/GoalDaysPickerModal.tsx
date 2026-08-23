import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HABIT_GOAL_DAY_PRESETS } from '@habits-coach/shared';
import { PickerDialog, RadioRow } from './PickerDialog';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface GoalDaysPickerModalProps {
  visible: boolean;
  /** undefined = forever */
  value: number | undefined;
  onCancel: () => void;
  onDone: (goalDays: number | undefined) => void;
}

type Choice = 'forever' | 'preset' | 'custom';

const MAX_GOAL_DAYS = 999;

export function formatGoalDays(goalDays: number | undefined): string {
  return goalDays ? `${goalDays} Days` : 'Forever';
}

export function GoalDaysPickerModal({
  visible,
  value,
  onCancel,
  onDone,
}: GoalDaysPickerModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [choice, setChoice] = useState<Choice>('forever');
  const [preset, setPreset] = useState<number>(HABIT_GOAL_DAY_PRESETS[0]);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (!value) {
      setChoice('forever');
      setCustomText('');
      return;
    }
    if ((HABIT_GOAL_DAY_PRESETS as readonly number[]).includes(value)) {
      setChoice('preset');
      setPreset(value);
      setCustomText('');
      return;
    }
    setChoice('custom');
    setCustomText(String(value));
  }, [visible, value]);

  const customDays = Number(customText);
  const customValid =
    Number.isInteger(customDays) && customDays >= 1 && customDays <= MAX_GOAL_DAYS;

  const handleDone = () => {
    if (choice === 'forever') onDone(undefined);
    else if (choice === 'preset') onDone(preset);
    else onDone(customDays);
  };

  return (
    <PickerDialog
      visible={visible}
      title="Goal Days"
      onCancel={onCancel}
      onDone={handleDone}
      doneDisabled={choice === 'custom' && !customValid}
    >
      <RadioRow label="Forever" selected={choice === 'forever'} onPress={() => setChoice('forever')} />
      {HABIT_GOAL_DAY_PRESETS.map((days) => (
        <RadioRow
          key={days}
          label={`${days} Days`}
          selected={choice === 'preset' && preset === days}
          onPress={() => {
            setChoice('preset');
            setPreset(days);
          }}
        />
      ))}
      <RadioRow
        label="Custom"
        selected={choice === 'custom'}
        onPress={() => setChoice('custom')}
        trailing={
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customText}
              onChangeText={(text) => {
                setChoice('custom');
                setCustomText(text.replace(/[^0-9]/g, '').slice(0, 3));
              }}
              onFocus={() => setChoice('custom')}
              keyboardType="number-pad"
              placeholder={`1~${MAX_GOAL_DAYS}`}
              placeholderTextColor={colors.textLight}
            />
            <Text style={styles.customSuffix}>Day</Text>
          </View>
        }
      />
    </PickerDialog>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    customInput: {
      width: 88,
      height: 40,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
      textAlign: 'center',
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
    customSuffix: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
  });
