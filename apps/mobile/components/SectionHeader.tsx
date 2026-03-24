import { StyleSheet, View } from 'react-native';
import { Button, Caption, HeadingLarge } from './ui';
import { SPACING } from '../constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPressAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <HeadingLarge>{title}</HeadingLarge>
        <Caption>{subtitle}</Caption>
      </View>
      {actionLabel && onPressAction ? (
        <Button title={actionLabel} onPress={onPressAction} size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  sectionCopy: {
    flex: 1,
  },
});
