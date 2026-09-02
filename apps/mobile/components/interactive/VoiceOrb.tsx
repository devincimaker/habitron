import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { VoicePhase } from '../../utils/liveVoice/controller';
import { ORB_SIZE, VOICE } from './voiceTheme';

const BAR_COUNT = 44;
const BAR_WIDTH = 3;
const BAR_MIN = 4;
const BAR_RANGE = 40;
const RING_RADIUS = ORB_SIZE / 2 - 24;
const CORE_QUIET = 88;
const CORE_ACTIVE = 104;

/** How the bars behave: 0 barely there, 1 following the mic, 2 rolling on their own. */
type OrbMode = 0 | 1 | 2;

function modeFor(phase: VoicePhase, muted: boolean): OrbMode {
  if (muted) return 0;
  if (phase === 'listening') return 1;
  if (phase === 'speaking') return 2;
  return 0;
}

/** Deterministic unevenness, so the ring reads as sound and not as a gauge. */
const PATTERN = Array.from({ length: BAR_COUNT }, (_, index) => {
  const a = Math.abs(Math.sin(index * 0.9));
  const b = 0.6 + 0.4 * Math.abs(Math.cos(index * 0.37));
  return 0.3 + 0.7 * a * b;
});

interface VoiceOrbProps {
  phase: VoicePhase;
  muted: boolean;
  /** Mic levels arrive here, off React's render path. */
  subscribeLevel(listener: (level: number) => void): () => void;
}

export function VoiceOrb({ phase, muted, subscribeLevel }: VoiceOrbProps) {
  const level = useSharedValue(0);
  const mode = useSharedValue<number>(0);
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => subscribeLevel((next) => {
    level.value = withTiming(next, { duration: 90 });
  }), [level, subscribeLevel]);

  useEffect(() => {
    mode.value = withTiming(modeFor(phase, muted), { duration: 250 });
  }, [mode, muted, phase]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    spin.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1);
  }, [pulse, spin]);

  const bars = useMemo(() => Array.from({ length: BAR_COUNT }, (_, index) => index), []);
  const thinking = phase === 'thinking' || phase === 'transcribing' || phase === 'starting';
  const active = phase === 'thinking' || phase === 'speaking';

  const coreStyle = useAnimatedStyle(() => {
    const size = active ? CORE_ACTIVE : CORE_QUIET;
    return {
      width: withTiming(size, { duration: 300 }),
      height: withTiming(size, { duration: 300 }),
      borderRadius: withTiming(size / 2, { duration: 300 }),
      opacity: withTiming(muted ? 0.45 : 1, { duration: 200 }),
    };
  }, [active, muted]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
    opacity: withTiming(thinking ? 1 : 0, { duration: 200 }),
  }), [thinking]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: phase === 'speaking' ? 0.5 - 0.5 * pulse.value : 0,
    transform: [{ scale: 1 + 0.35 * pulse.value }],
  }), [phase]);

  return (
    <View style={styles.orb} accessibilityRole="image" accessibilityLabel={`Coach ${phase}`}>
      {bars.map((index) => (
        <Bar key={index} index={index} level={level} mode={mode} pulse={pulse} />
      ))}
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <Animated.View style={[styles.spinner, spinnerStyle]} />
      <Animated.View style={[styles.core, coreStyle]}>
        {muted ? <Ionicons name="mic-off" size={30} color={VOICE.background} /> : null}
      </Animated.View>
    </View>
  );
}

interface BarProps {
  index: number;
  level: SharedValue<number>;
  mode: SharedValue<number>;
  pulse: SharedValue<number>;
}

function Bar({ index, level, mode, pulse }: BarProps) {
  const angle = (index * 360) / BAR_COUNT;
  const pattern = PATTERN[index];
  const style = useAnimatedStyle(() => {
    const listening = Math.min(1, Math.max(0, mode.value));
    const speaking = Math.min(1, Math.max(0, mode.value - 1));
    const idle = 1 - listening;
    const rolling = Math.abs(Math.sin(pulse.value * Math.PI + index * 0.55));
    const energy =
      idle * 0.06 +
      listening * (1 - speaking) * (0.18 + 0.82 * level.value) +
      speaking * (0.3 + 0.55 * rolling);
    return {
      height: BAR_MIN + BAR_RANGE * pattern * energy,
      opacity: 0.28 + 0.64 * Math.max(listening, speaking),
    };
  });
  return (
    <Animated.View
      style={[
        styles.bar,
        { transform: [{ rotate: `${angle}deg` }, { translateY: -RING_RADIUS }] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    backgroundColor: VOICE.amber,
  },
  core: {
    backgroundColor: VOICE.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: VOICE.amber,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  spinner: {
    position: 'absolute',
    width: CORE_ACTIVE + 24,
    height: CORE_ACTIVE + 24,
    borderRadius: (CORE_ACTIVE + 24) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: VOICE.amber,
  },
  ripple: {
    position: 'absolute',
    width: CORE_ACTIVE + 40,
    height: CORE_ACTIVE + 40,
    borderRadius: (CORE_ACTIVE + 40) / 2,
    borderWidth: 1.5,
    borderColor: VOICE.amberSoft,
  },
});
