import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ScrollView as HorizontalScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { JournalEntry, JournalEntryDraft, JournalMood } from '@habits-coach/shared';
import { JournalEntryCard } from '../../components/JournalEntryCard';
import { JournalEntryModal } from '../../components/JournalEntryModal';
import { BodyMedium, Button, Caption, Card, HeadingLarge, Input } from '../../components/ui';
import { useJournalStore } from '../../stores/useJournalStore';
import {
  BORDER_RADIUS,
  CENTER_TAB_BUTTON,
  COLORS,
  SPACING,
  TAB_BAR,
} from '../../constants/theme';
import {
  JOURNAL_MOODS,
  JOURNAL_MOOD_STYLES,
} from '../../constants/journal';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
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
  const [selectedMood, setSelectedMood] = useState<JournalMood | null>(null);
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
      const matchesMood = !selectedMood || entry.mood === selectedMood;

      return matchesQuery && matchesTag && matchesMood;
    });
  }, [entries, searchQuery, selectedMood, selectedTag]);

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

  const activeFilterCount =
    Number(Boolean(searchQuery.trim())) +
    Number(Boolean(selectedTag)) +
    Number(Boolean(selectedMood));
  const showEmptyFeed = entries.length === 0;
  const showEmptyResults = !showEmptyFeed && filteredEntries.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              TAB_BAR.height + CENTER_TAB_BUTTON.size + insets.bottom + SPACING.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadEntries()}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.searchPanel}>
          <Input
            placeholder="Search reflections or tags"
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchInput}
          />

          {activeFilterCount > 0 ? (
            <Pressable
              style={styles.clearFiltersButton}
              onPress={() => {
                setSearchQuery('');
                setSelectedTag(null);
                setSelectedMood(null);
              }}
            >
              <Caption color={COLORS.primaryDark}>Clear filters</Caption>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filtersSection}>
          <View style={styles.filterGroup}>
            <Caption>Mood</Caption>
            <HorizontalScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRail}
            >
              <FilterChip
                label="All"
                isSelected={selectedMood === null}
                onPress={() => setSelectedMood(null)}
              />
              {JOURNAL_MOODS.map((mood) => (
                <FilterChip
                  key={mood.value}
                  label={`${mood.emoji} ${mood.label}`}
                  isSelected={selectedMood === mood.value}
                  onPress={() => setSelectedMood((current) => (current === mood.value ? null : mood.value))}
                  selectedColors={JOURNAL_MOOD_STYLES[mood.value]}
                />
              ))}
            </HorizontalScrollView>
          </View>

          {recentTags.length > 0 ? (
            <View style={styles.filterGroup}>
              <Caption>Tags</Caption>
              <HorizontalScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRail}
              >
                <FilterChip
                  label="All"
                  isSelected={selectedTag === null}
                  onPress={() => setSelectedTag(null)}
                />
                {recentTags.map((tag) => (
                  <FilterChip
                    key={tag}
                    label={`#${tag}`}
                    isSelected={selectedTag === tag}
                    onPress={() => setSelectedTag((current) => (current === tag ? null : tag))}
                  />
                ))}
              </HorizontalScrollView>
            </View>
          ) : null}
        </View>

        {!showEmptyFeed ? (
          <View style={styles.resultsHeader}>
            <HeadingLarge>Latest reflections</HeadingLarge>
            <Caption>
              {activeFilterCount > 0 ? `${filteredEntries.length} matching` : `${filteredEntries.length} total`}
            </Caption>
          </View>
        ) : null}

        {filteredEntries.length > 0 ? (
          <View style={styles.entriesList}>
            {filteredEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onEdit={(selectedEntry) => openEditor(selectedEntry)}
                onDelete={handleDeleteEntry}
              />
            ))}
          </View>
        ) : (
              <Card variant="surface" style={styles.emptyCard}>
                <View style={styles.emptyBadge}>
                  <Caption color={COLORS.primaryDark}>
                {showEmptyResults ? 'No match' : 'Empty'}
              </Caption>
            </View>
            <HeadingLarge>
              {showEmptyResults ? 'Nothing matches the current filters.' : 'No entries yet.'}
            </HeadingLarge>
            <BodyMedium style={styles.emptyBody}>
              {showEmptyResults
                ? 'Try a different mood, tag, or search term.'
                : 'Use text when you want precision and voice when the thought arrives faster than your thumbs.'}
            </BodyMedium>
            <View style={styles.emptyActions}>
                <Button
                title={showEmptyResults ? 'Clear filters' : 'Add entry'}
                onPress={() => {
                  if (showEmptyResults) {
                    setSearchQuery('');
                    setSelectedTag(null);
                    setSelectedMood(null);
                    return;
                  }

                  openEditor();
                }}
                size="sm"
              />
            </View>
          </Card>
        )}
      </ScrollView>

      <Pressable
        style={[
          styles.floatingAddButton,
          {
            bottom: TAB_BAR.height + insets.bottom + SPACING.lg,
          },
        ]}
        onPress={() => openEditor()}
        accessibilityLabel="Add journal entry"
      >
        <Feather name="plus" size={16} color={COLORS.white} />
        <BodyMedium color={COLORS.white}>Add entry</BodyMedium>
      </Pressable>

      <JournalEntryModal
        visible={showEditor}
        entry={editingEntry}
        recentTags={recentTags}
        onClose={() => {
          setShowEditor(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
      />
    </View>
  );
}

function FilterChip({
  label,
  isSelected,
  onPress,
  selectedColors,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  selectedColors?: {
    surface: string;
    border: string;
    text: string;
  };
}) {
  return (
    <Pressable
      style={[
        styles.filterChip,
        isSelected && styles.filterChipSelected,
        isSelected && selectedColors
          ? {
              backgroundColor: selectedColors.surface,
              borderColor: selectedColors.border,
            }
          : null,
      ]}
      onPress={onPress}
    >
      <BodyMedium
        color={isSelected ? selectedColors?.text ?? COLORS.primaryDark : COLORS.textSecondary}
      >
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  searchPanel: {
    gap: SPACING.xs,
  },
  searchInput: {
    marginBottom: 0,
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  filtersSection: {
    gap: SPACING.xs,
  },
  filterGroup: {
    gap: SPACING.xs,
  },
  filterRail: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  entriesList: {
    gap: SPACING.md,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  emptyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  emptyBody: {
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  floatingAddButton: {
    position: 'absolute',
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
});
