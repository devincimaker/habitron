/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  JournalEntry,
  JournalEntryDraft,
  JournalMood,
} from '@habits-coach/shared';
import { JournalEntryCard } from '../../components/JournalEntryCard';
import { JournalEntryModal } from '../../components/JournalEntryModal';
import { DayTrendStrip } from '../../components/DayTrendStrip';
import { DayGapChips } from '../../components/DayGapChips';
import { DaySummaryRow } from '../../components/DaySummaryRow';
import {
  BodyMedium,
  Caption,
  HeadingLarge,
  Input,
} from '../../components/ui';
import { useJournalStore } from '../../stores/useJournalStore';
import { useRitualsStore } from '../../stores/useRitualsStore';
import { buildTrendWindow, findGaps, groupByDay } from '../../utils/dayTrend';
import { getTodayDate } from '@habits-coach/shared';
import {
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  TAB_BAR,
  type Colors,
} from '../../constants/theme';
import {
  JOURNAL_MOODS,
  JOURNAL_MOOD_STYLES,
} from '../../constants/journal';
import { useThemedStyles, useColors } from '../../hooks/useColors';

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function JournalScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{
    compose?: string | string[];
    voice?: string | string[];
    prompt?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const {
    entries,
    isLoading,
    loadEntries,
    addEntry,
    updateEntry,
    removeEntry,
  } = useJournalStore();
  const loadReviews = useRitualsStore((state) => state.load);
  const reviews = useRitualsStore((state) => state.reviews);
  const today = getTodayDate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<JournalMood | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorPrompt, setEditorPrompt] = useState<string | null>(null);
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [lastSavedEntryId, setLastSavedEntryId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadEntries();
    void loadReviews();
  }, [loadEntries, loadReviews]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const activeFilterCount =
    Number(Boolean(searchQuery.trim())) + Number(Boolean(selectedMood));

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (pendingDelete?.id === entry.id) return false;

      const matchesQuery =
        !normalizedQuery ||
        entry.content.toLowerCase().includes(normalizedQuery);

      const matchesMood = !selectedMood || entry.mood === selectedMood;

      return matchesQuery && matchesMood;
    });
  }, [entries, searchQuery, selectedMood, pendingDelete]);

  // The strip always shows every day; only the list below it is filtered.
  const trendWindow = useMemo(() => buildTrendWindow(reviews, today), [reviews, today]);
  const gaps = useMemo(() => findGaps(trendWindow), [trendWindow]);

  // A filter is about entries, so it hides review-only days too — otherwise a
  // search for "walk" would still list every day you rated.
  const dayGroups = useMemo(
    () =>
      groupByDay(activeFilterCount > 0 ? [] : reviews, filteredEntries, today),
    [activeFilterCount, filteredEntries, reviews, today]
  );

  const handleSaveEntry = useCallback(
    async (draft: JournalEntryDraft) => {
      let savedEntry: JournalEntry;
      if (editingEntry) {
        savedEntry = await updateEntry(editingEntry.id, draft);
      } else {
        savedEntry = await addEntry(draft);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastSavedEntryId(savedEntry.id);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setLastSavedEntryId(null);
        highlightTimerRef.current = null;
      }, 2000);
    },
    [addEntry, editingEntry, updateEntry]
  );

  const handleDeleteEntry = useCallback(
    async (entryToDelete: JournalEntry) => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      setPendingDelete(entryToDelete);
      deleteTimerRef.current = setTimeout(async () => {
        await removeEntry(entryToDelete.id);
        setPendingDelete(null);
        deleteTimerRef.current = null;
      }, 5000);
    },
    [removeEntry]
  );

  const handleUndoDelete = useCallback(() => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDelete(null);
  }, []);

  const handleReviewDay = useCallback(
    (date: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/session', params: { ritual: 'review-day', date } });
    },
    [router]
  );

  const handleOpenDay = useCallback(
    (date: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/day/[date]', params: { date } });
    },
    [router]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedMood(null);
    setShowFilters(false);
  }, []);

  const openEditor = useCallback(
    (options?: {
      entry?: JournalEntry | null;
      prompt?: string | null;
      autoStartVoice?: boolean;
    }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEditingEntry(options?.entry ?? null);
      setEditorPrompt(options?.prompt ?? null);
      setAutoStartVoice(Boolean(options?.autoStartVoice));
      setShowEditor(true);
    },
    []
  );

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingEntry(null);
    setEditorPrompt(null);
    setAutoStartVoice(false);
  }, []);

  const showEmptyFeed = entries.length === 0 && reviews.length === 0;
  const showEmptyResults = !showEmptyFeed && dayGroups.length === 0;

  useEffect(() => {
    const composeParam = Array.isArray(params.compose)
      ? params.compose[0]
      : params.compose;

    if (!composeParam || showEditor) {
      return;
    }

    const promptParam = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
    const voiceParam = Array.isArray(params.voice) ? params.voice[0] : params.voice;

    openEditor({
      prompt: promptParam ?? null,
      autoStartVoice: voiceParam === '1' || voiceParam === 'true',
    });
    router.replace('/journal');
  }, [openEditor, params.compose, params.prompt, params.voice, router, showEditor]);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setShowFilters(true);
    }
  }, [activeFilterCount]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: TAB_BAR.height + insets.bottom + SPACING.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadEntries()}
            tintColor={colors.primary}
          />
        }
      >
        {!showEmptyFeed ? (
          <>
            <DayTrendStrip window={trendWindow} />
            <DayGapChips dates={gaps} onPress={handleReviewDay} />
          </>
        ) : null}

        <View style={styles.timelineHeader}>
          <View style={styles.timelineTitleGroup}>
            <HeadingLarge>Entries</HeadingLarge>
            <Caption>
              {showEmptyFeed
                ? 'Nothing here yet.'
                : activeFilterCount > 0
                  ? `${filteredEntries.length} ${filteredEntries.length === 1 ? 'match' : 'matches'}`
                  : formatCountLabel(entries.length, 'entry', 'entries')}
            </Caption>
          </View>

          {!showEmptyFeed ? (
            <Pressable
              style={styles.filterToggle}
              onPress={() => setShowFilters((current) => !current)}
              accessibilityLabel={
                showFilters ? 'Hide search and filters' : 'Show search and filters'
              }
            >
              <Feather
                name={showFilters ? 'chevron-up' : 'sliders'}
                size={16}
                color={colors.textSecondary}
              />
              <Caption color={colors.textSecondary}>
                {activeFilterCount > 0
                  ? `${activeFilterCount} active`
                  : 'Search & filter'}
              </Caption>
            </Pressable>
          ) : null}
        </View>

        {showFilters && !showEmptyFeed ? (
          <Animated.View
            entering={FadeInDown.duration(160)}
            layout={LinearTransition.duration(180)}
            style={styles.filtersCard}
          >
            <Input
              placeholder="Search reflections"
              value={searchQuery}
              onChangeText={setSearchQuery}
              containerStyle={styles.searchInput}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRail}
            >
              <FilterChip
                label="All moods"
                isSelected={selectedMood === null}
                onPress={() => setSelectedMood(null)}
              />
              {JOURNAL_MOODS.map((mood) => (
                <FilterChip
                  key={mood.value}
                  label={`${mood.emoji} ${mood.label}`}
                  isSelected={selectedMood === mood.value}
                  onPress={() =>
                    setSelectedMood((current) =>
                      current === mood.value ? null : mood.value
                    )
                  }
                  selectedColors={JOURNAL_MOOD_STYLES[mood.value]}
                />
              ))}
            </ScrollView>

            {activeFilterCount > 0 ? (
              <View style={styles.filtersFooter}>
                <Caption>{formatCountLabel(filteredEntries.length, 'result')}</Caption>
                <Pressable onPress={clearFilters} accessibilityLabel="Clear filters">
                  <Caption color={colors.primaryDark}>Clear</Caption>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {dayGroups.length > 0 ? (
          <View style={styles.entriesList}>
            {dayGroups.map((group, sectionIndex) => (
              <Animated.View
                key={group.date}
                entering={FadeInDown.delay(sectionIndex * 35).duration(180)}
                layout={LinearTransition.duration(180)}
                style={styles.sectionBlock}
              >
                <DaySummaryRow group={group} onPress={handleOpenDay} />

                {group.entries.length > 0 ? (
                  <View style={styles.sectionEntries}>
                    {group.entries.map((entry) => (
                      <JournalEntryCard
                        key={entry.id}
                        entry={entry}
                        isHighlighted={entry.id === lastSavedEntryId}
                        onEdit={(selectedEntry) =>
                          openEditor({ entry: selectedEntry })
                        }
                        onDelete={handleDeleteEntry}
                      />
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View
            entering={FadeInDown.duration(180)}
            layout={LinearTransition.duration(180)}
            style={styles.emptyCard}
          >
            <HeadingLarge>
              {showEmptyResults ? 'No matching entries.' : 'Your entries will show up here.'}
            </HeadingLarge>

            <BodyMedium color={colors.textSecondary}>
              {showEmptyResults
                ? 'Try a simpler search or clear the filters.'
                : 'Start with one entry. The list grows from there.'}
            </BodyMedium>
          </Animated.View>
        )}
      </ScrollView>

      <Pressable
        style={[
          styles.fab,
          { bottom: TAB_BAR.height + insets.bottom + SPACING.lg },
        ]}
        onPress={() => openEditor()}
        accessibilityLabel="Create a new journal entry"
      >
        <Feather name="plus" size={24} color={colors.white} />
      </Pressable>

      {pendingDelete ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          style={[
            styles.undoBanner,
            { bottom: TAB_BAR.height + insets.bottom + SPACING.lg },
          ]}
          accessibilityRole="alert"
        >
          <BodyMedium color={colors.white}>Entry deleted</BodyMedium>
          <Pressable
            onPress={handleUndoDelete}
            accessibilityLabel="Undo delete"
            accessibilityRole="button"
          >
            <BodyMedium color={colors.primaryDark} style={styles.undoText}>
              Undo
            </BodyMedium>
          </Pressable>
        </Animated.View>
      ) : null}

      <JournalEntryModal
        visible={showEditor}
        entry={editingEntry}
        prompt={editorPrompt}
        autoStartVoice={autoStartVoice}
        onClose={closeEditor}
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
  const colors = useColors();
  const [styles] = useThemedStyles(createStyles);
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
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Caption
        color={
          isSelected ? selectedColors?.text ?? colors.primaryDark : colors.textSecondary
        }
      >
        {label}
      </Caption>
    </Pressable>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  timelineTitleGroup: {
    gap: 2,
  },
  filterToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterRail: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filtersFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  entriesList: {
    gap: SPACING.lg,
  },
  sectionBlock: {
    gap: SPACING.sm,
  },
  sectionEntries: {
    gap: SPACING.sm,
  },
  emptyCard: {
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  undoBanner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: colors.text,
  },
  undoText: {
    fontWeight: '600',
  },
});
