import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { HabitSection, HabitWithStatus } from '@habits-coach/shared';
import { HabitItem } from './HabitItem';
import { RoutineHeader } from './RoutineHeader';
import {
  BORDER_RADIUS,
  SPACING,
  STATUS_INDICATOR,
  TAB_BAR,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import type { HabitOrderUpdate } from '../services/habits';
import { buildHabitRows, resolveOrderFromRows, type HabitRow } from '../utils/habitOrder';

/** How long a finger rests on a card before it lifts. Shared by the row's hold and the list's pan. */
const DRAG_HOLD_MS = 250;

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
  onPressRoutine: (sectionId: string) => void;
  /** Outlined after a routine takeover hands over to the list. */
  highlightHabitId?: string;
}

export interface HabitSectionListHandle {
  scrollToSection: (sectionId: string) => void;
}

export const HabitSectionList = forwardRef<HabitSectionListHandle, HabitSectionListProps>(
  function HabitSectionList({
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
  onPressRoutine,
  highlightHabitId,
}: HabitSectionListProps, ref) {
  const [styles] = useThemedStyles(createStyles);
  const listRef = useRef<FlatList<Row> | null>(null);

  // Per instance: a gesture object carries handler state, so a module-level one
  // shared between mounts silently stops recognising. This pan only *tracks* a
  // drag; each row's hold is what starts one (see DraggableHabitRow).
  const dragPan = useMemo(() => Gesture.Pan().activateAfterLongPress(DRAG_HOLD_MS), []);

  // Every routine is always in the data, including the empty ones; only their
  // visibility depends on the drag. See habitOrder.ts for why they cannot be
  // inserted on drag start instead.
  const rows = useMemo(() => buildHabitRows(sections, habits), [habits, sections]);
  const sectionsById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections]
  );

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
  //
  // Every JS function crosses back as a runOnJS *target*, never as an argument:
  // inside a worklet onDragStart is only a remote-function placeholder, and
  // passing it through runOnJS's arguments hands the JS thread a plain object
  // in a Release build (dev builds keep a back-reference, which is why the
  // simulator never showed it). See HAB-141.
  const handleDragStart = useCallback(() => {
    'worklet';
    runOnJS(dragHaptic)();
    runOnJS(onDragStart)();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    'worklet';
    runOnJS(onDragEnd)();
  }, [onDragEnd]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      // Only habit rows carry the hold that starts a drag, so headers and
      // placeholders cannot be picked up and the routine boundaries stay put.
      // A hidden row still renders a (zero-height) view: ReorderableList wraps
      // every cell in an animated view it measures, and a null cell throws in
      // the worklet that drives the drag.
      if (item.type === 'header') {
        if (item.idleHidden && !isDragging) return <View />;
        // The trailing "No routine" bucket is not a section, so it has nothing
        // to open and no alarm to carry — the header renders as a bare title.
        return (
          <RoutineHeader
            title={item.title}
            section={item.sectionId ? sectionsById.get(item.sectionId) : undefined}
            onPress={onPressRoutine}
          />
        );
      }
      if (item.type === 'placeholder') {
        return isDragging ? <View style={styles.placeholder} /> : <View />;
      }
      return (
        <DraggableHabitRow
          dragPan={dragPan}
          habit={item.habit}
          onStatusChange={onStatusChange}
          onCheckIn={onCheckIn}
          onPress={onPressHabit}
          highlighted={item.habit.id === highlightHabitId}
        />
      );
    },
    [
      dragPan,
      isDragging,
      onCheckIn,
      onPressHabit,
      highlightHabitId,
      onPressRoutine,
      onStatusChange,
      sectionsById,
      styles,
    ]
  );

  // The handle reads the rows through a ref, so it is built once instead of on
  // every check-in — a new handle object would re-run the parent's effects.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useImperativeHandle(ref, () => ({
    scrollToSection: (sectionId) => {
      const index = rowsRef.current.findIndex(
        (row) => row.type === 'header' && row.sectionId === sectionId
      );
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    },
  }), []);

  // VirtualizedList throws on scrollToIndex past the last measured row, which is
  // every routine below the fold on a list that has only just mounted — exactly
  // the case the routine takeover hands over in. Scroll to the offset it guessed
  // and try again once those rows have been measured.
  const handleScrollToIndexFailed = useCallback(
    ({ index, averageItemLength }: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
      }, 100);
    },
    []
  );

  return (
    <ReorderableList
      ref={listRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={(item: Row) => item.key}
      panGesture={dragPan}
      onReorder={handleReorder}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onScrollToIndexFailed={handleScrollToIndexFailed}
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
});

/** Runs on the JS thread: Haptics is not available inside a worklet. */
function dragHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

interface DraggableHabitRowProps extends HabitItemProps {
  dragPan: PanGesture;
}

// The list's pan never starts a drag on its own: ReorderableList moves a cell
// only after that cell's drag handler has run. So each habit row owns a hold
// that fires it. The hold must be declared simultaneous with the list's pan —
// by default an activating gesture cancels every other one on the touch, and
// that is exactly what left the card lifted but unmovable. HabitItem's own
// swipe pan needs 20pt of horizontal travel, so a stationary hold never trips
// it, and once the hold activates the swipe and the tap are cancelled.
function DraggableHabitRow({ dragPan, ...itemProps }: DraggableHabitRowProps) {
  const drag = useReorderableDrag();
  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(DRAG_HOLD_MS)
        .simultaneousWithExternalGesture(dragPan)
        .onStart(() => {
          'worklet';
          runOnJS(drag)();
        }),
    [drag, dragPan]
  );

  return (
    <GestureDetector gesture={hold}>
      <View>
        <HabitItem {...itemProps} />
      </View>
    </GestureDetector>
  );
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
