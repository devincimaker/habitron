import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, CATEGORY_COLORS } from '../constants/theme';
import type { CoachingSessionDetail } from '@habits-coach/shared';

interface SessionDetailModalProps {
  visible: boolean;
  session: CoachingSessionDetail | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export function SessionDetailModal({
  visible,
  session,
  onClose,
  onDelete,
}: SessionDetailModalProps) {
  const insets = useSafeAreaInsets();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    const memoryCount = session?.memories?.length || 0;
    const message = memoryCount > 0
      ? `This will also delete ${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} from this session.`
      : 'This action cannot be undone.';

    Alert.alert(
      'Delete Session?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete();
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [session, onDelete]);

  if (!session) return null;

  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const hasMemories = session.memories && session.memories.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {session.name || 'Untitled Session'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {dateStr} at {timeStr}
            </Text>
          </View>
          <Pressable onPress={handleDelete} style={styles.deleteButton} disabled={isDeleting}>
            {isDeleting ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons name="trash-outline" size={24} color={COLORS.error} />
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Session Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{session.messageCount} messages</Text>
            </View>
            {session.endedAt && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>
                  {Math.round((session.endedAt - session.startedAt) / 60000)} min duration
                </Text>
              </View>
            )}
          </View>

          {/* Insights/Memories Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Insights {hasMemories ? `(${session.memories.length})` : ''}
            </Text>
            {hasMemories ? (
              session.memories.map((memory) => (
                <View key={memory.id} style={styles.memoryCard}>
                  <View style={[
                    styles.memoryCategoryBadge,
                    { backgroundColor: `${CATEGORY_COLORS[memory.category] || COLORS.primaryLight}20` }
                  ]}>
                    <Text style={[
                      styles.memoryCategoryText,
                      { color: CATEGORY_COLORS[memory.category] || COLORS.primary }
                    ]}>
                      {memory.category}
                    </Text>
                  </View>
                  <Text style={styles.memoryContent}>{memory.content}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="bulb-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyStateText}>
                  No insights were captured from this session
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  memoryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memoryCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  memoryCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  memoryContent: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});
