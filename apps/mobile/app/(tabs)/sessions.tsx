import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSessionsStore } from '../../stores/useSessionsStore';
import { SessionListItem } from '../../components/SessionListItem';
import { SessionDetailModal } from '../../components/SessionDetailModal';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';

export default function SessionsScreen() {
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

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  // Handle session press
  const handleSessionPress = useCallback((id: string) => {
    loadSessionDetail(id);
    setShowSessionDetail(true);
  }, [loadSessionDetail]);

  const handleCloseSessionDetail = useCallback(() => {
    setShowSessionDetail(false);
    clearSelectedSession();
  }, [clearSelectedSession]);

  const handleDeleteSession = useCallback(async () => {
    if (selectedSession) {
      await deleteSession(selectedSession.id);
      handleCloseSessionDetail();
    }
  }, [selectedSession, deleteSession, handleCloseSessionDetail]);

  // Empty state
  if (sessions.length === 0 && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Feather name="message-circle" size={48} color={COLORS.textLight} />
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
            tintColor={COLORS.primary}
          />
        }
      >
        {sessions.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            onPress={handleSessionPress}
          />
        ))}
      </ScrollView>

      {/* Session Detail Modal */}
      <SessionDetailModal
        visible={showSessionDetail}
        session={selectedSession}
        onClose={handleCloseSessionDetail}
        onDelete={handleDeleteSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg + 2,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
