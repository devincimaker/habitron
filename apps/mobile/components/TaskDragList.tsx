import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Todo } from '@habits-coach/shared';
import type { TaskDragListBinding } from '../hooks/useTaskListDrag';

interface TaskDragListProps {
  /** The reorderable rows, in the order they are on screen — the hook's `items`. */
  items: Todo[];
  drag: TaskDragListBinding;
  renderRow: (todo: Todo, index: number) => ReactNode;
}

/**
 * The rows of a reorderable list: each one reports its frame to the drag
 * hook and slides to open the gap at the drop index. Transforms do not affect
 * layout, so the reported frames stay the resting ones.
 */
export function TaskDragList({ items, drag, renderRow }: TaskDragListProps) {
  return (
    <View ref={drag.listRef}>
      {items.map((todo, index) => (
        <View
          key={todo.id}
          onLayout={(event) => drag.setRowLayout(todo.id, event)}
          style={{ transform: [{ translateY: drag.rowShift(index) }] }}
        >
          {renderRow(todo, index)}
        </View>
      ))}
    </View>
  );
}
