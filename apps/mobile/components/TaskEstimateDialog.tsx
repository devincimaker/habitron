import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { DurationStepper } from './DurationStepper';
import { PickerDialog } from './PickerDialog';
import { Caption } from './ui';
import { formatDurationMinutes, getDurationStep } from '../utils/todoEstimate';
import { SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** Where the stepper starts on a task that has no estimate yet. */
const DEFAULT_MINUTES = 30;

interface TaskEstimateDialogProps {
  visible: boolean;
  minutes?: number;
  onCancel: () => void;
  /** `undefined` clears the estimate. */
  onDone: (minutes: number | undefined) => void;
}

/** The estimate stepper the row's completion ask uses, as its own dialog. */
export function TaskEstimateDialog({
  visible,
  minutes,
  onCancel,
  onDone,
}: TaskEstimateDialogProps) {
  const [styles] = useThemedStyles(createStyles);
  const [value, setValue] = useState(minutes ?? DEFAULT_MINUTES);

  // Reopening on a task whose estimate changed underneath starts from the real
  // value, not the one the dialog was last closed on.
  useEffect(() => {
    if (visible) setValue(minutes ?? DEFAULT_MINUTES);
  }, [visible, minutes]);

  return (
    <PickerDialog
      visible={visible}
      title="Estimate"
      onCancel={onCancel}
      onDone={() => onDone(value)}
      clearLabel={minutes === undefined ? undefined : 'Clear'}
      onClear={minutes === undefined ? undefined : () => onDone(undefined)}
    >
      <DurationStepper minutes={value} onChange={setValue} size="large" />

      <Caption style={styles.stepHint}>
        {`Steps of ${formatDurationMinutes(getDurationStep(value))}`}
      </Caption>
    </PickerDialog>
  );
}

const createStyles = (_colors: Colors) =>
  StyleSheet.create({
    stepHint: {
      textAlign: 'center',
      paddingTop: SPACING.xs,
    },
  });
