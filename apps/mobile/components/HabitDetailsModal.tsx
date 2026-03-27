import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Habit, HabitStatus } from '@habits-coach/shared';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../constants/theme';
import { HeadingLarge, HeadingMedium, Caption, DisplayMedium, BodyMedium } from './ui';
import { MonthlyCalendar } from './MonthlyCalendar';
import { getLogsForHabitInRange, setHabitStatus } from '../services/habits';
import {
  getMonthInfo,
  getPreviousMonth,
  getNextMonth,
  isMonthAfterOrEqual,
  getDateFromTimestamp,
} from '../utils/dateUtils';
import {
  calculateMonthlyCheckIns,
  calculateMonthlyRate,
  calculateStreak,
  HabitStats,
} from '../utils/habitStats';
import { useThemedStyles, useColors } from '../hooks/useColors';

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

interface HabitDetailsModalProps {
  visible: boolean;
  habit: Habit | null;
  onClose: () => void;
}

export function HabitDetailsModal({ visible,
  habit,
  onClose,
}: HabitDetailsModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const habitId = habit?.id;

  // Current displayed month
  const [displayYear, setDisplayYear] = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth());

  // Cached logs per month: key = "YYYY-MM"
  const [monthLogs, setMonthLogs] = useState<
    Map<string, Map<string, HabitStatus>>
  >(new Map());

  // All-time logs for streak and total calculation
  const [allLogs, setAllLogs] = useState<Map<string, HabitStatus>>(new Map());

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<HabitStats>({
    monthlyCheckIns: 0,
    totalCheckIns: 0,
    monthlyRate: 0,
    currentStreak: 0,
  });

  // Reset state when habit changes or modal opens
  useEffect(() => {
    if (visible && habit) {
      const now = new Date();
      setDisplayYear(now.getFullYear());
      setDisplayMonth(now.getMonth());
      setMonthLogs(new Map());
      setAllLogs(new Map());
    }
  }, [visible, habitId]);

  // Fetch logs for current displayed month
  useEffect(() => {
    if (!visible || !habitId) return;

    const monthKey = getMonthKey(displayYear, displayMonth);

    // Check cache first
    if (monthLogs.has(monthKey)) {
      updateStats(monthLogs.get(monthKey)!);
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const monthInfo = getMonthInfo(displayYear, displayMonth);
        const logs = await getLogsForHabitInRange(
          habitId,
          monthInfo.startDate,
          monthInfo.endDate
        );

        setMonthLogs((prev) => {
          const newMap = new Map(prev);
          newMap.set(monthKey, logs);
          return newMap;
        });

        // Merge into allLogs for streak
        setAllLogs((prev) => {
          const newMap = new Map(prev);
          for (const [date, status] of logs) {
            newMap.set(date, status);
          }
          return newMap;
        });

        updateStats(logs);
      } catch (error) {
        console.error('Failed to fetch month logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [visible, habitId, displayYear, displayMonth]);

  const updateStats = useCallback(
    (currentMonthLogs: Map<string, HabitStatus>) => {
      if (!habit) return;

      const monthlyCheckIns = calculateMonthlyCheckIns(currentMonthLogs);
      const monthlyRate = calculateMonthlyRate(
        currentMonthLogs,
        displayYear,
        displayMonth,
        habit.createdAt
      );

      // Total check-ins from all cached logs
      let total = 0;
      for (const status of allLogs.values()) {
        if (status === 'completed') total++;
      }

      // Add current month if not in allLogs yet
      for (const [date, status] of currentMonthLogs) {
        if (!allLogs.has(date) && status === 'completed') {
          total++;
        }
      }

      const currentStreak = calculateStreak(
        new Map([...allLogs, ...currentMonthLogs]),
        habit.createdAt
      );

      setStats({
        monthlyCheckIns,
        totalCheckIns: total,
        monthlyRate,
        currentStreak,
      });
    },
    [habit, displayYear, displayMonth, allLogs]
  );

  // Navigation constraints
  const canGoBack = useCallback(() => {
    if (!habit) return false;
    const { year: createdYear, month: createdMonth } = getDateFromTimestamp(
      habit.createdAt
    );
    const { year: prevYear, month: prevMonth } = getPreviousMonth(
      displayYear,
      displayMonth
    );
    return isMonthAfterOrEqual(prevYear, prevMonth, createdYear, createdMonth);
  }, [habit, displayYear, displayMonth]);

  const canGoForward = useCallback(() => {
    const today = new Date();
    return (
      displayYear < today.getFullYear() ||
      (displayYear === today.getFullYear() && displayMonth < today.getMonth())
    );
  }, [displayYear, displayMonth]);

  const handlePreviousMonth = useCallback(() => {
    const { year, month } = getPreviousMonth(displayYear, displayMonth);
    setDisplayYear(year);
    setDisplayMonth(month);
  }, [displayYear, displayMonth]);

  const handleNextMonth = useCallback(() => {
    const { year, month } = getNextMonth(displayYear, displayMonth);
    setDisplayYear(year);
    setDisplayMonth(month);
  }, [displayYear, displayMonth]);

  // Day tap handler: cycle pending -> completed -> skipped -> pending
  const handleDayPress = useCallback(
    async (date: string, currentStatus: HabitStatus | undefined) => {
      if (!habit) return;

      const getNextStatus = (status: HabitStatus | undefined): HabitStatus => {
        switch (status) {
          case 'completed':
            return 'skipped';
          case 'skipped':
            return 'pending';
          default:
            return 'completed';
        }
      };

      const nextStatus = getNextStatus(currentStatus);

      // Optimistic update
      const monthKey = getMonthKey(displayYear, displayMonth);
      setMonthLogs((prev) => {
        const newMap = new Map(prev);
        const currentLogs = new Map(newMap.get(monthKey) || new Map());
        if (nextStatus === 'pending') {
          currentLogs.delete(date);
        } else {
          currentLogs.set(date, nextStatus);
        }
        newMap.set(monthKey, currentLogs);
        return newMap;
      });

      setAllLogs((prev) => {
        const newMap = new Map(prev);
        if (nextStatus === 'pending') {
          newMap.delete(date);
        } else {
          newMap.set(date, nextStatus);
        }
        return newMap;
      });

      // Persist to backend
      try {
        await setHabitStatus(habit.id, date, nextStatus);
      } catch (error) {
        console.error('Failed to update status:', error);
        // Could revert optimistic update here if needed
      }
    },
    [habit, displayYear, displayMonth]
  );

  // Recalculate stats when monthLogs changes
  useEffect(() => {
    const monthKey = getMonthKey(displayYear, displayMonth);
    const currentLogs = monthLogs.get(monthKey);
    if (currentLogs && habit) {
      updateStats(currentLogs);
    }
  }, [monthLogs, displayYear, displayMonth, habit, updateStats]);

  if (!habit) return null;

  const currentMonthLogs =
    monthLogs.get(getMonthKey(displayYear, displayMonth)) || new Map();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      testID="habit-details-modal"
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.backButton}
            testID="back-button"
          >
            <Ionicons name="chevron-back" size={28} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {habit.name}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Calendar */}
          {isLoading ? (
            <View style={styles.loadingContainer} testID="loading-indicator">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <MonthlyCalendar
              year={displayYear}
              month={displayMonth}
              logs={currentMonthLogs}
              habitCreatedAt={habit.createdAt}
              onDayPress={handleDayPress}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              canGoBack={canGoBack()}
              canGoForward={canGoForward()}
            />
          )}

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <HeadingMedium style={styles.statsTitle}>Check-ins Statistics</HeadingMedium>
            <View style={styles.statsGrid}>
              <StatCard
                icon="checkmark-circle"
                iconColor={colors.success}
                label="Monthly Check-ins"
                value={stats.monthlyCheckIns}
                unit={stats.monthlyCheckIns === 1 ? 'Day' : 'Days'}
              />
              <StatCard
                icon="checkmark-done-circle"
                iconColor={colors.success}
                label="Total Check-ins"
                value={stats.totalCheckIns}
                unit={stats.totalCheckIns === 1 ? 'Day' : 'Days'}
              />
              <StatCard
                icon="pie-chart"
                iconColor={colors.primary}
                label="Monthly Check-in Rate"
                value={stats.monthlyRate}
                unit="%"
              />
              <StatCard
                icon="flame"
                iconColor={colors.streak}
                label="Streak"
                value={stats.currentStreak}
                unit={stats.currentStreak === 1 ? 'Day' : 'Days'}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
  unit,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  unit: string; }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Caption style={styles.statLabel}>{label}</Caption>
      </View>
      <View style={styles.statValueRow}>
        <DisplayMedium>{value}</DisplayMedium>
        <BodyMedium color={colors.textSecondary}>{unit}</BodyMedium>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    ...TYPOGRAPHY.headingLarge,
    color: colors.white,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  statsSection: {
    backgroundColor: colors.background,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
  },
  statsTitle: {
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  statLabel: {
    color: colors.textSecondary,
    flex: 1,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
});
