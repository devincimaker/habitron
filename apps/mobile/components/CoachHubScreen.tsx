import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CoachingSessionSummary } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import { useSessionsStore } from '../stores/useSessionsStore';
import { useMemoriesStore } from '../stores/useMemoriesStore';
import { useRitualsStore } from '../stores/useRitualsStore';
import { SessionListItem } from './SessionListItem';
import { RitualCard } from './RitualCard';
import { RITUALS, type RitualDefinition } from '../constants/rituals';
import {
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  FONT_SIZES,
  TAB_BAR,
  TYPOGRAPHY,
  type Colors,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { buildMemoryWarning, sortSessions } from '../utils/coachSessions';

const NEW_SESSION_PILL_HEIGHT = 48;

const reportDeleteFailure = () => Alert.alert('Could not delete the session', 'Please try again.');

export function CoachHubScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, isLoading, loadSessions, deleteSession } = useSessionsStore();
  const { memories, loadMemories } = useMemoriesStore();
  const { load: loadRituals, ritualState, reviewFor } = useRitualsStore();
  const activityCount = useInstructLogStore((s) => s.actions.length);
  const refreshActivity = useInstructLogStore((s) => s.refresh);
  const setActivitySheetOpen = useInstructLogStore((s) => s.setSheetOpen);
  const today = getTodayDate();

  const [refreshing, setRefreshing] = useState(false);
  const sortedSessions = useMemo(() => sortSessions(sessions), [sessions]);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  // Rituals reload on focus too: accepting a plan or saving a review happens
  // inside the session, so the card is stale the moment you come back.
  useFocusEffect(
    useCallback(() => {
      void loadSessions();
      void loadRituals();
    }, [loadSessions, loadRituals])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadSessions(), loadMemories(), loadRituals()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions, loadMemories, loadRituals]);

  const handleSessionPress = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/session', params: { sessionId: id } });
  }, [router]);

  const handleSwipeDelete = useCallback((session: CoachingSessionSummary) => {
    const sessionName = session.name || 'Untitled Session';
    const memoryWarning = buildMemoryWarning(session.memoryCount);

    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${sessionName}"?${memoryWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteSession(session.id).catch(reportDeleteFailure),
        },
      ]
    );
  }, [deleteSession]);

  const handleRitualPress = useCallback((ritual: RitualDefinition) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/session', params: { ritual: ritual.id, date: today } });
  }, [router, today]);

  const handleNewSession = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/session');
  }, [router]);

  const handleOpenMemories = useCallback(() => {
    router.push('/memories');
  }, [router]);

  const handleOpenActivity = useCallback(() => {
    void refreshActivity();
    setActivitySheetOpen(true);
  }, [refreshActivity, setActivitySheetOpen]);

  const bottomOffset = TAB_BAR.height + insets.bottom + SPACING.lg;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomOffset + NEW_SESSION_PILL_HEIGHT + SPACING.lg },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.rituals}>
          {RITUALS.map((ritual) => (
            <RitualCard
              key={ritual.id}
              ritual={ritual}
              state={ritualState(ritual.id, today)}
              onPress={handleRitualPress}
            />
          ))}
        </View>

        {sortedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <View style={styles.emptyIconContainer}>
                  <Feather name="message-circle" size={40} color={colors.textLight} />
                </View>
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start one to review what is working, adjust your habits, or plan the day.
                </Text>
              </>
            )}
          </View>
        ) : (
          sortedSessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              review={
                session.opener === 'review-day' && session.ritualDate
                  ? reviewFor(session.ritualDate)
                  : null
              }
              onPress={handleSessionPress}
              onDelete={handleSwipeDelete}
            />
          ))
        )}

        <Pressable
          style={styles.memoriesRow}
          onPress={handleOpenMemories}
          accessibilityRole="button"
          accessibilityLabel="What Habitron remembers"
        >
          <View style={styles.memoriesIcon}>
            <Feather name="database" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.memoriesLabel}>What Habitron remembers</Text>
          {memories.length > 0 && (
            <Text style={styles.memoriesCount}>{memories.length}</Text>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={styles.memoriesRow}
          onPress={handleOpenActivity}
          accessibilityRole="button"
          accessibilityLabel="Coach activity"
        >
          <View style={styles.memoriesIcon}>
            <Feather name="activity" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.memoriesLabel}>Coach activity</Text>
          {activityCount > 0 && (
            <Text style={styles.memoriesCount}>{`${activityCount} today`}</Text>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.newSessionPill,
          { bottom: bottomOffset },
          pressed && styles.newSessionPillPressed,
        ]}
        onPress={handleNewSession}
        accessibilityRole="button"
        accessibilityLabel="New session"
      >
        <Ionicons name="add" size={22} color={colors.white} />
        <Text style={styles.newSessionLabel}>New session</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  rituals: {
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg + 2,
    fontWeight: '600',
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm + 1,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  memoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  memoriesIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.controlFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memoriesLabel: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    color: colors.text,
  },
  memoriesCount: {
    ...TYPOGRAPHY.caption,
    color: colors.textSecondary,
    marginRight: SPACING.xs,
  },
  newSessionPill: {
    position: 'absolute',
    alignSelf: 'center',
    height: NEW_SESSION_PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: colors.primary,
    ...SHADOWS.medium,
  },
  newSessionPillPressed: {
    opacity: 0.85,
  },
  newSessionLabel: {
    ...TYPOGRAPHY.label,
    fontSize: FONT_SIZES.body,
    color: colors.white,
  },
});
