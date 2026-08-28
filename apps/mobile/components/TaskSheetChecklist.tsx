import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChecklistItem } from '@habits-coach/shared';
import { FONT_SIZES, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface TaskSheetChecklistProps {
  items: ChecklistItem[];
  /** Focuses the "Add item" field as soon as the section appears. */
  autoFocusAdd: boolean;
  onToggleItem: (itemId: string, done: boolean) => void;
  onRenameItem: (itemId: string, title: string) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: (title: string) => void;
}

/**
 * The task's checklist, one row per item and an "Add item" row under them.
 *
 * Every edit persists on its own — the sheet has no Save — so a row commits on
 * blur, and an item emptied to nothing is a deletion rather than a blank row.
 */
export function TaskSheetChecklist({
  items,
  autoFocusAdd,
  onToggleItem,
  onRenameItem,
  onRemoveItem,
  onAddItem,
}: TaskSheetChecklistProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [draft, setDraft] = useState('');
  const addRef = useRef<TextInput>(null);

  const commitDraft = useCallback(() => {
    const title = draft.trim();
    setDraft('');
    if (title) onAddItem(title);
    return title;
  }, [draft, onAddItem]);

  return (
    <View style={styles.section}>
      {items.map((item) => (
        <ChecklistRow
          key={item.id}
          item={item}
          onToggle={() => onToggleItem(item.id, !item.done)}
          onCommit={(title) => (title ? onRenameItem(item.id, title) : onRemoveItem(item.id))}
        />
      ))}

      <View style={styles.row}>
        <Ionicons name="add" size={20} color={colors.textLight} />
        <TextInput
          ref={addRef}
          style={[styles.input, styles.addInput]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add item"
          placeholderTextColor={colors.textLight}
          autoFocus={autoFocusAdd}
          returnKeyType="next"
          blurOnSubmit={false}
          // Return keeps the field open for the next item, which is how a list
          // gets written in one go.
          onSubmitEditing={() => {
            if (commitDraft()) addRef.current?.focus();
          }}
          onBlur={commitDraft}
          accessibilityLabel="Add a checklist item"
        />
      </View>
    </View>
  );
}

interface ChecklistRowProps {
  item: ChecklistItem;
  onToggle: () => void;
  onCommit: (title: string) => void;
}

function ChecklistRow({ item, onToggle, onCommit }: ChecklistRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [title, setTitle] = useState(item.title);

  return (
    <View style={[styles.row, styles.rowDivider]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.title}
        hitSlop={8}
      >
        <Ionicons
          name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={item.done ? colors.success : colors.textLight}
        />
      </Pressable>

      <TextInput
        style={[styles.input, item.done && styles.doneInput]}
        value={title}
        onChangeText={setTitle}
        onBlur={() => {
          const next = title.trim();
          if (next !== item.title) onCommit(next);
        }}
        accessibilityLabel={`Checklist item, ${item.title}`}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    section: {
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm + 4,
      minHeight: 40,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    input: {
      flex: 1,
      fontSize: FONT_SIZES.sm + 1,
      lineHeight: 20,
      color: colors.text,
      // A zero-height input on iOS swallows taps; the row's minHeight sets the
      // target, this keeps the text vertically centred inside it.
      paddingVertical: 10,
    },
    addInput: {
      color: colors.textLight,
    },
    doneInput: {
      color: colors.textLight,
      textDecorationLine: 'line-through',
    },
  });
