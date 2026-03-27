import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { Goal, GoalDraft } from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { SPACING, type Colors } from '../constants/theme';
import { OptionChips } from './OptionChips';
import { QuickDatePickerModal } from './QuickDatePickerModal';
import { formatRelativeDateLabel } from '../utils/dateUtils';
import { useThemedStyles } from '../hooks/useColors';

interface GoalEditorModalProps {
  visible: boolean;
  goal?: Goal | null;
  onClose: () => void;
  onSave: (draft: GoalDraft) => Promise<void>;
}

const PRIORITY_OPTIONS = [
  { label: 'Urgent', value: 1 as const },
  { label: 'High', value: 2 as const },
  { label: 'Normal', value: 3 as const },
  { label: 'Low', value: 4 as const },
];

export function GoalEditorModal({
  visible,
  goal,
  onClose,
  onSave,
}: GoalEditorModalProps) {
  const [styles] = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<string | undefined>();
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(goal?.title ?? '');
    setDescription(goal?.description ?? '');
    setTargetDate(goal?.targetDate);
    setPriority(goal?.priority);
  }, [visible, goal]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate,
        priority,
        status: goal?.status ?? 'active',
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <HeadingLarge style={styles.title}>
              {goal ? 'Edit Goal' : 'New Goal'}
            </HeadingLarge>

            <Input
              label="Title"
              placeholder="What are you working toward?"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <Input
              label="Description"
              placeholder="Why this matters, what success looks like..."
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.section}>
              <Label>Priority</Label>
              <OptionChips
                options={PRIORITY_OPTIONS}
                selectedValue={priority}
                onChange={(value) => setPriority(value)}
              />
            </View>

            <View style={styles.section}>
              <Label>Target Date</Label>
              <Button
                title={targetDate ? formatRelativeDateLabel(targetDate) : 'No date'}
                variant="outline"
                onPress={() => setShowDatePicker(true)}
                size="sm"
              />
            </View>

            <Caption>
              Goals give Habitron longer-term context for habits, tasks, and planning.
            </Caption>
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Cancel" variant="ghost" onPress={onClose} size="md" />
            <Button
              title={goal ? 'Save Goal' : 'Create Goal'}
              onPress={handleSave}
              loading={isSaving}
              disabled={!title.trim()}
              size="md"
            />
          </View>
        </View>
      </Modal>

      <QuickDatePickerModal
        visible={showDatePicker}
        title="Choose target date"
        selectedDate={targetDate}
        onSelectDate={setTargetDate}
        onClose={() => setShowDatePicker(false)}
      />
    </>
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
