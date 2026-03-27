import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { Goal, TimeBlock, Todo, TodoDraft, TodoList } from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { SPACING, BORDER_RADIUS, type Colors } from '../constants/theme';
import { OptionChips } from './OptionChips';
import { QuickDatePickerModal } from './QuickDatePickerModal';
import { formatRelativeDateLabel } from '../utils/dateUtils';
import { useThemedStyles } from '../hooks/useColors';

interface TodoEditorModalProps {
  visible: boolean;
  todo?: Todo | null;
  lists: TodoList[];
  goals: Goal[];
  onClose: () => void;
  onSave: (draft: TodoDraft) => Promise<void>;
}

const PRIORITY_OPTIONS = [
  { label: 'Urgent', value: 1 as const },
  { label: 'High', value: 2 as const },
  { label: 'Normal', value: 3 as const },
  { label: 'Low', value: 4 as const },
];

const BLOCK_OPTIONS = [
  { label: 'No block', value: 'none' as const },
  { label: 'Morning', value: 'morning' as const },
  { label: 'Afternoon', value: 'afternoon' as const },
  { label: 'Evening', value: 'evening' as const },
];

export function TodoEditorModal({
  visible,
  todo,
  lists,
  goals,
  onClose,
  onSave,
}: TodoEditorModalProps) {
  const [styles] = useThemedStyles(createStyles);
  const initialListName = useMemo(() => {
    const list = lists.find((candidate) => candidate.id === todo?.listId);
    return list?.name ?? lists.find((candidate) => candidate.isInbox)?.name ?? 'Inbox';
  }, [lists, todo?.listId]);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [listName, setListName] = useState(initialListName);
  const [tagNamesText, setTagNamesText] = useState('');
  const [goalId, setGoalId] = useState<string | undefined>();
  const [priority, setPriority] = useState<number | undefined>();
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [scheduledDate, setScheduledDate] = useState<string | undefined>();
  const [scheduledBlock, setScheduledBlock] = useState<TimeBlock | undefined>();
  const [estimateMinutes, setEstimateMinutes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingDateField, setEditingDateField] = useState<'due' | 'scheduled' | null>(null);

  useEffect(() => {
    if (!visible) return;

    const currentList = lists.find((candidate) => candidate.id === todo?.listId);
    setTitle(todo?.title ?? '');
    setNotes(todo?.notes ?? '');
    setListName(currentList?.name ?? lists.find((candidate) => candidate.isInbox)?.name ?? 'Inbox');
    setTagNamesText(todo?.tags.map((tag) => tag.name).join(', ') ?? '');
    setGoalId(todo?.goalId);
    setPriority(todo?.priority);
    setDueDate(todo?.dueDate);
    setScheduledDate(todo?.scheduledDate);
    setScheduledBlock(todo?.scheduledBlock);
    setEstimateMinutes(todo?.estimateMinutes ? String(todo.estimateMinutes) : '');
  }, [visible, todo, lists]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim() || undefined,
        listName: listName.trim() || undefined,
        tagNames: tagNamesText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        goalId,
        priority: priority as 1 | 2 | 3 | 4 | undefined,
        dueDate,
        scheduledDate,
        scheduledBlock,
        estimateMinutes: estimateMinutes.trim()
          ? Number.parseInt(estimateMinutes.trim(), 10)
          : undefined,
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
              {todo ? 'Edit Task' : 'New Task'}
            </HeadingLarge>

            <Input
              label="Title"
              placeholder="What needs to happen?"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <Input
              label="Notes"
              placeholder="Context, links, or details"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <Input
              label="List"
              placeholder="Inbox, Work, Personal..."
              value={listName}
              onChangeText={setListName}
            />
            <Input
              label="Tags"
              placeholder="admin, deep work, errands"
              value={tagNamesText}
              onChangeText={setTagNamesText}
            />

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

            <View style={styles.section}>
              <Label>Priority</Label>
              <OptionChips
                options={PRIORITY_OPTIONS}
                selectedValue={priority}
                onChange={(value) => setPriority(value)}
              />
            </View>

            <View style={styles.section}>
              <Label>Scheduled Block</Label>
              <OptionChips
                options={BLOCK_OPTIONS}
                selectedValue={scheduledBlock ?? 'none'}
                onChange={(value) => setScheduledBlock(value === 'none' ? undefined : value)}
              />
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Label>Due Date</Label>
                <Button
                  title={dueDate ? formatRelativeDateLabel(dueDate) : 'No date'}
                  variant="outline"
                  onPress={() => setEditingDateField('due')}
                  size="sm"
                />
              </View>
              <View style={styles.dateField}>
                <Label>Scheduled Date</Label>
                <Button
                  title={scheduledDate ? formatRelativeDateLabel(scheduledDate) : 'No date'}
                  variant="outline"
                  onPress={() => setEditingDateField('scheduled')}
                  size="sm"
                />
              </View>
            </View>

            <Input
              label="Estimate (minutes)"
              placeholder="25"
              value={estimateMinutes}
              onChangeText={setEstimateMinutes}
              keyboardType="numeric"
            />

            <Caption>
              Save once and you can keep rescheduling this task from the Today screen.
            </Caption>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={onClose}
              size="md"
            />
            <Button
              title={todo ? 'Save Changes' : 'Create Task'}
              onPress={handleSave}
              loading={isSaving}
              disabled={!title.trim()}
              size="md"
            />
          </View>
        </View>
      </Modal>

      <QuickDatePickerModal
        visible={editingDateField === 'due'}
        title="Choose due date"
        selectedDate={dueDate}
        onSelectDate={setDueDate}
        onClose={() => setEditingDateField(null)}
      />
      <QuickDatePickerModal
        visible={editingDateField === 'scheduled'}
        title="Choose scheduled date"
        selectedDate={scheduledDate}
        onSelectDate={setScheduledDate}
        onClose={() => setEditingDateField(null)}
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
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  dateField: {
    flex: 1,
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
