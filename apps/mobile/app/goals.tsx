import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { GoalCard } from '../components/GoalCard';
import { GoalSheet } from '../components/GoalSheet';
import { BodyMedium } from '../components/ui';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { BORDER_RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { getTodayDate, type Goal } from '@habits-coach/shared';
import { countGoalTasks, isGoalOpen } from '../utils/goals';

const reportSaveFailure = () => Alert.alert('Could not save the goal', 'Please try again.');

/** Every goal, open ones first and the finished ones folded below. */
export default function GoalsScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goals = useGoalsStore((state) => state.goals);
  const addGoal = useGoalsStore((state) => state.addGoal);
  const todos = useTodosStore((state) => state.todos);
  const today = getTodayDate();

  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = useMemo(() => goals.filter(isGoalOpen), [goals]);
  const done = useMemo(
    () =>
      goals
        .filter((goal) => !isGoalOpen(goal))
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [goals]
  );

  const openGoal = useCallback(
    (goal: Goal) => router.push({ pathname: '/goal/[id]', params: { id: goal.id } }),
    [router]
  );

  const renderGoal = (goal: Goal) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      tasks={countGoalTasks(goal.id, todos)}
      today={today}
      onPress={() => openGoal(goal)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl * 2 }]}
        showsVerticalScrollIndicator={false}
      >
        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="target" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Where are you headed?</Text>
            <BodyMedium style={styles.emptyText}>
              A goal is something that ends: a finish line, a date. The coach plans your days
              toward it and links the tasks that move it.
            </BodyMedium>
          </View>
        ) : (
          <>
            {open.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Open</Text>
                <View style={styles.list}>{open.map(renderGoal)}</View>
              </View>
            ) : null}

            {done.length > 0 ? (
              <View style={styles.section}>
                <Pressable
                  style={styles.sectionToggle}
                  onPress={() => setShowDone((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Done, ${done.length}`}
                  accessibilityState={{ expanded: showDone }}
                >
                  <Text style={styles.sectionLabel}>{`Done · ${done.length}`}</Text>
                  <Ionicons
                    name={showDone ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textLight}
                  />
                </Pressable>
                {showDone ? <View style={styles.list}>{done.map(renderGoal)}</View> : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Pressable
        style={[styles.newButton, { bottom: insets.bottom + SPACING.lg }]}
        onPress={() => setCreating(true)}
        accessibilityRole="button"
        accessibilityLabel="New goal"
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.newLabel}>New goal</Text>
      </Pressable>

      <GoalSheet
        visible={creating}
        goal={null}
        onClose={() => setCreating(false)}
        onSave={(draft) => {
          setCreating(false);
          void addGoal(draft).catch(reportSaveFailure);
        }}
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
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
    content: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.lg,
      gap: SPACING.lg,
    },
    section: {
      gap: SPACING.sm,
    },
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minHeight: TOUCH_TARGET.min,
    },
    list: {
      gap: SPACING.sm,
    },
    emptyState: {
      paddingTop: SPACING.xxl,
      paddingHorizontal: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      marginBottom: SPACING.xs,
    },
    emptyTitle: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.textStrong,
    },
    emptyText: {
      textAlign: 'center',
    },
    newButton: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.lg,
      height: TOUCH_TARGET.comfortable,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
    },
    newLabel: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.white,
    },
  });
