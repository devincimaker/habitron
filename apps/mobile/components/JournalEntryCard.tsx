import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { JournalEntry } from '@habits-coach/shared';
import { BodyMedium, Button, Caption, HeadingLarge } from './ui';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { JOURNAL_MOOD_BY_VALUE } from '../constants/journal';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => Promise<void>;
}

function formatEntryTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function JournalEntryCard({
  entry,
  onEdit,
  onDelete,
}: JournalEntryCardProps) {
  const mood = entry.mood ? JOURNAL_MOOD_BY_VALUE[entry.mood] : null;

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
            <HeadingLarge style={styles.moodLabel}>
              {mood.emoji} {mood.label}
            </HeadingLarge>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Button title="Edit" variant="ghost" size="sm" onPress={() => onEdit(entry)} />
          <Button title="Delete" variant="ghost" size="sm" onPress={handleDelete} />
        </View>
      </View>

      <BodyMedium numberOfLines={4} color={COLORS.text}>
        {entry.content}
      </BodyMedium>

      <View style={styles.metaRow}>
        {entry.energy ? <Caption>Energy {entry.energy}</Caption> : null}
        {entry.stress ? <Caption>Stress {entry.stress}</Caption> : null}
      </View>

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
    borderRadius: BORDER_RADIUS.md,
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
  },
  moodLabel: {
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
});
