import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Caption } from './ui';
import { BORDER_RADIUS, type Colors } from '../constants/theme';
import { useColorTheme, useThemedStyles } from '../hooks/useColors';
import { getTodoTagChipColors } from '../utils/todoTagColors';

interface TodoTagPillProps {
  name: string;
  color?: string;
  /** Present when the pill is a choice (the quick-create picker) rather than a label. */
  onPress?: () => void;
}

/** The tag pill the compact task row draws, and the quick-create picker offers. */
export function TodoTagPill({ name, color, onPress }: TodoTagPillProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const colorTheme = useColorTheme();
  const chip = useMemo(() => getTodoTagChipColors(color, colorTheme), [color, colorTheme]);
  const style = [
    styles.pill,
    chip ? { backgroundColor: chip.background, borderColor: 'transparent' } : undefined,
  ];
  const label = <Caption color={chip?.label ?? colors.textSecondary}>{name}</Caption>;

  return onPress ? (
    <Pressable
      style={style}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Use tag #${name}`}
    >
      {label}
    </Pressable>
  ) : (
    <View style={style}>{label}</View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    pill: {
      borderRadius: BORDER_RADIUS.full,
      // A tag with no colour keeps this outline: the coach's create_tag stores
      // color as null, and surface-on-background is ~1.05:1, so without it the
      // pill has no visible shape at all. A coloured chip overrides the border to
      // transparent rather than dropping the width, so both are the same height.
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
  });
