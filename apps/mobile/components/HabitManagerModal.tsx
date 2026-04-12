import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Habit } from '@habits-coach/shared';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { BodyMedium, Caption, HeadingMedium } from './ui';
import { formatHabitSchedule } from '../utils/habitSchedule';

type HabitManagerTab = 'active' | 'archived';
type IoniconName = keyof typeof Ionicons.glyphMap;

const DEFAULT_HABIT_ICON = 'flash';

interface HabitManagerModalProps {
  visible: boolean;
  habits: Habit[];
  isLoading?: boolean;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onRestore: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitManagerModal({
  visible,
  habits,
  isLoading = false,
  onClose,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: HabitManagerModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<HabitManagerTab>('active');

  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.active),
    [habits]
  );
  const archivedHabits = useMemo(
    () => habits.filter((habit) => !habit.active),
    [habits]
  );

  useEffect(() => {
    if (visible) {
      setSelectedTab('active');
    }
  }, [visible]);

  const listData = selectedTab === 'active' ? activeHabits : archivedHabits;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />

            <View style={styles.segmentedControl}>
              {(['active', 'archived'] as const).map((tab) => {
                const isSelected = selectedTab === tab;

                return (
                  <Pressable
                    key={tab}
                    style={[styles.segment, isSelected && styles.segmentSelected]}
                    onPress={() => setSelectedTab(tab)}
                  >
                    <BodyMedium
                      color={isSelected ? colors.text : colors.textSecondary}
                      style={styles.segmentLabel}
                    >
                      {tab === 'active' ? 'Active' : 'Archived'}
                    </BodyMedium>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.doneButton} onPress={onClose}>
              <Ionicons name="checkmark" size={22} color={colors.white} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(habit) => habit.id}
              renderItem={({ item }) => (
                <HabitManagerRow
                  habit={item}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  onDelete={onDelete}
                />
              )}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Ionicons
                    name={selectedTab === 'active' ? 'book-outline' : 'archive-outline'}
                    size={40}
                    color={colors.textLight}
                  />
                  <HeadingMedium style={styles.emptyTitle}>
                    {selectedTab === 'active' ? 'No active habits' : 'No archived habits'}
                  </HeadingMedium>
                  <Caption style={styles.emptyBody}>
                    {selectedTab === 'active'
                      ? 'Your active habits will show up here.'
                      : 'Archived habits can be restored from here.'}
                  </Caption>
                </View>
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

interface HabitManagerRowProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onRestore: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

function HabitManagerRow({
  habit,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: HabitManagerRowProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const swipeableRef = useRef<Swipeable>(null);
  const iconName = (habit.icon || DEFAULT_HABIT_ICON) as IoniconName;

  const close = () => swipeableRef.current?.close();
  const handleAction = (callback: (habit: Habit) => void) => {
    callback(habit);
    close();
  };

  const actions = habit.active
    ? [
        {
          key: 'edit',
          icon: 'pencil' as IoniconName,
          color: '#F97316',
          onPress: () => handleAction(onEdit),
        },
        {
          key: 'archive',
          icon: 'archive-outline' as IoniconName,
          color: colors.primary,
          onPress: () => handleAction(onArchive),
        },
        {
          key: 'delete',
          icon: 'trash-outline' as IoniconName,
          color: colors.error,
          onPress: () => handleAction(onDelete),
        },
      ]
    : [
        {
          key: 'restore',
          icon: 'return-up-back-outline' as IoniconName,
          color: colors.primary,
          onPress: () => handleAction(onRestore),
        },
        {
          key: 'delete',
          icon: 'trash-outline' as IoniconName,
          color: colors.error,
          onPress: () => handleAction(onDelete),
        },
      ];

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      rightThreshold={32}
      renderRightActions={() => (
        <View style={[styles.actionsContainer, { width: actions.length * 72 }]}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.actionButton, { backgroundColor: action.color }]}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <Ionicons name={action.icon} size={20} color={colors.white} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    >
      <Pressable style={styles.row} onPress={() => onEdit(habit)}>
        <View style={styles.rowIcon}>
          <Ionicons name={iconName} size={20} color={habit.active ? colors.primary : colors.textLight} />
        </View>

        <View style={styles.rowCopy}>
          <HeadingMedium numberOfLines={1}>{habit.name}</HeadingMedium>
          <Caption style={styles.rowMeta}>{formatHabitMeta(habit)}</Caption>
        </View>

        <Caption>{habit.active ? 'Active' : 'Archived'}</Caption>
      </Pressable>
    </Swipeable>
  );
}

function formatHabitMeta(habit: Habit): string {
  const parts = [habit.frequency === 'daily' ? 'Daily' : 'Weekly'];

  parts.push(formatHabitSchedule(habit));

  if (habit.timeOfDay && habit.timeOfDay !== 'anytime') {
    parts.push(habit.timeOfDay.charAt(0).toUpperCase() + habit.timeOfDay.slice(1));
  }

  return parts.join(' · ');
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      flex: 1,
      marginTop: SPACING.md,
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    headerSpacer: {
      width: 48,
    },
    segmentedControl: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.full,
      padding: 4,
      gap: 4,
    },
    segment: {
      minWidth: 72,
      minHeight: 36,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentSelected: {
      backgroundColor: colors.background,
      ...SHADOWS.small,
    },
    segmentLabel: {
      fontWeight: '600',
    },
    doneButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.small,
    },
    listContent: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xxl,
      gap: SPACING.xs,
      flexGrow: 1,
    },
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    emptyTitle: {
      marginTop: SPACING.sm,
    },
    emptyBody: {
      textAlign: 'center',
    },
    row: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
    },
    rowMeta: {
      marginTop: 2,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginVertical: SPACING.xs,
      borderTopRightRadius: BORDER_RADIUS.lg,
      borderBottomRightRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
    },
    actionButton: {
      width: 72,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
