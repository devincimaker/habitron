import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TAB_BAR, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import type { InstructState } from '../utils/instruct';

const PUCK_SIZE = 56;

interface CoachTabGlyphProps {
  state: InstructState;
  focused: boolean;
  color: string;
}

/**
 * The Coach tab's icon through a hold: the chat bubble at rest, a mic puck
 * while recording (red with an X once cancel is armed), a spinner while the
 * instruction is being worked on.
 */
export function CoachTabGlyph({ state, focused, color }: CoachTabGlyphProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  if (state.phase === 'recording') {
    return (
      <View
        style={[styles.puck, state.cancelArmed && styles.puckCancel]}
        accessibilityLabel={state.cancelArmed ? 'Release to discard' : 'Recording'}
      >
        <Ionicons name={state.cancelArmed ? 'close' : 'mic'} size={28} color={colors.white} />
      </View>
    );
  }

  if (state.phase === 'working' || state.phase === 'applying') {
    return (
      <View style={styles.spinner}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Ionicons
      name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
      size={TAB_BAR.iconSize}
      color={color}
    />
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    puck: {
      width: PUCK_SIZE,
      height: PUCK_SIZE,
      marginTop: -(PUCK_SIZE - TAB_BAR.iconSize) / 2,
      borderRadius: PUCK_SIZE / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    puckCancel: {
      backgroundColor: colors.error,
    },
    spinner: {
      height: TAB_BAR.iconSize,
      justifyContent: 'center',
    },
  });
