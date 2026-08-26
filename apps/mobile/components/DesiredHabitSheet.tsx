import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesiredHabit, DesiredHabitDraft, Habit } from '@habits-coach/shared';
import { Button, Input } from './ui';
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
import { getHabitIconAccentColor, resolveHabitIcon } from '../utils/habitIcons';
import { describeHabitSchedule } from '../utils/habitSchedule';

interface DesiredHabitSheetProps {
  visible: boolean;
  /** The desired habit being edited, or null when the sheet is creating one. */
  desired: DesiredHabit | null;
  /** The habit standing in for it, when there is one. */
  linkedHabit: Habit | null;
  onClose: () => void;
  onSave: (draft: DesiredHabitDraft) => Promise<void>;
  onRemove: () => Promise<void>;
  onClearHabit: () => Promise<void>;
  onStart: (draft: DesiredHabitDraft) => Promise<void>;
}

/** Bottom sheet for writing down a habit you want, and seeing what stands in for it. */
export function DesiredHabitSheet({
  visible,
  desired,
  linkedHabit,
  onClose,
  onSave,
  onRemove,
  onClearHabit,
  onStart,
}: DesiredHabitSheetProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(desired?.title ?? '');
    setNote(desired?.note ?? '');
  }, [visible, desired]);

  if (!visible) return null;

  const trimmedTitle = title.trim();
  const draft: DesiredHabitDraft = {
    title: trimmedTitle,
    note: note.trim() || undefined,
  };

  // Every caller is `void run(...)`, so a rejection here would surface as an
  // unhandled one rather than anything the user can act on.
  const run = async (action: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await action();
    } catch (error) {
      console.error('Desired habit action failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove desired habit',
      `Remove "${desired?.title ?? trimmedTitle}" from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void run(onRemove),
        },
      ]
    );
  };

  const habitIcon = linkedHabit ? resolveHabitIcon(linkedHabit.name, linkedHabit.icon) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Input
            label="Habit"
            value={title}
            onChangeText={setTitle}
            placeholder="What do you want to do?"
            autoFocus={!desired}
          />
          <Input
            label="Notes"
            value={note}
            onChangeText={setNote}
            placeholder="Why it is on the list, and anything it depends on"
            multiline
          />

          {linkedHabit && habitIcon ? (
            <View style={styles.linkBlock}>
              <Text style={styles.linkHeading}>Working on it</Text>
              <View style={styles.linkRow}>
                <View style={styles.linkIcon}>
                  <Ionicons
                    name={habitIcon}
                    size={18}
                    color={getHabitIconAccentColor(habitIcon) ?? colors.primary}
                  />
                </View>
                <View style={styles.linkText}>
                  <Text style={styles.linkName}>{linkedHabit.name}</Text>
                  <Text style={styles.linkSchedule}>{describeHabitSchedule(linkedHabit)}</Text>
                </View>
                <Pressable
                  onPress={() => void run(onClearHabit)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlink ${linkedHabit.name}`}
                  hitSlop={SPACING.sm}
                >
                  <Ionicons name="close" size={20} color={colors.textLight} />
                </Pressable>
              </View>
            </View>
          ) : (
            // No heading here on purpose: it would name a thing that does not
            // exist, and read as "pick something" — the one thing this asks for.
            <Pressable
              style={styles.startRow}
              onPress={() => void run(() => onStart(draft))}
              disabled={!trimmedTitle || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Start this habit"
            >
              <Ionicons name="add" size={18} color={colors.textSecondary} />
              <Text style={styles.startLabel}>Start this habit</Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <Button
              title="Save"
              onPress={() => void run(() => onSave(draft))}
              disabled={!trimmedTitle}
              loading={isSaving}
              fullWidth
            />
            {desired ? (
              <Pressable
                style={styles.removeButton}
                onPress={confirmRemove}
                accessibilityRole="button"
                accessibilityLabel="Remove desired habit"
              >
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.backdrop,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: SPACING.lg,
    },
    linkBlock: {
      gap: SPACING.sm,
    },
    linkHeading: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    linkIcon: {
      width: STATUS_INDICATOR.size,
      height: STATUS_INDICATOR.size,
      borderRadius: STATUS_INDICATOR.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    linkText: {
      flex: 1,
      gap: SPACING.xs,
    },
    linkName: {
      ...TYPOGRAPHY.headingMedium,
      fontWeight: '500',
      color: colors.text,
    },
    linkSchedule: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    startRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginVertical: LIST_ITEM.marginVertical,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    startLabel: {
      ...TYPOGRAPHY.headingMedium,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    actions: {
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    removeButton: {
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeLabel: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.error,
    },
  });
