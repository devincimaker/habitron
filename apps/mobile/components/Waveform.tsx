import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColors } from '../hooks/useColors';

const BARS = 20;

/** A live level meter: twenty bars breathing around the centre with the input. */
export function Waveform({ level, isWarning = false }: { level: number; isWarning?: boolean }) {
  const colors = useColors();
  const animatedValues = useRef(
    Array.from({ length: BARS }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    animatedValues.forEach((anim, index) => {
      const centerDistance = Math.abs(index - BARS / 2) / (BARS / 2);
      const targetScale = Math.max(
        0.15,
        level * (1 - centerDistance * 0.5) * (0.8 + Math.random() * 0.4)
      );

      Animated.timing(anim, {
        toValue: targetScale,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [level, animatedValues]);

  const barColor = isWarning ? colors.error : colors.primary;

  return (
    <View style={styles.container}>
      {animatedValues.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: barColor,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    gap: 2,
  },
  bar: {
    width: 3,
    height: 40,
    borderRadius: 1.5,
  },
});
