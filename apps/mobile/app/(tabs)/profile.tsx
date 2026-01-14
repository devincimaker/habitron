import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMemoriesStore } from '../../stores/useMemoriesStore';
import { useProfileStore } from '../../stores/useProfileStore';
import type { Memory } from '@habits-coach/shared';
import { Button, Input, Avatar, Card, HeadingLarge, BodyMedium, BodySmall, Caption } from '../../components/ui';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { memories, isLoading, loadMemories, updateMemory, deleteMemory } =
    useMemoriesStore();
  const { name, updateName, isLoading: isProfileLoading } = useProfileStore();

  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');

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

  const handleEditName = useCallback(() => {
    setEditingNameValue(name || '');
    setIsEditingName(true);
  }, [name]);

  const handleSaveName = useCallback(async () => {
    const trimmed = editingNameValue.trim();
    if (trimmed.length < 2) {
      Alert.alert('Error', trimmed ? 'Name must be at least 2 characters' : 'Please enter your name');
      return;
    }
    const { error } = await updateName(trimmed);
    if (error) {
      Alert.alert('Error', 'Failed to update name');
    } else {
      setIsEditingName(false);
      setEditingNameValue('');
    }
  }, [editingNameValue, updateName]);

  const handleCancelNameEdit = useCallback(() => {
    setIsEditingName(false);
    setEditingNameValue('');
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
        <BodyMedium color={COLORS.text}>{item.content}</BodyMedium>
      </Card>
    ),
    [handleEditMemory, handleDeleteMemory]
  );

  const keyExtractor = useCallback((item: Memory) => item.id, []);

  const ListHeader = (
    <>
      <View style={styles.userSection}>
        <Avatar
          text={name || user?.email || '?'}
          size="lg"
          style={styles.avatar}
        />
        {name && <HeadingLarge style={styles.userName}>{name}</HeadingLarge>}
        <BodyMedium style={styles.userEmail}>{user?.email || 'Not signed in'}</BodyMedium>
        <TouchableOpacity onPress={handleEditName} style={styles.editNameLink}>
          <Text style={styles.editNameText}>{name ? 'Edit name' : 'Add name'}</Text>
        </TouchableOpacity>
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
    <View style={styles.actions}>
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

      {/* Edit Memory Modal */}
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

      {/* Edit Name Modal */}
      <Modal
        visible={isEditingName}
        transparent
        animationType="fade"
        onRequestClose={handleCancelNameEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <HeadingLarge style={styles.modalTitle}>Edit Name</HeadingLarge>
            <Input
              value={editingNameValue}
              onChangeText={setEditingNameValue}
              autoFocus
              placeholder="Your name"
              autoCapitalize="words"
              containerStyle={styles.modalInputContainer}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={handleCancelNameEdit}
                size="md"
              />
              <Button
                title="Save"
                onPress={handleSaveName}
                loading={isProfileLoading}
                size="md"
              />
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
    marginBottom: SPACING.md,
  },
  userName: {
    marginBottom: SPACING.xs,
  },
  userEmail: {
    color: COLORS.textSecondary,
  },
  editNameLink: {
    marginTop: SPACING.sm,
  },
  editNameText: {
    color: COLORS.primary,
    ...TYPOGRAPHY.label,
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
    color: COLORS.primary,
    ...TYPOGRAPHY.label,
  },
  deleteText: {
    color: COLORS.error,
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
    borderRadius: BORDER_RADIUS.md,
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
