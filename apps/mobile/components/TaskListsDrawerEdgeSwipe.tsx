import { useMemo, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTaskListsUiStore } from '../stores/useTaskListsUiStore';

/** Only touches starting this close to the left edge can open the drawer. */
const EDGE_WIDTH = 20;

/**
 * Wraps the tasks screen so a rightward fling from the left edge opens the
 * lists drawer. The hit slop keeps the gesture off the rest of the screen, a
 * rightward pan never collides with TaskRow's leftward swipe, and the vertical
 * fail offsets hand scrolls straight through.
 */
export function TaskListsDrawerEdgeSwipe({ children }: { children: ReactNode }) {
  const openDrawer = useTaskListsUiStore((state) => state.openDrawer);

  const edgePan = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ left: 0, width: EDGE_WIDTH })
        .activeOffsetX(12)
        .failOffsetY([-12, 12])
        .onStart(() => {
          runOnJS(openDrawer)();
        }),
    [openDrawer]
  );

  return <GestureDetector gesture={edgePan}>{children}</GestureDetector>;
}
