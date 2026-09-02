import { useEffect, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Goal, Priority, TodoList, TodoTag } from '@habits-coach/shared';
import { TaskNewTagRow } from './TaskNewTagRow';
import { TodoTagPill } from './TodoTagPill';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { TODO_PRIORITY_OPTIONS } from '../utils/todoPriority';

export type TaskQuickCreatePopoverContent =
  | {
      kind: 'priority';
      selected?: Priority;
      onSelect: (priority: Priority | undefined) => void;
    }
  | {
      kind: 'tags';
      tags: TodoTag[];
      onSelect: (tagName: string) => void;
      /** Offers a "New category…" field. Quick-create types `#` instead. */
      onCreate?: (tagName: string) => void;
    }
  | {
      kind: 'lists';
      lists: TodoList[];
      selectedId?: string;
      onSelect: (listId: string) => void;
    }
  | {
      kind: 'goals';
      goals: Goal[];
      selectedId?: string;
      /** `undefined` unlinks: not every task serves a goal. */
      onSelect: (goalId: string | undefined) => void;
    };

interface TaskQuickCreatePopoverProps {
  /** The action button the card floats above. */
  anchorRef: RefObject<View | null>;
  /** The sheet the card is positioned in; it must be rendered inside it. */
  containerRef: RefObject<View | null>;
  content: TaskQuickCreatePopoverContent;
  /**
   * Tapping the sheet outside the card closes it. Left out while the card
   * follows inline `#` typing, so the input stays tappable and the context decides.
   */
  onClose?: () => void;
  /**
   * Which edge the card hangs from. `above` is the quick-create actions row,
   * which rides the sheet's bottom edge; `below` is for an anchor near the top,
   * where a card opening upward would have nowhere to go.
   */
  placement?: 'above' | 'below';
}

interface Placement {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  maxWidth: number;
}

/**
 * The one picker style the task sheets use: a card floating off the action that
 * opened it. It lives inside its sheet so the keyboard stays up, and it hangs
 * from whichever sheet edge its anchor rides — the bottom for the quick-create
 * actions row, the top for the detail sheet's flag — so the card stays put as
 * the content grows or the keyboard frame changes.
 */
export function TaskQuickCreatePopover({
  anchorRef,
  containerRef,
  content,
  onClose,
  placement: side = 'above',
}: TaskQuickCreatePopoverProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;

    anchor.measureLayout(container, (x, y, anchorWidth, anchorHeight) => {
      container.measure((_x, _y, width, height) => {
        setPlacement(
          side === 'above'
            ? // The quick-create actions ride the left edge, so the card grows
              // rightward from the anchor.
              {
                left: x,
                bottom: height - y + SPACING.xs,
                maxWidth: width - x - SPACING.md,
              }
            : // The sheet's flag sits at the right edge, so the card has to hang
              // leftward — anchored from `left` it would run off the screen.
              {
                right: width - x - anchorWidth,
                top: y + anchorHeight + SPACING.xs,
                maxWidth: x + anchorWidth - SPACING.md,
              }
        );
      });
    });
  }, [anchorRef, containerRef, side]);

  if (!placement) return null;

  const priorityRows =
    content.kind === 'priority'
      ? [
          ...TODO_PRIORITY_OPTIONS.map((option) => ({ ...option, icon: 'flag' as const })),
          {
            value: undefined,
            label: 'No priority',
            color: colors.textSecondary,
            icon: 'flag-outline' as const,
          },
        ]
      : [];

  return (
    <>
      {onClose ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close picker"
        />
      ) : null}

      <View style={[styles.card, placement]}>
        {content.kind === 'priority' ? (
          priorityRows.map((row) => {
            const isSelected = content.selected === row.value;
            return (
              <Pressable
                key={row.label}
                style={styles.priorityRow}
                onPress={() => content.onSelect(row.value)}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons name={row.icon} size={18} color={row.color} />
                <Text style={styles.priorityLabel}>{row.label}</Text>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
                ) : null}
              </Pressable>
            );
          })
        ) : content.kind === 'goals' ? (
          <ScrollView style={styles.listScroll} keyboardShouldPersistTaps="handled">
            {[...content.goals, undefined].map((goal) => {
              const isSelected = content.selectedId === goal?.id;
              return (
                <Pressable
                  key={goal?.id ?? 'none'}
                  style={styles.priorityRow}
                  onPress={() => content.onSelect(goal?.id)}
                  accessibilityRole="button"
                  accessibilityLabel={goal ? `Goal ${goal.title}` : 'No goal'}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Feather
                    name="target"
                    size={18}
                    color={goal ? colors.primary : colors.textSecondary}
                  />
                  <Text style={styles.priorityLabel} numberOfLines={1}>
                    {goal?.title ?? 'No goal'}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : content.kind === 'lists' ? (
          <ScrollView style={styles.listScroll} keyboardShouldPersistTaps="handled">
            {content.lists.map((list) => {
              const isSelected = content.selectedId === list.id;
              return (
                <Pressable
                  key={list.id}
                  style={styles.priorityRow}
                  onPress={() => content.onSelect(list.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`List ${list.name}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  {list.isInbox ? (
                    <Ionicons name="file-tray-outline" size={18} color={colors.textSecondary} />
                  ) : (
                    <View style={[styles.listDot, { backgroundColor: list.color ?? colors.textLight }]} />
                  )}
                  <Text style={styles.priorityLabel}>{list.name}</Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.tagScroll}
            contentContainerStyle={styles.tagRow}
            keyboardShouldPersistTaps="handled"
          >
            {content.tags.map((tag) => (
              <TodoTagPill
                key={tag.id}
                name={tag.name}
                color={tag.color}
                onPress={() => content.onSelect(tag.name)}
              />
            ))}
            {content.onCreate ? <TaskNewTagRow onCreate={content.onCreate} /> : null}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xs,
      ...SHADOWS.medium,
    },
    priorityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minWidth: 180,
      paddingVertical: 10,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
    },
    priorityLabel: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.text,
      flex: 1,
    },
    tagScroll: {
      maxHeight: 160,
    },
    listScroll: {
      maxHeight: 220,
    },
    listDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginHorizontal: 3,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      padding: SPACING.xs,
    },
  });
