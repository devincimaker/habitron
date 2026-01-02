import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMemoriesStore } from '../../stores/useMemoriesStore';
import type { Memory } from '@habits-coach/shared';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants/theme';

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  motivation: 'Motivation',
  obstacle: 'Obstacle',
  preference: 'Preference',
  personal: 'Personal',
  goal: 'Goal',
  general: 'General',
};

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  motivation: '#4CAF50',
  obstacle: '#F44336',
  preference: '#2196F3',
  personal: '#9C27B0',
  goal: '#FF9800',
  general: '#607D8B',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { memories, isLoading, loadMemories, updateMemory, deleteMemory } =
    useMemoriesStore();

  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleEditMemory = useCallback((memory: Memory) => {
    setEditingMemory(memory);
    setEditContent(memory.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMemory || !editContent.trim()) return;
    try {
      await updateMemory(editingMemory.id, { content: editContent.trim() });
      setEditingMemory(null);
      setEditContent('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update memory');
    }
  }, [editingMemory, editContent, updateMemory]);

  const handleCancelEdit = useCallback(() => {
    setEditingMemory(null);
    setEditContent('');
  }, []);

  const handleDeleteMemory = useCallback(
    (memory: Memory) => {
      Alert.alert(
        'Delete Memory',
        'Are you sure you want to delete this memory?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteMemory(memory.id),
          },
        ]
      );
    },
    [deleteMemory]
  );

  const renderMemory = useCallback(
    ({ item }: { item: Memory }) => (
      <View style={styles.memoryCard}>
        <View style={styles.memoryHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: `${CATEGORY_COLORS[item.category]}20` },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: CATEGORY_COLORS[item.category] },
              ]}
            >
              {CATEGORY_LABELS[item.category]}
            </Text>
          </View>
          <View style={styles.memoryActions}>
            <TouchableOpacity
              onPress={() => handleEditMemory(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteMemory(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.memoryContent}>{item.content}</Text>
      </View>
    ),
    [handleEditMemory, handleDeleteMemory]
  );

  const keyExtractor = useCallback((item: Memory) => item.id, []);

  const ListHeader = (
    <>
      <View style={styles.userSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email || 'Not signed in'}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Memories</Text>
        <Text style={styles.sectionSubtitle}>
          Things Coach Sage remembers about you
        </Text>
      </View>
    </>
  );

  const ListEmpty = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🧠</Text>
      <Text style={styles.emptyText}>
        {isLoading
          ? 'Loading memories...'
          : 'No memories yet.\nChat with Coach Sage to build your profile.'}
      </Text>
    </View>
  );

  const ListFooter = (
    <View style={styles.actions}>
      <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
        <LinearGradient
          colors={[COLORS.error, '#D32F2F']}
          style={styles.logoutButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={memories}
        renderItem={renderMemory}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.content}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
      />

      {/* Edit Modal */}
      <Modal
        visible={!!editingMemory}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Memory</Text>
            <TextInput
              style={styles.modalInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
              placeholder="Memory content..."
              placeholderTextColor={COLORS.textLight}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveEdit}
              >
                <Text
                  style={[styles.modalButtonText, styles.modalButtonTextPrimary]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  // User section
  userSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  email: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  // Memories section
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  // Memory card
  memoryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  memoryActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  editText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  deleteText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  memoryContent: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  // Empty state
  emptyState: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Actions
  actions: {
    marginTop: SPACING.xl,
  },
  logoutButton: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  modalButtonTextPrimary: {
    color: COLORS.white,
    fontWeight: '600',
  },
});
