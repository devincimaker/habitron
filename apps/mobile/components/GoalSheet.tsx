import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Goal, GoalDraft } from '@habits-coach/shared';
import { Button, Input } from './ui';
import { DatePickerModal } from './DatePickerModal';
import { BORDER_RADIUS, INPUT_HEIGHTS, SPACING, TOUCH_TARGET, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { formatDateString } from '../utils/dateUtils';

interface GoalSheetProps {
  visible: boolean;
  /** The goal being edited, or null when the sheet is creating one. */
  goal: Goal | null;
  onClose: () => void;
  /** Each hands the draft over and returns; the store shows it before the write lands. */
  onSave: (draft: GoalDraft) => void;
  onDelete?: () => void;
}

/**
 * Bottom sheet for the three things a goal is: what, how you'll know, by when.
 * All three are required — a goal without a measure or a date is a wish, and
 * the coach cannot plan toward a wish.
 */
export function GoalSheet({ visible, goal, onClose, onSave, onDelete }: GoalSheetProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [measure, setMeasure] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [pickingDate, setPickingDate] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(goal?.title ?? '');
    setMeasure(goal?.measure ?? '');
    setTargetDate(goal?.targetDate ?? null);
  }, [visible, goal]);

  if (!visible) return null;

  const draft: GoalDraft | null =
    title.trim() && measure.trim() && targetDate
      ? { title: title.trim(), measure: measure.trim(), targetDate }
      : null;

  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete goal', `Delete "${goal?.title ?? title.trim()}"? Its tasks stay.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.heading}>{goal ? 'Edit goal' : 'New goal'}</Text>

          <Input
            label="Goal"
            value={title}
            onChangeText={setTitle}
            placeholder="Run a half marathon"
            autoFocus={!goal}
          />
          <Input
            label="How you'll know it's done"
            value={measure}
            onChangeText={setMeasure}
            placeholder="Cross the finish line of a 21 km race"
            multiline
          />

          <Text style={styles.label}>By when</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setPickingDate(true)}
            accessibilityRole="button"
            accessibilityLabel={targetDate ? `Target date ${formatDateString(targetDate)}` : 'Pick a target date'}
          >
            <Feather name="calendar" size={16} color={colors.textSecondary} />
            <Text style={[styles.dateLabel, !targetDate && styles.datePlaceholder]}>
              {targetDate ? formatDateString(targetDate) : 'Pick a date'}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Button
              title="Save"
              onPress={() => {
                if (draft) onSave(draft);
              }}
              disabled={!draft}
              fullWidth
            />
            {goal && onDelete ? (
              <Pressable
                style={styles.deleteButton}
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete goal"
              >
                <Text style={styles.deleteLabel}>Delete goal</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <DatePickerModal
        visible={pickingDate}
        title="By when"
        value={targetDate ?? undefined}
        onCancel={() => setPickingDate(false)}
        onDone={(date) => {
          setPickingDate(false);
          setTargetDate(date);
        }}
      />
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
      marginBottom: SPACING.md,
    },
    heading: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.textStrong,
      marginBottom: SPACING.md,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      height: INPUT_HEIGHTS.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dateLabel: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
    datePlaceholder: {
      color: colors.textLight,
    },
    actions: {
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    deleteButton: {
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLabel: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.error,
    },
  });
