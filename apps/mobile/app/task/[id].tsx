import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChecklistItem, ChecklistItemDraft, Priority } from '@habits-coach/shared';
import { TaskQuickCreatePopover } from '../../components/TaskQuickCreatePopover';
import { TaskSheetBottomBar } from '../../components/TaskSheetBottomBar';
import { TaskSheetChecklist } from '../../components/TaskSheetChecklist';
import { TaskSheetActualAsk } from '../../components/TaskSheetActualAsk';
import { TaskSheetChips } from '../../components/TaskSheetChips';
import { TaskSheetDateLine } from '../../components/TaskSheetDateLine';
import { TaskSheetHeader } from '../../components/TaskSheetHeader';
import { TaskSheetModals, type TaskSheetModal } from '../../components/TaskSheetModals';
import { TaskSheetTextField } from '../../components/TaskSheetTextField';
import { useTaskSheetActions } from '../../hooks/useTaskSheetActions';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useTodosStore } from '../../stores/useTodosStore';
import { useModuleEnabled } from '../../hooks/useModuleEnabled';
import { isGoalOpen } from '../../utils/goals';
import { SPACING, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

type Picker = 'priority' | 'tag' | 'list' | 'goal' | TaskSheetModal | null;

const MODALS: readonly Picker[] = ['dateActions', 'datePicker', 'time', 'estimate'];
const isModal = (picker: Picker): picker is TaskSheetModal => MODALS.includes(picker);

/**
 * The checklist as a draft, so one item's edit can be sent as the whole list.
 * `done` has to come along: the write replaces every row, and a draft without
 * it stores `false`, which would untick the rest of the list on every rename.
 */
const toDraft = (items: ChecklistItem[]): ChecklistItemDraft[] =>
  items.map((item) => ({ id: item.id, title: item.title, done: item.done }));

/**
 * One task, whole: its schedule, its title, its notes, its checklist.
 *
 * A document rather than a form — there is no Save, because every edit persists
 * on its own, and nothing here is a field waiting to be filled in.
 */
export default function TaskDetailSheet() {
  const [styles] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const todo = useTodosStore((state) => state.todos.find((item) => item.id === id) ?? null);
  const tags = useTodosStore((state) => state.tags);
  const lists = useTodosStore((state) => state.lists);
  const goalsEnabled = useModuleEnabled('goals');
  const goals = useGoalsStore((state) => state.goals);

  const dismiss = useCallback(() => router.back(), [router]);
  const { save, toggleStatus, setChecklistItemDone, remove } = useTaskSheetActions(todo, dismiss);

  // Non-null while the task is being completed and it carries an estimate:
  // the date line becomes the question the row already asks.
  const [askingMinutes, setAskingMinutes] = useState<number | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const closePicker = useCallback(() => setPicker(null), []);

  const sheetRef = useRef<View>(null);
  const flagRef = useRef<View>(null);
  const categoryRef = useRef<View>(null);
  const listRef = useRef<View>(null);
  const goalRef = useRef<View>(null);

  const checklist = useMemo(() => todo?.checklist ?? [], [todo?.checklist]);
  const hasChecklist = checklist.length > 0;

  /**
   * The write replaces the whole list, and it is not optimistic — so the next
   * edit has to start from what the store holds *now*, not from the snapshot
   * this render closed over. Adding two items in a row is faster than the round
   * trip, and building both from the same stale array deletes the first.
   */
  const editChecklist = useCallback(
    (edit: (items: ChecklistItem[]) => ChecklistItemDraft[]) => {
      // Read when the write runs, not when it is queued: adding two items in
      // quick succession means the second one edits the list the first saved.
      save(() => {
        const current =
          useTodosStore.getState().todos.find((item) => item.id === id)?.checklist ?? [];
        return { checklist: edit(current) };
      });
    },
    [id, save]
  );

  // The service resolves date and time from the change set alone, so sending
  // one without the other wipes it: a new date would drop the time, and a time
  // with no date would snap the task to today.
  const saveSchedule = useCallback(
    (schedule: { scheduledDate?: string; scheduledTime?: string }) =>
      save({
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledDate ? schedule.scheduledTime : undefined,
      }),
    [save]
  );

  // The route can outlive its task: deleting one leaves the sheet mounted for a
  // frame, and a stale deep link may name a task that is gone.
  if (!todo) return <View style={styles.sheet} />;

  return (
    <KeyboardAvoidingView
      style={styles.sheet}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View ref={sheetRef} style={styles.body} collapsable={false}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TaskSheetHeader
            ref={flagRef}
            priority={todo.priority}
            onPressPriority={() => setPicker('priority')}
            onPressDelete={remove}
          />

          {askingMinutes !== null && todo.estimateMinutes !== undefined ? (
            <TaskSheetActualAsk
              estimateMinutes={todo.estimateMinutes}
              minutes={askingMinutes}
              onChange={setAskingMinutes}
              onCancel={() => setAskingMinutes(null)}
              onConfirm={() => {
                setAskingMinutes(null);
                toggleStatus({ actualMinutes: askingMinutes });
              }}
            />
          ) : (
            <TaskSheetDateLine
              todo={todo}
              onToggleStatus={() => {
                if (todo.status === 'open' && todo.estimateMinutes) {
                  setAskingMinutes(todo.estimateMinutes);
                  return;
                }
                toggleStatus();
              }}
              onPressDate={() => setPicker('dateActions')}
              onPressTime={() => setPicker('time')}
            />
          )}

          <TaskSheetTextField
            value={todo.title}
            style={styles.title}
            placeholder="Title"
            accessibilityLabel="Task title"
            required
            onCommit={(title) => save({ title })}
          />

          <TaskSheetTextField
            value={todo.notes ?? ''}
            style={styles.notes}
            placeholder="Notes"
            accessibilityLabel="Notes"
            onCommit={(notes) => save({ notes })}
          />

          {hasChecklist || showChecklist ? (
            <TaskSheetChecklist
              items={checklist}
              autoFocusAdd={showChecklist && !hasChecklist}
              onToggleItem={setChecklistItemDone}
              onRenameItem={(itemId, title) =>
                editChecklist((items) =>
                  toDraft(items).map((item) => (item.id === itemId ? { ...item, title } : item))
                )
              }
              onRemoveItem={(itemId) =>
                editChecklist((items) => toDraft(items).filter((item) => item.id !== itemId))
              }
              onAddItem={(title) => editChecklist((items) => [...toDraft(items), { title }])}
            />
          ) : null}

          <TaskSheetChips
            todo={todo}
            list={lists.find((list) => list.id === todo.listId)}
            goal={goalsEnabled ? goals.find((goal) => goal.id === todo.goalId) : undefined}
            onPressTag={() => setPicker('tag')}
            onPressGoal={() => setPicker('goal')}
            onPressList={() => setPicker('list')}
            onPressEstimate={() => setPicker('estimate')}
          />
        </ScrollView>

        <View style={{ paddingBottom: insets.bottom || SPACING.sm }}>
          <TaskSheetBottomBar
            categoryRef={categoryRef}
            listRef={listRef}
            goalRef={goalRef}
            hasChecklist={hasChecklist}
            onPressCategory={() => setPicker('tag')}
            onPressList={() => setPicker('list')}
            onPressGoal={goalsEnabled ? () => setPicker('goal') : undefined}
            onPressEstimate={() => setPicker('estimate')}
            onPressChecklist={() => setShowChecklist(true)}
          />
        </View>

        {picker === 'priority' ? (
          <TaskQuickCreatePopover
            anchorRef={flagRef}
            containerRef={sheetRef}
            placement="below"
            onClose={closePicker}
            content={{
              kind: 'priority',
              selected: todo.priority,
              onSelect: (priority: Priority | undefined) => {
                closePicker();
                save({ priority });
              },
            }}
          />
        ) : null}

        {picker === 'list' ? (
          <TaskQuickCreatePopover
            anchorRef={listRef}
            containerRef={sheetRef}
            onClose={closePicker}
            content={{
              kind: 'lists',
              lists,
              selectedId: todo.listId,
              onSelect: (listId) => {
                closePicker();
                if (listId !== todo.listId) save({ listId });
              },
            }}
          />
        ) : null}

        {picker === 'goal' ? (
          <TaskQuickCreatePopover
            anchorRef={goalRef}
            containerRef={sheetRef}
            onClose={closePicker}
            content={{
              kind: 'goals',
              // A done goal takes no new tasks; the one this task already
              // serves stays offered so the tick has something to sit on.
              goals: goals.filter((goal) => isGoalOpen(goal) || goal.id === todo.goalId),
              selectedId: todo.goalId,
              onSelect: (goalId) => {
                closePicker();
                if (goalId !== todo.goalId) save({ goalId });
              },
            }}
          />
        ) : null}

        {picker === 'tag' ? (
          <TaskQuickCreatePopover
            anchorRef={categoryRef}
            containerRef={sheetRef}
            onClose={closePicker}
            content={{
              kind: 'tags',
              tags,
              onSelect: (tagName) => {
                closePicker();
                save({ tagName: todo.tag?.name === tagName ? null : tagName });
              },
              // A name the server has not seen is created by the update itself.
              onCreate: (tagName) => {
                closePicker();
                save({ tagName });
              },
            }}
          />
        ) : null}
      </View>

      <TaskSheetModals
        todo={todo}
        open={picker && isModal(picker) ? picker : null}
        onOpen={setPicker}
        onClose={closePicker}
        onSaveSchedule={saveSchedule}
        onSaveEstimate={(estimateMinutes) => save({ estimateMinutes })}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: colors.background,
    },
    body: {
      flex: 1,
      paddingHorizontal: SPACING.md,
    },
    content: {
      paddingBottom: SPACING.sm,
    },
    title: {
      ...TYPOGRAPHY.displayMedium,
      color: colors.textStrong,
      paddingBottom: SPACING.sm,
    },
    notes: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      paddingBottom: SPACING.sm + 4,
    },
  });
