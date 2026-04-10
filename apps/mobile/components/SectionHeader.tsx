import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Caption, HeadingLarge } from './ui';
import { SPACING } from '../constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPressAction?: () => void;
  rightAccessory?: ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPressAction,
  rightAccessory,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <HeadingLarge>{title}</HeadingLarge>
        <Caption>{subtitle}</Caption>
      </View>
      {rightAccessory ? rightAccessory : null}
      {!rightAccessory && actionLabel && onPressAction ? (
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
