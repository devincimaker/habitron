import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { JournalEntry, JournalEntryDraft, JournalMood } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { JournalEntryCard } from '../../components/JournalEntryCard';
import { JournalEntryModal } from '../../components/JournalEntryModal';
import { JournalFilterBar } from '../../components/JournalFilterBar';
import { DayFeelingRail } from '../../components/DayFeelingRail';
import { DaySummaryRow } from '../../components/DaySummaryRow';
import { UndoBanner } from '../../components/UndoBanner';
import { BodyMedium, HeadingLarge } from '../../components/ui';
import { useJournalStore } from '../../stores/useJournalStore';
import { useRitualsStore } from '../../stores/useRitualsStore';
import { useJournalComposer } from '../../hooks/useJournalComposer';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { groupByDay, recentReviews } from '../../utils/dayTrend';
import { BORDER_RADIUS, SHADOWS, SPACING, TAB_BAR, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

const FAB_SIZE = 56;

export default function JournalScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entries, isLoading, loadEntries, addEntry, updateEntry, removeEntry } = useJournalStore();
  const loadReviews = useRitualsStore((state) => state.load);
  const reviews = useRitualsStore((state) => state.reviews);
  const today = getTodayDate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<JournalMood | null>(null);
  const [lastSavedEntryId, setLastSavedEntryId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const composer = useJournalComposer();
  const commitDelete = useCallback(
    (entry: JournalEntry) => removeEntry(entry.id),
    [removeEntry]
  );
  const { pending: pendingDelete, remove: deleteEntry, undo: undoDelete } =
    useUndoableDelete(commitDelete);
  const openComposer = composer.open;
  const handleEditEntry = useCallback(
    (entry: JournalEntry) => openComposer({ entry }),
    [openComposer]
  );

  useEffect(() => {
    void loadEntries();
    void loadReviews();
  }, [loadEntries, loadReviews]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (pendingDelete?.id === entry.id) return false;
      const matchesQuery =
        !normalizedQuery || entry.content.toLowerCase().includes(normalizedQuery);
      return matchesQuery && (!selectedMood || entry.mood === selectedMood);
    });
  }, [entries, searchQuery, selectedMood, pendingDelete]);

  const railReviews = useMemo(() => recentReviews(reviews, today), [reviews, today]);
  const dayGroups = useMemo(() => groupByDay(filteredEntries, today), [filteredEntries, today]);

  const handleSaveEntry = useCallback(
    async (draft: JournalEntryDraft) => {
      const savedEntry = composer.entry
        ? await updateEntry(composer.entry.id, draft)
        : await addEntry(draft);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastSavedEntryId(savedEntry.id);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setLastSavedEntryId(null);
        highlightTimerRef.current = null;
      }, 2000);
    },
    [addEntry, composer.entry, updateEntry]
  );

  const handleOpenDay = useCallback(
    (date: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/day/[date]', params: { date } });
    },
    [router]
  );

  const isFiltering = Boolean(searchQuery.trim()) || selectedMood !== null;
  const showEmptyResults = isFiltering && dayGroups.length === 0;
  const overlayBottom = TAB_BAR.height + insets.bottom + SPACING.lg;

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          // Clears the tab bar and the FAB above it, so the button never sits
          // on the last card's mood pill.
          { paddingBottom: overlayBottom + FAB_SIZE },
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
        <DayFeelingRail reviews={railReviews} today={today} onOpenDay={handleOpenDay} />

        <JournalFilterBar
          query={searchQuery}
          mood={selectedMood}
          onQueryChange={setSearchQuery}
          onMoodChange={setSelectedMood}
          matchCount={filteredEntries.length}
        />

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

                <View style={styles.sectionEntries}>
                  {group.entries.map((entry) => (
                    <JournalEntryCard
                      key={entry.id}
                      entry={entry}
                      isHighlighted={entry.id === lastSavedEntryId}
                      onEdit={handleEditEntry}
                      onDelete={deleteEntry}
                    />
                  ))}
                </View>
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
        style={[styles.fab, { bottom: overlayBottom }]}
        onPress={() => composer.open()}
        accessibilityLabel="Create a new journal entry"
      >
        <Feather name="plus" size={24} color={colors.white} />
      </Pressable>

      {pendingDelete ? (
        <UndoBanner label="Entry deleted" bottom={overlayBottom} onUndo={undoDelete} />
      ) : null}

      <JournalEntryModal
        visible={composer.isOpen}
        entry={composer.entry}
        prompt={composer.prompt}
        autoStartVoice={composer.autoStartVoice}
        onClose={composer.close}
        onSave={handleSaveEntry}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.medium,
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
  });
