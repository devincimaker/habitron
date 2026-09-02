import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, SPACING } from '../../constants/theme';
import { VOICE } from './voiceTheme';

interface VoiceFirstRunProps {
  /** Denied: iOS will not ask again, so the way in is Settings. */
  denied: boolean;
  onAllow(): void;
  onNotNow(): void;
}

/**
 * Shown before the OS microphone prompt, so the first thing the user sees is
 * why, not a system alert. Denied is the same screen with a different door.
 */
export function VoiceFirstRun({ denied, onAllow, onNotNow }: VoiceFirstRunProps) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="mic" size={40} color={VOICE.amber} />
      </View>
      <Text style={styles.title}>Talk with the coach</Text>
      <Text style={styles.body}>
        {denied
          ? 'Microphone access is off for this app. Turn it on in Settings and come back.'
          : 'Hands-free, out loud. The coach listens while you talk and speaks when you stop. Cut in whenever you like.'}
      </Text>
      <Text style={styles.caption}>Only what you say to the coach is sent, and only after you have said it.</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={denied ? () => void Linking.openSettings() : onAllow}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={denied ? 'Open Settings' : 'Allow microphone'}
        >
          <Text style={styles.primaryText}>{denied ? 'Open Settings' : 'Allow microphone'}</Text>
        </Pressable>
        <Pressable
          onPress={onNotNow}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: VOICE.amberFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: VOICE.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    color: VOICE.textSecondary,
    textAlign: 'center',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: VOICE.textLight,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  primary: {
    height: 52,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: VOICE.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '600',
    color: VOICE.background,
  },
  secondary: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 17,
    color: VOICE.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
