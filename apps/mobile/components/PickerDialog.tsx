import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface PickerDialogProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onDone: () => void;
  doneDisabled?: boolean;
  /** Optional destructive action rendered top-left (e.g. "Clear"). */
  clearLabel?: string;
  onClear?: () => void;
}

/** Centered dialog card used by the habit editor's pickers. */
export function PickerDialog({
  visible,
  title,
  children,
  onCancel,
  onDone,
  doneDisabled = false,
  clearLabel,
  onClear,
}: PickerDialogProps) {
  const [styles] = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <View style={styles.header}>
            {clearLabel && onClear ? (
              <Pressable style={styles.clearButton} onPress={onClear}>
                <Text style={styles.clearText}>{clearLabel}</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.body}>{children}</View>

          <View style={styles.footer}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.footerButton} />
            <Button
              title="Done"
              onPress={onDone}
              disabled={doneDisabled}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface RadioRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  trailing?: ReactNode;
}

export function RadioRow({ label, selected, onPress, trailing }: RadioRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable style={styles.radioRow} onPress={onPress} accessibilityRole="radio">
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
      {trailing}
      {!trailing && selected ? (
        <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.radioCheck} />
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.xl,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.md,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    headerSpacer: {
      width: 72,
    },
    clearButton: {
      width: 72,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    clearText: {
      ...TYPOGRAPHY.label,
      color: colors.error,
    },
    title: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.text,
    },
    body: {
      flexShrink: 1,
    },
    footer: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.lg,
    },
    footerButton: {
      flex: 1,
    },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      gap: SPACING.md,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    radioLabel: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      flex: 1,
    },
    radioCheck: {
      opacity: 0,
    },
  });
