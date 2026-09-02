import type { Todo } from '@habits-coach/shared';
import { DatePickerModal } from './DatePickerModal';
import { TaskDateActionsPopup } from './TaskDateActionsPopup';
import { TaskEstimateDialog } from './TaskEstimateDialog';
import { TimePickerModal } from './TimePickerModal';

export type TaskSheetModal = 'dateActions' | 'datePicker' | 'time' | 'estimate';

interface TaskSheetModalsProps {
  todo: Todo;
  /** Which modal is up, if any; the sheet's picker state narrowed to these four. */
  open: TaskSheetModal | null;
  onOpen: (modal: TaskSheetModal) => void;
  onClose: () => void;
  onSaveSchedule: (schedule: { scheduledDate?: string; scheduledTime?: string }) => void;
  onSaveEstimate: (estimateMinutes: number | undefined) => void;
}

/**
 * The task sheet's full-screen modals: the date actions, the calendar, the
 * time wheel and the estimate dialog. The floating pickers stay in the sheet,
 * since they anchor to its buttons; these cover the whole screen and do not.
 */
export function TaskSheetModals({
  todo,
  open,
  onOpen,
  onClose,
  onSaveSchedule,
  onSaveEstimate,
}: TaskSheetModalsProps) {
  return (
    <>
      <TaskDateActionsPopup
        visible={open === 'dateActions'}
        selectedDate={todo.scheduledDate}
        onSelectDate={(scheduledDate) => {
          onClose();
          onSaveSchedule({ scheduledDate, scheduledTime: todo.scheduledTime });
        }}
        onPickDate={() => onOpen('datePicker')}
        onClear={() => {
          onClose();
          onSaveSchedule({});
        }}
        onClose={onClose}
      />

      <DatePickerModal
        visible={open === 'datePicker'}
        title="Schedule"
        value={todo.scheduledDate}
        showQuickOptions
        onCancel={onClose}
        onDone={(scheduledDate) => {
          onClose();
          onSaveSchedule({ scheduledDate, scheduledTime: todo.scheduledTime });
        }}
      />

      <TimePickerModal
        visible={open === 'time'}
        value={todo.scheduledTime}
        onCancel={onClose}
        onDone={(scheduledTime) => {
          onClose();
          onSaveSchedule({ scheduledDate: todo.scheduledDate, scheduledTime });
        }}
        onClear={
          todo.scheduledTime
            ? () => {
                onClose();
                onSaveSchedule({ scheduledDate: todo.scheduledDate });
              }
            : undefined
        }
      />

      <TaskEstimateDialog
        visible={open === 'estimate'}
        minutes={todo.estimateMinutes}
        onCancel={onClose}
        onDone={(estimateMinutes) => {
          onClose();
          onSaveEstimate(estimateMinutes);
        }}
      />
    </>
  );
}
