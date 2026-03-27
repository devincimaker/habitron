import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../stores/useAuthStore';
import { useMemoriesStore } from '../stores/useMemoriesStore';
import type { Memory } from '@habits-coach/shared';
import { Button, Input, Avatar, Card, HeadingLarge, BodyMedium, BodySmall } from '../components/ui';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, CATEGORY_COLORS, CATEGORY_LABELS, TOUCH_TARGET, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

export default function ProfileScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const { memories, isLoading, loadMemories, updateMemory, deleteMemory } =
    useMemoriesStore();

  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

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
      <Card variant="surface">
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
        <BodyMedium color={colors.text}>{item.content}</BodyMedium>
      </Card>
    ),
    [handleEditMemory, handleDeleteMemory]
  );

  const keyExtractor = useCallback((item: Memory) => item.id, []);

  const ListHeader = (
    <>
      {/* Custom header with close button */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.userSection}>
        <Avatar
          text={user?.email || '?'}
          size="lg"
          style={styles.avatar}
        />
        <BodyMedium>{user?.email || 'Not signed in'}</BodyMedium>
      </View>

      <View style={styles.sectionHeader}>
        <HeadingLarge style={styles.sectionTitle}>Memories</HeadingLarge>
        <BodySmall>Things Habitron remembers about you</BodySmall>
      </View>
    </>
  );

  const ListEmpty = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🧠</Text>
      <BodyMedium style={styles.emptyText}>
        {isLoading
          ? 'Loading memories...'
          : 'No memories yet.\nChat with Habitron to build your profile.'}
      </BodyMedium>
    </View>
  );

  const ListFooter = (
    <View style={[styles.actions, { paddingBottom: insets.bottom || SPACING.lg }]}>
      <Button
        title="Sign Out"
        variant="destructive"
        onPress={handleLogout}
        size="lg"
        fullWidth
      />
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
            <HeadingLarge style={styles.modalTitle}>Edit Memory</HeadingLarge>
            <Input
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
              placeholder="Memory content..."
              containerStyle={styles.modalInputContainer}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={handleCancelEdit}
                size="md"
              />
              <Button
                title="Save"
                onPress={handleSaveEdit}
                size="md"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: SPACING.lg,
  },
  closeButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: TOUCH_TARGET.min,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  // User section
  userSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    marginBottom: SPACING.md,
  },
  // Memories section
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    marginBottom: SPACING.xs,
  },
  // Memory card
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
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  memoryActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  editText: {
    color: colors.primary,
    ...TYPOGRAPHY.label,
  },
  deleteText: {
    color: colors.error,
    ...TYPOGRAPHY.label,
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
    textAlign: 'center',
  },
  // Actions
  actions: {
    marginTop: SPACING.xl,
    paddingBottom: SPACING.lg,
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
    backgroundColor: colors.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: SPACING.md,
  },
  modalInputContainer: {
    marginBottom: 0,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
