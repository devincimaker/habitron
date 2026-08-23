import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PickerDialog } from './PickerDialog';
import { WheelPicker } from './WheelPicker';
import { SPACING } from '../constants/theme';
import { parseClockTime, toClockTimeString, type ClockTime } from '../utils/habitTime';

interface TimePickerModalProps {
  visible: boolean;
  /** HH:MM (24h); undefined when adding a new reminder. */
  value?: string;
  onCancel: () => void;
  onDone: (time: string) => void;
  /** Shown only when editing an existing reminder. */
  onClear?: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  label: String(index + 1).padStart(2, '0'),
  value: index + 1,
}));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => ({
  label: String(index).padStart(2, '0'),
  value: index,
}));
const PERIOD_OPTIONS: Array<{ label: string; value: 'AM' | 'PM' }> = [
  { label: 'AM', value: 'AM' },
  { label: 'PM', value: 'PM' },
];

const DEFAULT_TIME = '09:00';

export function TimePickerModal({
  visible,
  value,
  onCancel,
  onDone,
  onClear,
}: TimePickerModalProps) {
  const [parts, setParts] = useState<ClockTime>(parseClockTime(value ?? DEFAULT_TIME));

  useEffect(() => {
    if (!visible) return;
    setParts(parseClockTime(value ?? DEFAULT_TIME));
  }, [visible, value]);

  return (
    <PickerDialog
      visible={visible}
      title="Time"
      onCancel={onCancel}
      onDone={() => onDone(toClockTimeString(parts))}
      clearLabel={onClear ? 'Clear' : undefined}
      onClear={onClear}
    >
      <View style={styles.wheels}>
        <WheelPicker
          options={HOUR_OPTIONS}
          value={parts.hour12}
          onChange={(hour12) => setParts((current) => ({ ...current, hour12 }))}
          minWidth={72}
        />
        <WheelPicker
          options={MINUTE_OPTIONS}
          value={parts.minute}
          onChange={(minute) => setParts((current) => ({ ...current, minute }))}
          minWidth={72}
        />
        <WheelPicker
          options={PERIOD_OPTIONS}
          value={parts.period}
          onChange={(period) => setParts((current) => ({ ...current, period }))}
          minWidth={72}
        />
      </View>
    </PickerDialog>
  );
}

const styles = StyleSheet.create({
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
});
