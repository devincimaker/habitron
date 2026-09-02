import type { Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** The quick-create sheet's action size, so the two rows read as one family. */
const BUTTON_SIZE = 32;

interface TaskSheetBottomBarProps {
  /** Tints the checklist button while the task has items. */
  hasChecklist: boolean;
  /** Anchors for the pickers that float above their buttons. */
  categoryRef?: Ref<View>;
  listRef?: Ref<View>;
  goalRef?: Ref<View>;
  onPressCategory: () => void;
  onPressList: () => void;
  /** Absent while the goals module is off, and the button goes with it. */
  onPressGoal?: () => void;
  onPressEstimate: () => void;
  onPressChecklist: () => void;
}

/**
 * The sheet's action row, in the quick-create vocabulary: 32pt buttons that
 * open a picker rather than a field.
 */
export function TaskSheetBottomBar({
  hasChecklist,
  categoryRef,
  listRef,
  goalRef,
  onPressCategory,
  onPressList,
  onPressGoal,
  onPressEstimate,
  onPressChecklist,
}: TaskSheetBottomBarProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <View style={styles.bar}>
      <Pressable
        ref={categoryRef}
        style={styles.button}
        onPress={onPressCategory}
        accessibilityRole="button"
        accessibilityLabel="Category"
      >
        <Ionicons name="pricetag-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        ref={listRef}
        style={styles.button}
        onPress={onPressList}
        accessibilityRole="button"
        accessibilityLabel="List"
      >
        <Ionicons name="folder-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      {onPressGoal ? (
        <Pressable
          ref={goalRef}
          style={styles.button}
          onPress={onPressGoal}
          accessibilityRole="button"
          accessibilityLabel="Goal"
        >
          <Feather name="target" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      <Pressable
        style={styles.button}
        onPress={onPressEstimate}
        accessibilityRole="button"
        accessibilityLabel="Estimate"
      >
        <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        style={[styles.button, hasChecklist && styles.buttonActive]}
        onPress={onPressChecklist}
        accessibilityRole="button"
        accessibilityLabel="Checklist"
        accessibilityState={{ selected: hasChecklist }}
      >
        <Ionicons
          name="list-outline"
          size={20}
          color={hasChecklist ? colors.primaryDark : colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    button: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BORDER_RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonActive: {
      backgroundColor: colors.primaryLight,
    },
  });
