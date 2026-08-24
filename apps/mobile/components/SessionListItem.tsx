import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { CoachingSessionSummary } from '@habits-coach/shared';
import { FONT_SIZES, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const SWIPE_THRESHOLD = 80;

interface SessionListItemProps {
  session: CoachingSessionSummary;
  onPress: (id: string) => void;
  onDelete?: (session: CoachingSessionSummary) => void;
}

export function SessionListItem({
  session, onPress, onDelete }: SessionListItemProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const translateX = useSharedValue(0);

  const date = new Date(session.startedAt);
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleDelete = () => onDelete?.(session);
  const handlePress = () => onPress(session.id);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value < -SWIPE_THRESHOLD && onDelete) {
        runOnJS(handleDelete)();
      }
      translateX.value = withSpring(0);
    });

  const tapGesture = Gesture.Tap().onEnd((_, success) => {
    if (success) {
      runOnJS(handlePress)();
    }
  });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.deleteBackground, deleteBackgroundStyle]}>
        <Ionicons name="trash-outline" size={24} color={colors.white} />
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>
              {session.name || 'Untitled Session'}
            </Text>
            <Text style={styles.meta}>
              {dateStr} at {timeStr} · {session.messageCount} messages
              {session.memoryCount ? ` · ${session.memoryCount} memories` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.error,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZES.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  meta: {
    fontSize: FONT_SIZES.footnote,
    color: colors.textSecondary,
  },
});
