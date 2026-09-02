import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Priority, TodoList, TodoTag } from '@habits-coach/shared';
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
            {content.onCreate ? <NewTagRow onCreate={content.onCreate} /> : null}
          </ScrollView>
        )}
      </View>
    </>
  );
}

/** The last row of the tag picker: a pill that becomes a field when tapped. */
function NewTagRow({ onCreate }: { onCreate: (tagName: string) => void }) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [isTyping, setIsTyping] = useState(false);
  const [name, setName] = useState('');
  const committed = useRef(false);

  if (!isTyping) {
    return (
      <Pressable
        style={styles.newTag}
        onPress={() => {
          committed.current = false;
          setIsTyping(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="New category"
      >
        <Text style={styles.newTagLabel}>New category…</Text>
      </Pressable>
    );
  }

  // Submitting also blurs, so the ref keeps one name from creating two tags.
  const commit = () => {
    const next = name.trim();
    setIsTyping(false);
    setName('');
    if (next && !committed.current) {
      committed.current = true;
      onCreate(next);
    }
  };

  return (
    <TextInput
      style={[styles.newTag, styles.newTagInput]}
      value={name}
      onChangeText={setName}
      placeholder="Category name"
      placeholderTextColor={colors.textLight}
      autoFocus
      returnKeyType="done"
      onSubmitEditing={commit}
      onBlur={commit}
      accessibilityLabel="New category name"
    />
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
    newTag: {
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    newTagLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    newTagInput: {
      ...TYPOGRAPHY.caption,
      minWidth: 120,
      color: colors.text,
    },
  });
