import { StyleSheet, Text, View } from 'react-native';
import { SPACING } from '../../constants/theme';
import type { VoiceSnapshot } from '../../utils/liveVoice/controller';
import { VOICE } from './voiceTheme';

interface VoiceTranscriptPanelProps {
  snapshot: VoiceSnapshot;
}

/**
 * The words of the moment, under the orb: what the coach last said while the
 * user talks, the activity line while the coach works, the reply as it is
 * spoken (bright as far as the voice has got), and the cut-off reply after
 * an interruption.
 */
export function VoiceTranscriptPanel({ snapshot }: VoiceTranscriptPanelProps) {
  const { phase, muted, interrupted, userText, coachText, spokenChars, activity, notice, error } = snapshot;

  let context: string | null = null;
  let contextDim = false;
  let main: React.ReactNode = null;
  let caption: string | null = notice;

  if (phase === 'error') {
    main = <Text style={styles.main}>{error}</Text>;
  } else if (phase === 'thinking') {
    context = userText;
    main = (
      <View style={styles.activityRow}>
        <View style={styles.activityDot} />
        <Text style={styles.activity}>{activity ?? 'Thinking…'}</Text>
      </View>
    );
  } else if (phase === 'speaking') {
    main = (
      <Text style={styles.main} numberOfLines={6}>
        <Text>{coachText.slice(0, spokenChars)}</Text>
        <Text style={styles.unspoken}>{coachText.slice(spokenChars)}</Text>
      </Text>
    );
    caption = caption ?? (muted ? 'Unmute to interrupt' : 'Just talk to interrupt');
  } else if (interrupted) {
    context = coachText ? `${coachText.slice(0, Math.max(spokenChars, 1)).trimEnd()} —` : null;
    contextDim = true;
  } else {
    context = coachText || null;
    if (phase === 'transcribing') caption = caption ?? 'Got it…';
  }

  return (
    <View style={styles.panel}>
      {context ? (
        <Text style={[styles.context, contextDim && styles.contextDim]} numberOfLines={2}>
          {context}
        </Text>
      ) : null}
      {main}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 190,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  context: {
    fontSize: 15,
    lineHeight: 20,
    color: VOICE.textLight,
    textAlign: 'center',
  },
  contextDim: {
    color: VOICE.dim,
  },
  main: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
    color: VOICE.text,
    textAlign: 'center',
  },
  unspoken: {
    color: VOICE.dim,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VOICE.amber,
  },
  activity: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
    color: VOICE.text,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: VOICE.textLight,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
