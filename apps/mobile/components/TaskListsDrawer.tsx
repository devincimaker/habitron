import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useTaskListActions } from '../hooks/useTaskListActions';
import { useTaskListsUiStore } from '../stores/useTaskListsUiStore';
import { useTodosStore } from '../stores/useTodosStore';
import { TaskListRow } from './TaskListRow';

const OPEN_MS = 220;

/**
 * The Tasks tab's list switcher: a TickTick-style panel sliding over the whole
 * screen, header and tab bar included, which is why it mounts in the tab
 * layout rather than the tasks screen. Closed it renders nothing.
 */
export function TaskListsDrawer() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lists = useTodosStore((state) => state.lists);
  const todos = useTodosStore((state) => state.todos);
  const isDrawerOpen = useTaskListsUiStore((state) => state.isDrawerOpen);
  const activeListId = useTaskListsUiStore((state) => state.activeListId);
  const setActiveList = useTaskListsUiStore((state) => state.setActiveList);
  const closeDrawer = useTaskListsUiStore((state) => state.closeDrawer);
  const { promptCreateList, showListActions } = useTaskListActions();

  // Mounting lags the store flag so the close animation has something to run on.
  const [rendered, setRendered] = useState(false);
  const progress = useSharedValue(0);
  const panelWidth = Math.min(320, Math.round(width * 0.82));

  useEffect(() => {
    if (isDrawerOpen) {
      setRendered(true);
      progress.value = withTiming(1, { duration: OPEN_MS });
    } else {
      progress.value = withTiming(0, { duration: OPEN_MS }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
  }, [isDrawerOpen, progress]);

  const openCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const todo of todos) {
      if (todo.status !== 'open') continue;
      counts[todo.listId] = (counts[todo.listId] ?? 0) + 1;
    }
    return counts;
  }, [todos]);

  // The panel tracks a leftward drag and lets go past 40% travel or on a flick.
  const closePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-12)
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          progress.value = Math.min(1, Math.max(0, 1 + event.translationX / panelWidth));
        })
        .onEnd((event) => {
          if (progress.value < 0.6 || event.velocityX < -500) {
            runOnJS(closeDrawer)();
          } else {
            progress.value = withTiming(1, { duration: 160 });
          }
        }),
    [closeDrawer, panelWidth, progress]
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * panelWidth }],
  }));

  if (!rendered) return null;

  return (
    <GestureDetector gesture={closePan}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDrawer}
            accessibilityRole="button"
            accessibilityLabel="Close lists"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, paddingTop: insets.top + SPACING.md },
            panelStyle,
          ]}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}>
            {lists.map((list) => (
              <TaskListRow
                key={list.id}
                list={list}
                count={openCounts[list.id] ?? 0}
                isSelected={activeListId === list.id || (activeListId === null && list.isInbox)}
                onPress={() => {
                  setActiveList(list.isInbox ? null : list.id);
                  closeDrawer();
                }}
                onLongPress={list.isInbox ? undefined : () => showListActions(list)}
              />
            ))}

            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}
              onPress={promptCreateList}
              accessibilityRole="button"
              accessibilityLabel="Add list"
            >
              <Ionicons name="add" size={20} color={colors.textSecondary} style={styles.addIcon} />
              <Text style={styles.addLabel}>Add list</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.sm,
  },
  addRowPressed: {
    opacity: 0.7,
  },
  addIcon: {
    width: 18,
    marginRight: SPACING.md,
  },
  addLabel: {
    ...TYPOGRAPHY.label,
    color: colors.textSecondary,
  },
});
