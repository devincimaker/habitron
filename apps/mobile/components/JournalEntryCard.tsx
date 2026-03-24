import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { JournalEntry } from '@habits-coach/shared';
import { BodyLarge, BodyMedium, Caption } from './ui';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { JOURNAL_MOOD_BY_VALUE, JOURNAL_MOOD_STYLES } from '../constants/journal';

interface JournalEntryCardProps {
  entry: JournalEntry;
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

function formatScale(label: string, value: number): string {
  return `${label} ${value}/5`;
}

export function JournalEntryCard({
  entry,
  onEdit,
  onDelete,
}: JournalEntryCardProps) {
  const mood = entry.mood ? JOURNAL_MOOD_BY_VALUE[entry.mood] : null;
  const moodStyle = entry.mood ? JOURNAL_MOOD_STYLES[entry.mood] : null;
  const [leadText, ...remainingParagraphs] = entry.content
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const supportingText = remainingParagraphs.join(' ');
  const wasEdited = entry.updatedAt - entry.createdAt > 60_000;
  const visibleTags = entry.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, entry.tags.length - visibleTags.length);

  const detailPills = [
    entry.energy ? formatScale('Energy', entry.energy) : null,
    entry.stress ? formatScale('Stress', entry.stress) : null,
  ].filter(Boolean) as string[];

  const handleOpenActions = () => {
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
  };

  return (
    <Pressable
      style={styles.card}
      onPress={() => onEdit(entry)}
      accessibilityLabel="Open journal entry"
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.timeRow}>
            <Caption>{formatEntryTimestamp(entry.createdAt)}</Caption>
            {wasEdited ? (
              <View style={styles.editedBadge}>
                <Caption color={COLORS.textLight}>Edited</Caption>
              </View>
            ) : null}
          </View>

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

        <Pressable
          style={styles.actionButton}
          onPress={(event) => {
            event.stopPropagation();
            handleOpenActions();
          }}
          accessibilityLabel="Journal entry actions"
          hitSlop={10}
        >
          <Feather name="more-horizontal" size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <BodyLarge style={styles.entryLead} numberOfLines={3}>
        {leadText ?? entry.content}
      </BodyLarge>

      {supportingText ? (
        <BodyMedium numberOfLines={2} color={COLORS.textSecondary}>
          {supportingText}
        </BodyMedium>
      ) : null}

      {detailPills.length > 0 ? (
        <View style={styles.metaRow}>
          {detailPills.map((detail) => (
            <View key={`${entry.id}-${detail}`} style={styles.metaPill}>
              <Caption color={COLORS.text}>{detail}</Caption>
            </View>
          ))}
        </View>
      ) : null}

      {visibleTags.length > 0 ? (
        <View style={styles.tagsRow}>
          {visibleTags.map((tag) => (
            <View key={`${entry.id}-${tag}`} style={styles.tagChip}>
              <Caption color={COLORS.primaryDark}>#{tag}</Caption>
            </View>
          ))}
          {hiddenTagCount > 0 ? (
            <View style={styles.moreTagChip}>
              <Caption color={COLORS.textSecondary}>+{hiddenTagCount} more</Caption>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  headerCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  editedBadge: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  moodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#FAFAFA',
  },
  entryLead: {
    color: COLORS.text,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  moreTagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
});
