import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BodyMedium, Button, Caption, HeadingLarge } from './ui';
import { SPACING, BORDER_RADIUS, type Colors } from '../constants/theme';
import { getUpcomingDays } from '../utils/dateUtils';
import { useThemedStyles } from '../hooks/useColors';

interface QuickDatePickerModalProps {
  visible: boolean;
  title: string;
  selectedDate?: string;
  allowEmpty?: boolean;
  onSelectDate: (date?: string) => void;
  onClose: () => void;
}

export function QuickDatePickerModal({
  visible,
  title,
  selectedDate,
  allowEmpty = true,
  onSelectDate,
  onClose,
}: QuickDatePickerModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const upcomingDays = getUpcomingDays(14);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <HeadingLarge style={styles.title}>{title}</HeadingLarge>
          <ScrollView showsVerticalScrollIndicator={false}>
            {allowEmpty ? (
              <Pressable
                style={[styles.row, !selectedDate && styles.rowSelected]}
                onPress={() => {
                  onSelectDate(undefined);
                  onClose();
                }}
              >
                <BodyMedium color={colors.text}>No date</BodyMedium>
              </Pressable>
            ) : null}

            {upcomingDays.map((option) => {
              const isSelected = option.date === selectedDate;

              return (
                <Pressable
                  key={option.date}
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => {
                    onSelectDate(option.date);
                    onClose();
                  }}
                >
                  <BodyMedium color={colors.text}>{option.label}</BodyMedium>
                  <Caption>{option.secondaryLabel}</Caption>
                </Pressable>
              );
            })}
          </ScrollView>

          <Button
            title="Close"
            variant="ghost"
            onPress={onClose}
            size="sm"
            style={styles.closeButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  title: {
    marginBottom: SPACING.md,
  },
  row: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.surface,
    marginBottom: SPACING.sm,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: SPACING.sm,
  },
});
