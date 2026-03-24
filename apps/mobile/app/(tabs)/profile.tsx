import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMemoriesStore } from '../../stores/useMemoriesStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { Button, Input, Avatar, HeadingLarge, BodyMedium, Caption } from '../../components/ui';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
  TAB_BAR,
  TOUCH_TARGET,
} from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const { memories, loadMemories } = useMemoriesStore();
  const { name, dailyReminderEnabled, updateName, updateDailyReminder, isLoading: isProfileLoading } = useProfileStore();

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

  const handleOpenMemories = useCallback(() => {
    router.push('/memories');
  }, [router]);

  const handleOpenSessions = useCallback(() => {
    router.push('/sessions');
  }, [router]);

  const handleToggleReminder = useCallback(async (enabled: boolean) => {
    const { error } = await updateDailyReminder(enabled);
    if (error) {
      Alert.alert('Error', 'Failed to update notification settings');
    }
  }, [updateDailyReminder]);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingBottom: TAB_BAR.height + insets.bottom + SPACING.lg }]}>
        {/* Profile info */}
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

        {/* Menu items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuRow} onPress={handleOpenMemories}>
            <View style={styles.menuRowLeft}>
              <Feather name="database" size={20} color={COLORS.text} style={styles.menuIcon} />
              <BodyMedium>Memories</BodyMedium>
            </View>
            <View style={styles.menuRowRight}>
              {memories.length > 0 && (
                <Caption style={styles.menuCount}>{memories.length}</Caption>
              )}
              <Feather name="chevron-right" size={20} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { marginTop: SPACING.sm }]} onPress={handleOpenSessions}>
            <View style={styles.menuRowLeft}>
              <Feather name="message-square" size={20} color={COLORS.text} style={styles.menuIcon} />
              <BodyMedium>Session history</BodyMedium>
            </View>
            <View style={styles.menuRowRight}>
              <Feather name="chevron-right" size={20} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.menuRow, { marginTop: SPACING.sm }]}>
            <View style={styles.menuRowLeft}>
              <Feather name="bell" size={20} color={COLORS.text} style={styles.menuIcon} />
              <BodyMedium>Daily reminder</BodyMedium>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
            />
          </View>

          <TouchableOpacity
            style={[styles.menuRow, { marginTop: SPACING.sm }]}
            onPress={() => { throw new Error('Test Sentry error'); }}
          >
            <View style={styles.menuRowLeft}>
              <Feather name="alert-triangle" size={20} color={COLORS.error} style={styles.menuIcon} />
              <BodyMedium style={{ color: COLORS.error }}>Test Crash (Sentry)</BodyMedium>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLogout} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
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
  // Menu section
  menuSection: {
    marginBottom: SPACING.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    minHeight: TOUCH_TARGET.comfortable,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: SPACING.sm,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuCount: {
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  // Actions
  actions: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  signOutButton: {
    paddingVertical: SPACING.md,
  },
  signOutText: {
    color: COLORS.error,
    ...TYPOGRAPHY.label,
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
