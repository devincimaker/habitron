import { useEffect } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { JournalEntry } from '@habits-coach/shared';
import { BodyLarge, BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { JOURNAL_MOOD_BY_VALUE, JOURNAL_MOOD_STYLES } from '../constants/journal';
import { useThemedStyles } from '../hooks/useColors';

interface JournalEntryCardProps {
  entry: JournalEntry;
  isHighlighted?: boolean;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => Promise<void>;
}

function formatEntryTimestamp(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const entryDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (isSameDay(entryDate, today)) {
    return `Today · ${new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(entryDate)}`;
  }

  if (isSameDay(entryDate, yesterday)) {
    return `Yesterday · ${new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(entryDate)}`;
  }

  return formatter.format(entryDate);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function JournalEntryCard({
  entry,
  isHighlighted = false,
  onEdit,
  onDelete,
}: JournalEntryCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const mood = entry.mood ? JOURNAL_MOOD_BY_VALUE[entry.mood] : null;
  const moodStyle = entry.mood ? JOURNAL_MOOD_STYLES[entry.mood] : null;
  const [leadText, ...remainingParagraphs] = entry.content
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const supportingText = remainingParagraphs.join(' ');
  const wasEdited = entry.updatedAt - entry.createdAt > 60_000;

  const highlightProgress = useSharedValue(isHighlighted ? 1 : 0);

  useEffect(() => {
    if (isHighlighted) {
      highlightProgress.value = 1;
      highlightProgress.value = withTiming(0, { duration: 1500 });
    }
  }, [isHighlighted, highlightProgress]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    backgroundColor:
      highlightProgress.value > 0
        ? `rgba(255, 209, 128, ${highlightProgress.value * 0.3})`
        : colors.background,
  }));

  const handleOpenActions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          title: 'Entry actions',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) onEdit(entry);
          if (buttonIndex === 2) void onDelete(entry);
        }
      );
    } else {
      Alert.alert(
        'Entry actions',
        'Choose what to do with this reflection.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: () => onEdit(entry) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void onDelete(entry),
          },
        ]
      );
    }
  };

  const hasMetadata = Boolean(mood);

  return (
    <AnimatedPressable
      entering={FadeInDown.duration(200)}
      style={[styles.card, animatedCardStyle]}
      onPress={() => onEdit(entry)}
      accessibilityLabel="Open journal entry"
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={styles.timeRow}>
          <Caption>{formatEntryTimestamp(entry.createdAt)}</Caption>
          {wasEdited ? (
            <View style={styles.editedBadge}>
              <Caption color={colors.textLight}>Edited</Caption>
            </View>
          ) : null}
        </View>

        <Pressable
          style={styles.actionButton}
          onPress={(event) => {
            event.stopPropagation();
            handleOpenActions();
          }}
          accessibilityLabel="Journal entry actions"
          hitSlop={10}
        >
          <Feather name="more-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <BodyLarge style={styles.entryLead} numberOfLines={3}>
        {leadText ?? entry.content}
      </BodyLarge>

      {supportingText ? (
        <BodyMedium numberOfLines={2} color={colors.textSecondary}>
          {supportingText}
        </BodyMedium>
      ) : null}

      {hasMetadata ? (
        <View style={styles.metaRow}>
          {mood ? (
            <View
              style={[
                styles.moodBadge,
                {
                  backgroundColor: moodStyle?.surface,
                  borderColor: moodStyle?.border,
                },
              ]}
            >
              <Caption color={moodStyle?.text}>
                {mood.emoji} {mood.label}
              </Caption>
            </View>
          ) : null}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  card: {
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  timeRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  editedBadge: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
  },
  entryLead: {
    color: colors.text,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  moodBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
});
