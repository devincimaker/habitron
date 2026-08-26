import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  BORDER_RADIUS,
  FONT_SIZES,
  SHADOWS,
  SPACING,
  TAB_BAR,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import {
  canAbort,
  formatElapsed,
  holdHint,
  sheetHint,
  workingLabel,
  type InstructState,
} from '../utils/instruct';
import { Button } from './ui';
import { Waveform } from './VoiceInputButton';

interface InstructOverlayProps {
  state: InstructState;
  meterLevel: number;
  recordingDuration: number;
  onApply: () => void;
  onDismiss: () => void;
  onAbort: () => void;
}

/**
 * Everything hold-to-instruct puts on screen: the scrim, the capture panel
 * rising from the tab bar, the proposal sheet, and the applied toast. Sits
 * above the tab screens and stops at the tab bar, which stays live so a
 * further hold can correct what the sheet shows.
 */
export function InstructOverlay({
  state,
  meterLevel,
  recordingDuration,
  onApply,
  onDismiss,
  onAbort,
}: InstructOverlayProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  if (state.phase === 'idle') return null;

  const dismissible = state.phase === 'proposal' || state.phase === 'notice';
  const abortable = canAbort(state);
  const showSheet = state.proposal !== null || state.phase === 'notice';

  return (
    <View
      style={[styles.container, { bottom: TAB_BAR.height + insets.bottom }]}
      pointerEvents="box-none"
      testID="instruct-overlay"
    >
      {state.phase !== 'toast' && (
        <Pressable
          style={styles.scrim}
          onPress={abortable ? onAbort : dismissible ? onDismiss : undefined}
          accessibilityLabel={abortable ? 'Cancel' : dismissible ? 'Dismiss' : undefined}
        />
      )}

      {showSheet && (
        <View style={[styles.sheet, state.phase === 'recording' && styles.sheetDimmed]}>
          {state.transcript && (
            <Text style={styles.quote} numberOfLines={3}>
              “{state.transcript}”
            </Text>
          )}

          {state.proposal ? (
            <>
              <Text style={styles.eyebrow}>{state.revised ? 'Habitron will · revised' : 'Habitron will'}</Text>
              <Text style={styles.summary}>{state.proposal.summary}</Text>
              {state.proposal.actions.map((action, index) => (
                <View key={index} style={styles.actionRow}>
                  <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionText}>{action}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.noticeText}>{state.notice}</Text>
          )}

          {state.phase === 'applying' ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.busyText}>{workingLabel(state)}</Text>
            </View>
          ) : (
            <View style={styles.buttons}>
              <Button title="Not now" variant="ghost" onPress={onDismiss} style={styles.button} />
              {state.proposal && <Button title="Apply" onPress={onApply} style={styles.button} />}
            </View>
          )}

          {state.phase !== 'applying' && (
            <Text style={[styles.hint, state.proposal && state.notice && styles.hintNotice]}>
              {state.proposal && state.notice ? state.notice : sheetHint(state)}
            </Text>
          )}
        </View>
      )}

      {state.phase === 'recording' && (
        <View style={styles.panel}>
          <Waveform level={meterLevel} isWarning={state.cancelArmed} />
          <Text style={styles.elapsed}>{formatElapsed(recordingDuration)}</Text>
          <Text style={[styles.hint, state.cancelArmed && styles.hintNotice]}>{holdHint(state)}</Text>
        </View>
      )}

      {state.phase === 'working' && (
        // Display only: the hint is written on this card, so the card must let
        // the tap through to the scrim behind it rather than swallow it.
        <View style={styles.panel} pointerEvents="none">
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.busyText}>{workingLabel(state)}</Text>
          </View>
          <Text style={styles.hint}>Tap to cancel</Text>
        </View>
      )}

      {state.phase === 'toast' && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.white} />
          <Text style={styles.toastText}>{state.toast}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      alignSelf: 'stretch',
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.background,
      gap: SPACING.sm,
      ...SHADOWS.medium,
    },
    sheetDimmed: {
      opacity: 0.5,
    },
    quote: {
      ...TYPOGRAPHY.bodyMedium,
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    eyebrow: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.primary,
    },
    summary: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.textStrong,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    actionText: {
      ...TYPOGRAPHY.bodyLarge,
      flex: 1,
      color: colors.text,
    },
    noticeText: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
    },
    buttons: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    button: {
      flex: 1,
    },
    busyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      minHeight: 44,
    },
    busyText: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
    },
    hint: {
      ...TYPOGRAPHY.caption,
      textAlign: 'center',
      color: colors.textLight,
    },
    hintNotice: {
      color: colors.error,
      fontWeight: '600',
    },
    panel: {
      alignSelf: 'stretch',
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.background,
      alignItems: 'center',
      gap: SPACING.xs,
      ...SHADOWS.medium,
    },
    elapsed: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.textStrong,
      ...SHADOWS.medium,
    },
    toastText: {
      ...TYPOGRAPHY.label,
      color: colors.background,
    },
  });
