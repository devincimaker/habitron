import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesiredHabit, DesiredHabitDraft } from '@habits-coach/shared';
import {
  BORDER_RADIUS,
  LIST_ITEM,
  SPACING,
  STATUS_INDICATOR,
  TOUCH_TARGET,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useDesiredHabitsStore } from '../stores/useDesiredHabitsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { describeDesiredHabit } from '../utils/desiredHabits';
import { getHabitIconAccentColor, resolveHabitIcon } from '../utils/habitIcons';
import { DesiredHabitSheet } from './DesiredHabitSheet';

interface DesiredHabitsSectionProps {
  /**
   * Hands a saved desired habit to the screen, which opens the habit editor
   * with its title prefilled and links whatever gets created.
   */
  onStartHabit: (desired: DesiredHabit) => void;
}

function reportFailure(error: unknown) {
  console.warn('Desired habit write failed:', error);
  Alert.alert('Could not save the desired habit', 'Please try again.');
}

/** Habits decided on but not started, at the foot of the Habits tab. */
export function DesiredHabitsSection({ onStartHabit }: DesiredHabitsSectionProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const desiredHabits = useDesiredHabitsStore((state) => state.desiredHabits);
  const addDesiredHabit = useDesiredHabitsStore((state) => state.addDesiredHabit);
  const updateDesiredHabit = useDesiredHabitsStore((state) => state.updateDesiredHabit);
  const removeDesiredHabit = useDesiredHabitsStore((state) => state.removeDesiredHabit);
  const habits = useHabitsStore((state) => state.habits);

  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(
    () => desiredHabits.find((desired) => desired.id === editingId) ?? null,
    [desiredHabits, editingId]
  );
  const linkedHabit = useMemo(
    () => habits.find((habit) => habit.id === editing?.habitId) ?? null,
    [habits, editing]
  );

  const openSheet = useCallback((id: string | null) => {
    setEditingId(id);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditingId(null);
  }, []);

  // The store shows every write before it lands and rolls it back if it fails,
  // so the sheet closes at once and a failure is only ever reported.
  const persist = useCallback(
    (draft: DesiredHabitDraft): Promise<DesiredHabit> => {
      if (editing) {
        return updateDesiredHabit(editing.id, { title: draft.title, note: draft.note ?? '' }).then(
          () => ({ ...editing, title: draft.title, note: draft.note })
        );
      }
      return addDesiredHabit(draft);
    },
    [addDesiredHabit, editing, updateDesiredHabit]
  );

  const handleSave = useCallback(
    (draft: DesiredHabitDraft) => {
      closeSheet();
      void persist(draft).catch(reportFailure);
    },
    [closeSheet, persist]
  );

  const handleStart = useCallback(
    (draft: DesiredHabitDraft) => {
      closeSheet();
      if (editing) {
        // The row exists, so the editor can open on it while the rename lands.
        void persist(draft).catch(reportFailure);
        onStartHabit({ ...editing, title: draft.title, note: draft.note });
        return;
      }
      // A new one has to land first: the editor's save writes the habit id to its row.
      void persist(draft).then(onStartHabit).catch(reportFailure);
    },
    [closeSheet, editing, onStartHabit, persist]
  );

  const handleRemove = useCallback(() => {
    closeSheet();
    if (editing) void removeDesiredHabit(editing.id).catch(reportFailure);
  }, [closeSheet, editing, removeDesiredHabit]);

  const handleClearHabit = useCallback(() => {
    if (editing) void updateDesiredHabit(editing.id, { habitId: null }).catch(reportFailure);
  }, [editing, updateDesiredHabit]);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} desired habits, ${desiredHabits.length} items`}
      >
        <Text style={styles.headerTitle}>Desired habits</Text>
        <Text style={styles.headerCount}>{desiredHabits.length}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textLight}
        />
      </Pressable>

      {expanded ? (
        <View>
          {desiredHabits.length === 0 ? (
            <Text style={styles.emptyCopy}>
              Nothing on the list yet. Write down a habit you want before you have room for it.
            </Text>
          ) : (
            desiredHabits.map((desired) => (
              <DesiredHabitRow
                key={desired.id}
                desired={desired}
                caption={describeDesiredHabit(desired, habits)}
                started={habits.some((habit) => habit.id === desired.habitId)}
                onPress={() => openSheet(desired.id)}
              />
            ))
          )}

          <Pressable
            style={styles.addRow}
            onPress={() => openSheet(null)}
            accessibilityRole="button"
            accessibilityLabel="Add a desired habit"
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={styles.addLabel}>Add a desired habit</Text>
          </Pressable>
        </View>
      ) : null}

      <DesiredHabitSheet
        visible={sheetOpen}
        desired={editing}
        linkedHabit={linkedHabit}
        onClose={closeSheet}
        onSave={handleSave}
        onRemove={handleRemove}
        onClearHabit={handleClearHabit}
        onStart={handleStart}
      />
    </View>
  );
}

interface DesiredHabitRowProps {
  desired: DesiredHabit;
  caption: string;
  /** A habit is standing in for it — the caption names that habit. */
  started: boolean;
  onPress: () => void;
}

/**
 * HabitItem's card geometry, dashed and without a shadow: nothing here is due
 * today and nothing here can be checked off.
 */
function DesiredHabitRow({ desired, caption, started, onPress }: DesiredHabitRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const icon = resolveHabitIcon(desired.title);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${desired.title}, ${caption}`}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={16}
          color={started ? (getHabitIconAccentColor(icon) ?? colors.primary) : colors.textLight}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{desired.title}</Text>
        <Text style={[styles.rowCaption, !started && styles.rowCaptionIdle]}>{caption}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginTop: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: TOUCH_TARGET.min,
      paddingHorizontal: SPACING.md + SPACING.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    headerTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    headerCount: {
      ...TYPOGRAPHY.caption,
      color: colors.textLight,
      flex: 1,
    },
    emptyCopy: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textLight,
      paddingHorizontal: LIST_ITEM.marginHorizontal,
      paddingTop: SPACING.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: LIST_ITEM.marginHorizontal,
      marginVertical: LIST_ITEM.marginVertical,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    rowIcon: {
      width: STATUS_INDICATOR.size,
      height: STATUS_INDICATOR.size,
      borderRadius: STATUS_INDICATOR.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
      backgroundColor: colors.surface,
    },
    rowText: {
      flex: 1,
      gap: SPACING.xs,
    },
    rowTitle: {
      ...TYPOGRAPHY.headingMedium,
      fontWeight: '500',
      color: colors.text,
    },
    rowCaption: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    rowCaptionIdle: {
      color: colors.textLight,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginHorizontal: LIST_ITEM.marginHorizontal,
      marginVertical: LIST_ITEM.marginVertical,
      minHeight: TOUCH_TARGET.min,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    addLabel: {
      ...TYPOGRAPHY.headingMedium,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
