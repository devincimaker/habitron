import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { JournalEntry, JournalEntryDraft } from '@habits-coach/shared';
import { JournalEntryCard } from '../../components/JournalEntryCard';
import { JournalEntryModal } from '../../components/JournalEntryModal';
import { SectionHeader } from '../../components/SectionHeader';
import { BodyMedium, Card, Input } from '../../components/ui';
import { useJournalStore } from '../../stores/useJournalStore';
import { BORDER_RADIUS, COLORS, SPACING } from '../../constants/theme';

export default function JournalScreen() {
  const {
    entries,
    isLoading,
    loadEntries,
    addEntry,
    updateEntry,
    removeEntry,
    getRecentTags,
  } = useJournalStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const recentTags = useMemo(() => getRecentTags(), [entries, getRecentTags]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.content.toLowerCase().includes(normalizedQuery) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesTag = !selectedTag || entry.tags.includes(selectedTag);

      return matchesQuery && matchesTag;
    });
  }, [entries, searchQuery, selectedTag]);

  const handleSaveEntry = useCallback(
    async (draft: JournalEntryDraft) => {
      if (editingEntry) {
        await updateEntry(editingEntry.id, draft);
      } else {
        await addEntry(draft);
      }
    },
    [addEntry, editingEntry, updateEntry]
  );

  const handleDeleteEntry = useCallback(
    async (entry: JournalEntry) => {
      await removeEntry(entry.id);
    },
    [removeEntry]
  );

  const openEditor = useCallback((entry?: JournalEntry | null) => {
    setEditingEntry(entry ?? null);
    setShowEditor(true);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadEntries()}
            tintColor={COLORS.primary}
          />
        }
      >
        <SectionHeader
          title="Journal"
          subtitle="A simple feed of reflections, not a calendar-bound check-in"
          actionLabel="Add"
          onPressAction={() => openEditor()}
        />

        <View style={styles.searchSection}>
          <Input
            placeholder="Search entries or tags"
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchInput}
          />
        </View>

        {recentTags.length > 0 ? (
          <View style={styles.tagFilters}>
            <TagFilterChip
              label="All"
              isSelected={selectedTag === null}
              onPress={() => setSelectedTag(null)}
            />
            {recentTags.map((tag) => (
              <TagFilterChip
                key={tag}
                label={`#${tag}`}
                isSelected={selectedTag === tag}
                onPress={() => setSelectedTag((current) => (current === tag ? null : tag))}
              />
            ))}
          </View>
        ) : null}

        {filteredEntries.length > 0 ? (
          <View style={styles.entriesList}>
            {filteredEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onEdit={openEditor}
                onDelete={handleDeleteEntry}
              />
            ))}
          </View>
        ) : (
          <Card variant="surface">
            <BodyMedium>
              {entries.length === 0
                ? 'No journal entries yet. Add one with text or voice dictation.'
                : 'No journal entries match the current search or tag filter.'}
            </BodyMedium>
          </Card>
        )}
      </ScrollView>

      <JournalEntryModal
        visible={showEditor}
        entry={editingEntry}
        onClose={() => {
          setShowEditor(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
      />
    </View>
  );
}

function TagFilterChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.filterChip,
        isSelected && styles.filterChipSelected,
      ]}
      onPress={onPress}
    >
      <BodyMedium color={isSelected ? COLORS.primaryDark : COLORS.textSecondary}>
        {label}
      </BodyMedium>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    marginBottom: 0,
  },
  tagFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  entriesList: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
});
