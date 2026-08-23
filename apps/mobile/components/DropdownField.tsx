import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

interface DropdownFieldProps<T extends string> {
  options: Array<DropdownOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Optional trailing action row, e.g. "+ Add Unit". */
  footerLabel?: string;
  onFooterPress?: () => void;
  minWidth?: number;
}

/** A compact select control that opens a floating option list. */
export function DropdownField<T extends string>({
  options,
  value,
  onChange,
  footerLabel,
  onFooterPress,
  minWidth = 140,
}: DropdownFieldProps<T>) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        style={[styles.field, { minWidth }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {selected?.label ?? value}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <ScrollView bounces={false} style={styles.menuScroll}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={styles.menuRow}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.menuText, isSelected && styles.menuTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
              {footerLabel && onFooterPress ? (
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setOpen(false);
                    onFooterPress();
                  }}
                >
                  <View style={styles.footerRow}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                    <Text style={[styles.menuText, styles.menuTextSelected]}>{footerLabel}</Text>
                  </View>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      height: 44,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldText: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      flexShrink: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      padding: SPACING.lg,
    },
    menu: {
      width: '80%',
      maxHeight: '70%',
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.sm,
      ...SHADOWS.medium,
    },
    menuScroll: {
      flexGrow: 0,
    },
    menuRow: {
      minHeight: 52,
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
    },
    menuText: {
      ...TYPOGRAPHY.bodyLarge,
      fontSize: 18,
      color: colors.text,
    },
    menuTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
  });
