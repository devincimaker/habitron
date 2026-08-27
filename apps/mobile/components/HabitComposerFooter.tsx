import { StyleSheet, View } from 'react-native';
import { FlatActionButton } from './ui';
import { SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const ACTION_HEIGHT = 48;
/** The bar's own breathing room above and below the action; the home inset adds to it. */
const BAR_PADDING = 12;

interface HabitComposerFooterProps {
  title: string;
  disabled: boolean;
  onPress: () => void;
  /** Home inset when the keyboard is down, 0 when the bar rides the keyboard. */
  bottomInset: number;
}

/** One full-width flat action that sits on the keyboard, or on the home inset when it is down. */
export function HabitComposerFooter({
  title,
  disabled,
  onPress,
  bottomInset,
}: HabitComposerFooterProps) {
  const [styles] = useThemedStyles(createStyles);

  return (
    <View style={[styles.bar, { paddingBottom: BAR_PADDING + bottomInset }]}>
      <FlatActionButton
        title={title}
        onPress={onPress}
        disabled={disabled}
        height={ACTION_HEIGHT}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      paddingTop: BAR_PADDING,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
