import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HabitStatus, HabitWithStatus } from '@habits-coach/shared';
import { Button } from './ui';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import {
  formatAmount,
  formatHabitProgress,
  getCheckInIncrement,
} from '../utils/habitSchedule';

interface HabitLogSheetProps {
  habit: HabitWithStatus | null;
  onClose: () => void;
  onSaveAmount: (habitId: string, amount: number) => Promise<void>;
  onSetStatus: (habitId: string, status: HabitStatus) => Promise<void>;
}

/** Bottom sheet for recording progress against a habit for the selected day. */
export function HabitLogSheet({ habit, onClose, onSaveAmount, onSetStatus }: HabitLogSheetProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [amountText, setAmountText] = useState('0');

  useEffect(() => {
    if (habit) setAmountText(formatAmount(habit.todayAmount));
  }, [habit]);

  if (!habit) return null;

  const isQuantity = habit.goalType === 'quantity';
  const increment = getCheckInIncrement(habit);
  const amount = Number(amountText.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount >= 0;

  // The store shows the log before the write, and the handler alerts if it
  // fails, so the sheet has nothing to wait for.
  const run = (action: () => Promise<void>) => {
    onClose();
    void action();
  };

  const adjust = (delta: number) => {
    const next = Math.max(0, (amountValid ? amount : 0) + delta);
    setAmountText(formatAmount(Math.round(next * 100) / 100));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{habit.name}</Text>
          <Text style={styles.subtitle}>
            {isQuantity
              ? `Today: ${formatHabitProgress(habit, habit.todayAmount)}`
              : habit.todayStatus === 'completed'
                ? 'Completed today'
                : habit.todayStatus === 'skipped'
                  ? 'Skipped today'
                  : 'Not logged yet'}
          </Text>

          {isQuantity ? (
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepButton}
                onPress={() => adjust(-increment)}
                accessibilityLabel={`Subtract ${increment}`}
              >
                <Ionicons name="remove" size={24} color={colors.text} />
              </Pressable>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Pressable
                style={styles.stepButton}
                onPress={() => adjust(increment)}
                accessibilityLabel={`Add ${increment}`}
              >
                <Ionicons name="add" size={24} color={colors.text} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actions}>
            {isQuantity ? (
              <Button
                title="Save"
                onPress={() => void run(() => onSaveAmount(habit.id, amount))}
                disabled={!amountValid}
                fullWidth
              />
            ) : null}
            <View style={styles.actionRow}>
              <Button
                title={habit.todayStatus === 'completed' ? 'Undo complete' : 'Mark complete'}
                variant="secondary"
                onPress={() =>
                  void run(() =>
                    onSetStatus(
                      habit.id,
                      habit.todayStatus === 'completed' ? 'pending' : 'completed'
                    )
                  )
                }
                style={styles.actionButton}
              />
              <Button
                title={habit.todayStatus === 'skipped' ? 'Undo skip' : 'Skip'}
                variant="ghost"
                onPress={() =>
                  void run(() =>
                    onSetStatus(habit.id, habit.todayStatus === 'skipped' ? 'pending' : 'skipped')
                  )
                }
                style={styles.actionButton}
              />
            </View>
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
      gap: SPACING.sm,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: SPACING.sm,
    },
    title: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.text,
    },
    subtitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textSecondary,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      marginVertical: SPACING.md,
    },
    stepButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountInput: {
      minWidth: 120,
      height: 56,
      textAlign: 'center',
      ...TYPOGRAPHY.displayMedium,
      color: colors.text,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
    },
    actions: {
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    actionRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    actionButton: {
      flex: 1,
    },
  });
