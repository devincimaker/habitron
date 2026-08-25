import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { HabitSection, HabitWithStatus } from '@habits-coach/shared';
import { HabitItem } from './HabitItem';
import {
  BORDER_RADIUS,
  SPACING,
  STATUS_INDICATOR,
  TAB_BAR,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import type { HabitOrderUpdate } from '../services/habits';
import { buildHabitRows, resolveOrderFromRows, type HabitRow } from '../utils/habitOrder';

type Row = HabitRow<HabitWithStatus>;
type HabitItemProps = React.ComponentProps<typeof HabitItem>;

interface HabitSectionListProps {
  sections: HabitSection[];
  habits: HabitWithStatus[];
  isDragging: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshTintColor: string;
  emptyComponent: React.ReactElement | null;
  /** Rendered under the last routine, above the trailing spacer. */
  footer: React.ReactElement;
  onRefresh: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onReorder: (updates: HabitOrderUpdate[]) => void;
  onStatusChange: HabitItemProps['onStatusChange'];
  onCheckIn: HabitItemProps['onCheckIn'];
  onPressHabit: (habitId: string) => void;
}

export function HabitSectionList({
  sections,
  habits,
  isDragging,
  isLoading,
  isRefreshing,
  refreshTintColor,
  emptyComponent,
  footer,
  onRefresh,
  onDragStart,
  onDragEnd,
  onReorder,
  onStatusChange,
  onCheckIn,
  onPressHabit,
}: HabitSectionListProps) {
  const [styles] = useThemedStyles(createStyles);

  // Per instance: a gesture object carries handler state, so a module-level one
  // shared between mounts silently stops recognising.
  const dragPan = useMemo(() => Gesture.Pan().activateAfterLongPress(250), []);

  // Every routine is always in the data, including the empty ones; only their
  // visibility depends on the drag. See habitOrder.ts for why they cannot be
  // inserted on drag start instead.
  const rows = useMemo(() => buildHabitRows(sections, habits), [habits, sections]);

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      const updates = resolveOrderFromRows(reorderItems(rows, from, to));
      if (updates.length) onReorder(updates);
    },
    [onReorder, rows]
  );

  // ReorderableList calls onDragStart and onDragEnd from its own worklets, on
  // the UI thread — a plain setState handler there aborts the runtime. onReorder
  // is the exception: it runs on the JS thread.
  const handleDragStart = useCallback(() => {
    'worklet';
    runOnJS(startDragFeedback)(onDragStart);
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    'worklet';
    runOnJS(onDragEnd)();
  }, [onDragEnd]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      // Headers and placeholders never call useReorderableDrag, so they cannot
      // be picked up and the routine boundaries stay put.
      // A hidden row still renders a (zero-height) view: ReorderableList wraps
      // every cell in an animated view it measures, and a null cell throws in
      // the worklet that drives the drag.
      if (item.type === 'header') {
        if (item.idleHidden && !isDragging) return <View />;
        return <Text style={styles.sectionHeader}>{item.title}</Text>;
      }
      if (item.type === 'placeholder') {
        return isDragging ? <View style={styles.placeholder} /> : <View />;
      }
      return (
        <HabitItem
          habit={item.habit}
          onStatusChange={onStatusChange}
          onCheckIn={onCheckIn}
          onPress={onPressHabit}
        />
      );
    },
    [isDragging, onCheckIn, onPressHabit, onStatusChange, styles]
  );

  return (
    <ReorderableList
      data={rows}
      renderItem={renderItem}
      keyExtractor={(item: Row) => item.key}
      // The list owns the hold that starts a drag. HabitItem's own swipe pan
      // only activates past 20px horizontally, so a stationary hold never trips
      // it and the two gestures stay out of each other's way.
      panGesture={dragPan}
      onReorder={handleReorder}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      // The card is lifted off the recess it leaves: scale and offset, no new
      // colour. No drop indicator — the floating card sits directly over the
      // landing slot for the whole drag, so a line drawn there would be under
      // the user's own card and never visible.
      cellAnimations={CELL_ANIMATIONS}
      ListEmptyComponent={isLoading ? null : emptyComponent}
      contentContainerStyle={styles.listContent}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={refreshTintColor}
        />
      }
      ListFooterComponent={
        <>
          {footer}
          <View style={styles.footer} />
        </>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

/** Runs on the JS thread: Haptics is not available inside a worklet. */
function startDragFeedback(notify: () => void) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  notify();
}

const CELL_ANIMATIONS = {
  transform: [{ scale: 1.03 }, { translateX: 8 }, { translateY: -6 }],
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
} as const;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionHeader: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    // The drop target an empty routine offers: a recess, not an indicator line.
    // Height tracks HabitItem's own content box — a 28pt status indicator
    // between SPACING.md padding, plus its hairline border.
    placeholder: {
      height: STATUS_INDICATOR.size + SPACING.md * 2 + 2,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
    },
    listContent: {
      paddingBottom: SPACING.md,
    },
    footer: {
      height: TAB_BAR.height + SPACING.xxl,
    },
  });
