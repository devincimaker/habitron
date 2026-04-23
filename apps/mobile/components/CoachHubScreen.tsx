import { useCallback, useState } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionsStore } from '../stores/useSessionsStore';
import { SessionListItem } from './SessionListItem';
import { SessionDetailModal } from './SessionDetailModal';
import { SHADOWS, SPACING, FONT_SIZES, TAB_BAR, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

function buildMemoryWarning(memoryCount: number | undefined): string {
  if (!memoryCount) return '';
  const noun = memoryCount === 1 ? 'memory' : 'memories';
  return `\n\nThis will also delete ${memoryCount} associated ${noun}.`;
}

export function CoachHubScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    sessions,
    isLoading,
    loadSessions,
    loadSessionDetail,
    selectedSession,
    clearSelectedSession,
    deleteSession,
  } = useSessionsStore();

  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSessions();
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions]);

  const handleSessionPress = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void loadSessionDetail(id);
    setShowSessionDetail(true);
  }, [loadSessionDetail]);

  const handleCloseSessionDetail = useCallback(() => {
    setShowSessionDetail(false);
    clearSelectedSession();
  }, [clearSelectedSession]);

  const handleDeleteSession = useCallback(async () => {
    if (!selectedSession) return;
    await deleteSession(selectedSession.id);
    handleCloseSessionDetail();
  }, [selectedSession, deleteSession, handleCloseSessionDetail]);

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
          onPress: () => void deleteSession(session.id),
        },
      ]
    );
  }, [deleteSession]);

  const handleStartSession = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/session');
  }, [router]);

  const bottomOffset = TAB_BAR.height + insets.bottom + SPACING.lg;

  return (
    <View style={styles.container}>
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading your coaching history...</Text>
            </>
          ) : (
            <>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={48} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Sessions Yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a coaching session to review what is working, adjust your habits, and build momentum.
              </Text>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomOffset + 72 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {sessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              onPress={handleSessionPress}
              onDelete={handleSwipeDelete}
            />
          ))}
        </ScrollView>
      )}

      <Pressable
        style={[styles.fab, { bottom: bottomOffset }]}
        onPress={handleStartSession}
        accessibilityRole="button"
        accessibilityLabel="Start a new coaching session"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <SessionDetailModal
        visible={showSessionDetail}
        session={selectedSession}
        onClose={handleCloseSessionDetail}
        onDelete={handleDeleteSession}
      />
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm + 1,
    color: colors.textSecondary,
    textAlign: 'center',
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
});
