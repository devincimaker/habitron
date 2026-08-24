import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { getTaskDateOptions } from '../utils/taskDateOptions';

interface TaskDateActionsPopupProps {
  visible: boolean;
  /** The date currently on the task, highlighted when it matches a shortcut. */
  selectedDate?: string;
  onSelectDate: (date: string) => void;
  onPickDate: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** The one-tap date menu shown from a task's swipe action. */
export function TaskDateActionsPopup({
  visible,
  selectedDate,
  onSelectDate,
  onPickDate,
  onClear,
  onClose,
}: TaskDateActionsPopupProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  const renderAction = (
    key: string,
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    isSelected = false,
    tone: 'default' | 'destructive' = 'default'
  ) => (
    <Pressable
      key={key}
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.actionIcon, isSelected && styles.actionIconSelected]}>
        <Ionicons
          name={icon}
          size={26}
          color={tone === 'destructive' ? colors.error : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.actionLabel,
          isSelected && styles.actionLabelSelected,
          tone === 'destructive' && styles.actionLabelDestructive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.row}>
            {getTaskDateOptions().map((option) =>
              renderAction(
                option.key,
                option.icon,
                option.label,
                () => onSelectDate(option.date),
                option.date === selectedDate
              )
            )}
          </View>

          <View style={styles.row}>
            {renderAction('pick', 'calendar-number-outline', 'Pick Date', onPickDate)}
            <View style={styles.action} />
            {selectedDate ? (
              renderAction('clear', 'close-circle-outline', 'Clear', onClear, false, 'destructive')
            ) : (
              <View style={styles.action} />
            )}
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
      backgroundColor: colors.backdrop,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.sm,
      gap: SPACING.lg,
      ...SHADOWS.medium,
    },
    row: {
      flexDirection: 'row',
    },
    action: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.xs,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: BORDER_RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIconSelected: {
      backgroundColor: colors.primaryLight,
    },
    actionLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    actionLabelSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    actionLabelDestructive: {
      color: colors.error,
    },
  });
