import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Todo } from '@habits-coach/shared';
import type { TaskRowDragMoveEvent, TaskRowDragStartEvent } from '../components/TaskRow';
import type { TodoOrderUpdate } from '../services/todos';
import { getRowShift, resolveDropIndex, type RowFrame } from '../utils/taskDrag';
import { redealTodoPositions } from '../utils/todoOrder';

/** The floating clone: the task, where it came from, its size, and where it sits inside the root view. */
export interface TaskDragState {
  todo: Todo;
  /** Index in `items`, or -1 for a row from another section, which can cross the list but never join it. */
  fromIndex: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

/** What TaskDragList needs from the hook to track and shift its rows. */
export interface TaskDragListBinding {
  listRef: React.RefObject<View | null>;
  setRowLayout: (id: string, event: LayoutChangeEvent) => void;
  rowShift: (index: number) => number;
}

interface TaskListDragOptions {
  /** The reorderable rows, in the order they are on screen. */
  items: Todo[];
  onReorder: (updates: TodoOrderUpdate[]) => void;
}

/**
 * Hand-rolled drag for a list of TaskRows: the row's own pan gesture reports
 * window coordinates, this turns them into a clone position, a drop index in
 * `items`, and the redeal that writes it. Not react-native-reorderable-list,
 * which the habit list uses: the Calendar needs a drop target *outside* its
 * list (the date strip), and TaskRow already owns the pan. A screen with such
 * a second target passes `suppressed` while the pointer is over it, so
 * exactly one target is ever active.
 *
 * Row frames come from each row's `onLayout` relative to `listRef`. They are
 * fixed to window coordinates once, on drag start — scrolling is disabled for
 * the drag, so they hold until the drop — and every pointer frame after that
 * is one `resolveDropIndex`.
 */
export function useTaskListDrag({ items, onReorder }: TaskListDragOptions) {
  const rootRef = useRef<View>(null);
  const listRef = useRef<View>(null);
  const rootFrameRef = useRef({ x: 0, y: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const rowLayoutsRef = useRef(new Map<string, RowFrame>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const framesRef = useRef<{ from: number; frames: RowFrame[] } | null>(null);
  const [dragState, setDragState] = useState<TaskDragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onRootLayout = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootFrameRef.current = { x, y };
    });
  }, []);

  const setRowLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rowLayoutsRef.current.set(id, { top: y, height });
  }, []);

  const resolveDrop = (pointerY: number, suppressed: boolean) => {
    const drag = framesRef.current;
    return drag && !suppressed ? resolveDropIndex(drag.frames, drag.from, pointerY) : null;
  };

  const start = useCallback((todo: Todo, event: TaskRowDragStartEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = itemsRef.current;
    const from = current.findIndex((item) => item.id === todo.id);

    framesRef.current = null;
    setDropIndex(null);
    if (from !== -1) {
      listRef.current?.measureInWindow((_x, listTop) => {
        const frames = current.map((item) => {
          const layout = rowLayoutsRef.current.get(item.id);
          return { top: (layout?.top ?? 0) + listTop, height: layout?.height ?? 0 };
        });
        framesRef.current = { from, frames };
      });
    }
    grabOffsetRef.current = { x: event.absoluteX - event.x, y: event.absoluteY - event.y };
    setDragState({
      todo,
      fromIndex: from,
      width: event.width,
      height: event.height,
      left: event.x - rootFrameRef.current.x,
      top: event.y - rootFrameRef.current.y,
    });
  }, []);

  const move = useCallback((_todo: Todo, event: TaskRowDragMoveEvent, suppressed = false) => {
    setDragState((current) =>
      current
        ? {
            ...current,
            left: event.absoluteX - grabOffsetRef.current.x - rootFrameRef.current.x,
            top: event.absoluteY - grabOffsetRef.current.y - rootFrameRef.current.y,
          }
        : current
    );

    const next = resolveDrop(event.absoluteY, suppressed);
    setDropIndex((previous) => {
      if (previous !== next && next !== null && next !== framesRef.current?.from) {
        void Haptics.selectionAsync();
      }
      return next;
    });
  }, []);

  const end = useCallback(
    (_todo: Todo, event: TaskRowDragMoveEvent, suppressed = false) => {
      const drag = framesRef.current;
      const to = resolveDrop(event.absoluteY, suppressed);

      framesRef.current = null;
      setDropIndex(null);
      setDragState(null);

      if (drag && to !== null && to !== drag.from) {
        onReorder(redealTodoPositions(itemsRef.current, drag.from, to));
      }
    },
    [onReorder]
  );

  const rowShift = (index: number) =>
    dragState && dropIndex !== null
      ? getRowShift(index, dragState.fromIndex, dropIndex, dragState.height)
      : 0;

  const list: TaskDragListBinding = { listRef, setRowLayout, rowShift };

  return { rootRef, onRootLayout, dragState, start, move, end, list };
}
