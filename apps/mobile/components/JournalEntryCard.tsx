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

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void onDelete(entry),
        },
      ]
    );
  };

  return (
    <Pressable style={styles.card} onPress={() => onEdit(entry)}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Caption>{formatEntryTimestamp(entry.createdAt)}</Caption>
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

        <View style={styles.actions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => onEdit(entry)}
            accessibilityLabel="Edit journal entry"
          >
            <Feather name="edit-3" size={16} color={COLORS.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={handleDelete}
            accessibilityLabel="Delete journal entry"
          >
            <Feather name="trash-2" size={16} color={COLORS.error} />
          </Pressable>
        </View>
      </View>

      <BodyLarge style={styles.entryLead} numberOfLines={3}>
        {leadText ?? entry.content}
      </BodyLarge>

      {supportingText ? (
        <BodyMedium numberOfLines={3} color={COLORS.text}>
          {supportingText}
        </BodyMedium>
      ) : null}

      {(entry.energy || entry.stress) ? (
        <View style={styles.metaRow}>
          {entry.energy ? (
            <View style={styles.metaPill}>
              <Caption color={COLORS.text}>Energy {entry.energy}</Caption>
            </View>
          ) : null}
          {entry.stress ? (
            <View style={styles.metaPill}>
              <Caption color={COLORS.text}>Stress {entry.stress}</Caption>
            </View>
          ) : null}
        </View>
      ) : null}

      {entry.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {entry.tags.map((tag) => (
            <View key={`${entry.id}-${tag}`} style={styles.tagChip}>
              <Caption color={COLORS.primaryDark}>#{tag}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
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
  moodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
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
    paddingVertical: 4,
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
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
});
