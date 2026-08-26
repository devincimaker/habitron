import { useEffect, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Priority, TodoTag } from '@habits-coach/shared';
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
}

interface Placement {
  left: number;
  bottom: number;
  maxWidth: number;
}

/**
 * The one picker style the quick-create sheet uses: a card floating above the
 * action that opened it. It lives inside the sheet's own modal so the keyboard
 * stays up, and it is anchored from the sheet's bottom edge — the actions row
 * rides that edge, so the card stays put as the input grows or the keyboard
 * frame changes.
 */
export function TaskQuickCreatePopover({
  anchorRef,
  containerRef,
  content,
  onClose,
}: TaskQuickCreatePopoverProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;

    anchor.measureLayout(container, (x, y) => {
      container.measure((_x, _y, width, height) => {
        setPlacement({
          left: x,
          bottom: height - y + SPACING.xs,
          maxWidth: width - x - SPACING.md,
        });
      });
    });
  }, [anchorRef, containerRef]);

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
        ) : (
          <View style={styles.tagRow}>
            {content.tags.map((tag) => (
              <TodoTagPill
                key={tag.id}
                name={tag.name}
                color={tag.color}
                onPress={() => content.onSelect(tag.name)}
              />
            ))}
          </View>
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
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      padding: SPACING.xs,
    },
  });
