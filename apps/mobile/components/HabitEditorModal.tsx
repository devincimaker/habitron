import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { Goal, Habit, HabitDraft } from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { SPACING, type Colors } from '../constants/theme';
import { OptionChips } from './OptionChips';
import { useThemedStyles } from '../hooks/useColors';

interface HabitEditorModalProps {
  visible: boolean;
  habit?: Habit | null;
  goals: Goal[];
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
  goals,
  onClose,
  onSave,
}: HabitEditorModalProps) {
  const [styles] = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');
  const [goalId, setGoalId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(habit?.name ?? '');
    setReason(habit?.reason ?? '');
    setFrequency(habit?.frequency ?? 'daily');
    setTimeOfDay(habit?.timeOfDay ?? 'anytime');
    setGoalId(habit?.goalId);
  }, [visible, habit]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        reason: reason.trim() || undefined,
        frequency,
        timeOfDay,
        goalId,
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
              onChange={setFrequency}
            />
          </View>

          <View style={styles.section}>
            <Label>When</Label>
            <OptionChips
              options={TIME_OPTIONS}
              selectedValue={timeOfDay}
              onChange={setTimeOfDay}
            />
          </View>

          <View style={styles.section}>
            <Label>Goal</Label>
            <OptionChips
              options={[
                { label: 'No goal', value: 'none' as const },
                ...goals
                  .filter((goal) => goal.status === 'active')
                  .map((goal) => ({ label: goal.title, value: goal.id })),
              ]}
              selectedValue={goalId ?? 'none'}
              onChange={(value) => setGoalId(value === 'none' ? undefined : value)}
            />
          </View>

          <Caption>
            Long-press habits later if you want to change the icon from the main list.
          </Caption>
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
