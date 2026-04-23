import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyMedium } from './ui';
import { BORDER_RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { useColors } from '../hooks/useColors';

interface UndoSnackbarProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoSnackbar({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}: UndoSnackbarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100) as Animated.Value).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    dismissTimer.current = setTimeout(() => {
      slideOut(onDismiss);
    }, duration);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function slideOut(callback: () => void) {
    Animated.timing(translateY, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(callback);
  }

  function handleUndo() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    slideOut(onUndo);
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 16, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        <BodyMedium color={colors.white} style={styles.message} numberOfLines={1}>
          {message}
        </BodyMedium>
        <Pressable onPress={handleUndo} hitSlop={8}>
          <BodyMedium color={colors.primaryLight} style={styles.undoButton}>
            UNDO
          </BodyMedium>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    ...SHADOWS.medium,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  message: {
    flex: 1,
    marginRight: SPACING.md,
  },
  undoButton: {
    fontWeight: '600',
  },
});
