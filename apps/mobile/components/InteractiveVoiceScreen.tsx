import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VoiceSession, { type MicPermission } from '../modules/voice-session';
import { useLiveVoiceSession } from '../hooks/useLiveVoiceSession';
import { useSessionStore } from '../stores/useSessionStore';
import { BORDER_RADIUS, SPACING } from '../constants/theme';
import type { VoicePhase } from '../utils/liveVoice/controller';
import { formatVoiceStatus } from '../utils/voiceTranscript';
import { VoiceFirstRun } from './interactive/VoiceFirstRun';
import { VoiceOrb } from './interactive/VoiceOrb';
import { VoiceTranscriptPanel } from './interactive/VoiceTranscriptPanel';
import { CONTROL_SIZE, VOICE } from './interactive/voiceTheme';

const LABELS: Record<VoicePhase, string> = {
  idle: '',
  starting: 'Starting…',
  listening: 'Listening',
  transcribing: 'Heard you',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Paused',
};

interface InteractiveVoiceScreenProps {
  onDone(): void;
}

export function InteractiveVoiceScreen({ onDone }: InteractiveVoiceScreenProps) {
  const insets = useSafeAreaInsets();
  const startedAt = useSessionStore((state) => state.startedAt);
  const { snapshot, controller } = useLiveVoiceSession();
  const [permission, setPermission] = useState<MicPermission>(() => VoiceSession.getPermission());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (permission === 'granted') void controller.start();
  }, [controller, permission]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleAllow = useCallback(async () => {
    const granted = await VoiceSession.requestPermission();
    setPermission(granted ? 'granted' : 'denied');
  }, []);

  const handleDone = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void controller.stop().finally(onDone);
  }, [controller, onDone]);

  const handleMute = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    controller.toggleMute();
  }, [controller]);

  const handleRetry = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void controller.start();
  }, [controller]);

  const { phase, muted, interrupted } = snapshot;
  // Muted only replaces the idle label: while the coach is heard or heard from,
  // that is the news, and the orb's mic glyph already says the mic is closed.
  const label =
    muted && (phase === 'listening' || phase === 'starting')
      ? 'Muted'
      : interrupted && phase !== 'thinking'
        ? 'Go ahead'
        : LABELS[phase];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.lg }]}>
      <StatusBar style="light" />
      {permission !== 'granted' ? (
        <VoiceFirstRun denied={permission === 'denied'} onAllow={() => void handleAllow()} onNotNow={onDone} />
      ) : (
        <>
          <View style={styles.header}>
            {startedAt !== null ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{formatVoiceStatus(startedAt, now)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.body}>
            <VoiceOrb phase={phase} muted={muted} subscribeLevel={controller.subscribeLevel} />
            <Text style={styles.label} accessibilityLiveRegion="polite">
              {label}
            </Text>
            <VoiceTranscriptPanel snapshot={snapshot} />
          </View>

          <View style={styles.controls}>
            {phase === 'error' ? (
              <Control icon="refresh" label="Try again" onPress={handleRetry} />
            ) : (
              <Control
                icon={muted ? 'mic-off' : 'mic'}
                label={muted ? 'Unmute' : 'Mute'}
                active={muted}
                onPress={handleMute}
              />
            )}
            <Control icon="close" label="Done" onPress={handleDone} />
          </View>
        </>
      )}
    </View>
  );
}

interface ControlProps {
  icon: 'mic' | 'mic-off' | 'close' | 'refresh';
  label: string;
  active?: boolean;
  onPress(): void;
}

function Control({ icon, label, active = false, onPress }: ControlProps) {
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.controlButton, active && styles.controlButtonActive, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={icon} size={26} color={active ? VOICE.background : VOICE.text} />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VOICE.background,
  },
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: VOICE.controlFill,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: VOICE.textSecondary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: VOICE.textSecondary,
    letterSpacing: 0.2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl * 2,
    paddingTop: SPACING.md,
  },
  control: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  controlButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    backgroundColor: VOICE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: VOICE.text,
  },
  controlLabel: {
    fontSize: 13,
    color: VOICE.textLight,
  },
  pressed: {
    opacity: 0.7,
  },
});
