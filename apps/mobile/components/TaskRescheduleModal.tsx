import { useEffect, useState } from 'react';
import type { Todo } from '@habits-coach/shared';
import { DatePickerModal } from './DatePickerModal';
import { TaskDateActionsPopup } from './TaskDateActionsPopup';
import { useTodoReschedule } from '../hooks/useTodoReschedule';

interface TaskRescheduleModalProps {
  /** The task being rescheduled; null keeps the flow closed. */
  todo: Todo | null;
  onClose: () => void;
}

/** Swipe-action date flow: one-tap shortcuts, with a full calendar behind "Pick Date". */
export function TaskRescheduleModal({ todo, onClose }: TaskRescheduleModalProps) {
  const rescheduleTodo = useTodoReschedule();
  const [isPickingDate, setIsPickingDate] = useState(false);

  useEffect(() => {
    if (!todo) setIsPickingDate(false);
  }, [todo]);

  const applyDate = (date?: string) => {
    if (todo) void rescheduleTodo(todo, date);
    onClose();
  };

  return (
    <>
      <TaskDateActionsPopup
        visible={!!todo && !isPickingDate}
        selectedDate={todo?.scheduledDate}
        onSelectDate={applyDate}
        onPickDate={() => setIsPickingDate(true)}
        onClear={() => applyDate(undefined)}
        onClose={onClose}
      />

      <DatePickerModal
        visible={!!todo && isPickingDate}
        title="Schedule task"
        value={todo?.scheduledDate}
        showQuickOptions
        onCancel={onClose}
        onDone={applyDate}
        onClear={todo?.scheduledDate ? () => applyDate(undefined) : undefined}
      />
    </>
  );
}
