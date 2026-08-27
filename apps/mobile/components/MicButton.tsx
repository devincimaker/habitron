import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BORDER_RADIUS, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const SIZE = 48;

interface MicButtonProps {
  onPress: () => void;
  /** Off while the surface cannot take input, the way its text field and send button are. */
  disabled?: boolean;
}

/** The idle mic: one tap starts a recording, and `VoiceControl` takes over. */
export function MicButton({ onPress, disabled = false }: MicButtonProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Start voice recording"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Feather name="mic" size={24} color={colors.text} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.4,
  },
});
