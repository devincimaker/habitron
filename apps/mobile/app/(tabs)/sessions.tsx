import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import type { CoachingSessionSummary } from '@habits-coach/shared';
import { Feather } from '@expo/vector-icons';
import { useSessionsStore } from '../../stores/useSessionsStore';
import { SessionListItem } from '../../components/SessionListItem';
import { SessionDetailModal } from '../../components/SessionDetailModal';
import { SPACING, FONT_SIZES, type Colors } from '../../constants/theme';
import { useThemedStyles, useColors } from '../../hooks/useColors';

function buildMemoryWarning(memoryCount: number | undefined): string {
  if (!memoryCount) return '';
  const noun = memoryCount === 1 ? 'memory' : 'memories';
  return `\n\nThis will also delete ${memoryCount} associated ${noun}.`;
}

export default function SessionsScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
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

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const handleSessionPress = useCallback((id: string) => {
    loadSessionDetail(id);
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
          onPress: () => deleteSession(session.id),
        },
      ]
    );
  }, [deleteSession]);

  if (sessions.length === 0 && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Feather name="message-circle" size={48} color={colors.textLight} />
          </View>
          <Text style={styles.emptyTitle}>No Sessions Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the button below to start a coaching session and get personalized guidance
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
    paddingBottom: SPACING.xxl * 2, // Space for tab bar with center button
  },
  // Empty state
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
});
