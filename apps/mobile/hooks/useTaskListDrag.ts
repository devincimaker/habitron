import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Todo } from '@habits-coach/shared';
import type { TaskRowDragMoveEvent, TaskRowDragStartEvent } from '../components/TaskRow';
import type { TodoOrderUpdate } from '../services/todos';
import { getRowShift, resolveDropIndex, type RowFrame } from '../utils/taskDrag';
import { redealTodoPositions } from '../utils/todoOrder';

/** The floating clone: the task, its size, and where it sits inside the root view. */
export interface TaskDragState {
  todo: Todo;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
}

interface TaskListDragOptions {
  /** The reorderable rows, in the order they are on screen. */
  items: Todo[];
  onReorder: (updates: TodoOrderUpdate[]) => void;
}

/**
 * Hand-rolled drag for a list of TaskRows: the row's own pan gesture reports
 * window coordinates, this turns them into a clone position, a drop index in
 * `items`, and the redeal that writes it. A screen with a second target (the
 * Calendar's date strip) passes `suppressed` while the pointer is over that
 * target, so exactly one target is ever active.
 *
 * Row frames come from each row's `onLayout` relative to `listRef`, whose
 * window position is measured once on drag start — scrolling is disabled for
 * the drag, so that measurement holds until the drop.
 */
export function useTaskListDrag({ items, onReorder }: TaskListDragOptions) {
  const rootRef = useRef<View>(null);
  const listRef = useRef<View>(null);
  const rootFrameRef = useRef({ x: 0, y: 0 });
  const listTopRef = useRef(0);
  const rowLayoutsRef = useRef(new Map<string, RowFrame>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dropIndexRef = useRef<number | null>(null);
  const [dragState, setDragState] = useState<TaskDragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onRootLayout = useCallback((_event: LayoutChangeEvent) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootFrameRef.current = { x, y };
    });
  }, []);

  const setRowLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rowLayoutsRef.current.set(id, { top: y, height });
  }, []);

  const updateDropIndex = useCallback((todo: Todo, pointerY: number, suppressed: boolean) => {
    const current = itemsRef.current;
    const from = current.findIndex((item) => item.id === todo.id);
    let next: number | null = null;

    // A row from another section (Overdue) can cross the list but never join it.
    if (!suppressed && from !== -1) {
      const frames = current.map((item) => {
        const layout = rowLayoutsRef.current.get(item.id);
        return { top: (layout?.top ?? 0) + listTopRef.current, height: layout?.height ?? 0 };
      });
      next = resolveDropIndex(frames, from, pointerY);
    }

    if (dropIndexRef.current === next) return;
    dropIndexRef.current = next;
    setDropIndex(next);
    if (next !== null && next !== from) {
      void Haptics.selectionAsync();
    }
  }, []);

  const start = useCallback((todo: Todo, event: TaskRowDragStartEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.measureInWindow((_x, y) => {
      listTopRef.current = y;
    });
    dropIndexRef.current = null;
    setDropIndex(null);
    setDragState({
      todo,
      width: event.width,
      height: event.height,
      offsetX: event.absoluteX - event.x,
      offsetY: event.absoluteY - event.y,
      left: event.x - rootFrameRef.current.x,
      top: event.y - rootFrameRef.current.y,
    });
  }, []);

  const move = useCallback(
    (todo: Todo, event: TaskRowDragMoveEvent, suppressed = false) => {
      setDragState((current) =>
        current
          ? {
              ...current,
              left: event.absoluteX - current.offsetX - rootFrameRef.current.x,
              top: event.absoluteY - current.offsetY - rootFrameRef.current.y,
            }
          : current
      );
      updateDropIndex(todo, event.absoluteY, suppressed);
    },
    [updateDropIndex]
  );

  const end = useCallback(
    (todo: Todo, event: TaskRowDragMoveEvent, suppressed = false) => {
      updateDropIndex(todo, event.absoluteY, suppressed);
      const to = dropIndexRef.current;
      const from = itemsRef.current.findIndex((item) => item.id === todo.id);

      dropIndexRef.current = null;
      setDropIndex(null);
      setDragState(null);

      if (to !== null && to !== from) {
        onReorder(redealTodoPositions(itemsRef.current, from, to));
      }
    },
    [onReorder, updateDropIndex]
  );

  const fromIndex = dragState ? items.findIndex((item) => item.id === dragState.todo.id) : -1;
  const rowShift = useCallback(
    (index: number) =>
      dragState && dropIndex !== null ? getRowShift(index, fromIndex, dropIndex, dragState.height) : 0,
    [dragState, dropIndex, fromIndex]
  );

  return { rootRef, onRootLayout, listRef, setRowLayout, dragState, start, move, end, rowShift };
}
