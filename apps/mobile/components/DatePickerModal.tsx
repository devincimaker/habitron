import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTodayDate } from '@habits-coach/shared';
import { PickerDialog } from './PickerDialog';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import {
  getMonthInfo,
  getNextMonth,
  getPreviousMonth,
  toDateString,
} from '../utils/dateUtils';
import { getTaskDateOptions } from '../utils/taskDateOptions';

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  /** YYYY-MM-DD; omitted when nothing is scheduled yet. */
  value?: string;
  onCancel: () => void;
  onDone: (date: string) => void;
  /** Renders the Today / Tomorrow / Next Monday shortcuts above the grid. */
  showQuickOptions?: boolean;
  /** Renders a "Clear" action that unsets the date. */
  onClear?: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year, month: month - 1 };
}

export function formatPickerDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function DatePickerModal({
  visible,
  title,
  value,
  onCancel,
  onDone,
  showQuickOptions = false,
  onClear,
}: DatePickerModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [selected, setSelected] = useState(value);
  const [{ year, month }, setVisibleMonth] = useState(() =>
    parseYearMonth(value ?? getTodayDate())
  );

  useEffect(() => {
    if (!visible) return;
    setSelected(value);
    setVisibleMonth(parseYearMonth(value ?? getTodayDate()));
  }, [visible, value]);

  const selectDate = (date: string) => {
    setSelected(date);
    setVisibleMonth(parseYearMonth(date));
  };

  const monthInfo = getMonthInfo(year, month);
  const today = getTodayDate();
  const cells: Array<{ key: string; day?: number; date?: string }> = [];
  for (let index = 0; index < monthInfo.firstDayOfWeek; index++) {
    cells.push({ key: `empty-${index}` });
  }
  for (let day = 1; day <= monthInfo.daysInMonth; day++) {
    const date = toDateString(year, month + 1, day);
    cells.push({ key: date, day, date });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `trailing-${cells.length}` });
  }

  // Explicit week rows: percentage-width cells round up and wrap to six per row.
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7)
  );

  return (
    <PickerDialog
      visible={visible}
      title={title}
      onCancel={onCancel}
      onDone={() => selected && onDone(selected)}
      doneDisabled={!selected}
      clearLabel={onClear ? 'Clear' : undefined}
      onClear={onClear}
    >
      {showQuickOptions ? (
        <View style={styles.quickOptions}>
          {getTaskDateOptions().map((option) => {
            const isSelected = option.date === selected;

            return (
              <Pressable
                key={option.key}
                style={styles.quickOption}
                onPress={() => selectDate(option.date)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[styles.quickOptionLabel, isSelected && styles.quickOptionLabelSelected]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.monthHeader}>
        <Pressable
          style={styles.navButton}
          onPress={() => setVisibleMonth(getPreviousMonth(year, month))}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month]}
          {year !== new Date().getFullYear() ? ` ${year}` : ''}
        </Text>
        <Pressable
          style={styles.navButton}
          onPress={() => setVisibleMonth(getNextMonth(year, month))}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {week.map((cell) => {
            if (!cell.date) {
              return <View key={cell.key} style={styles.cell} />;
            }
            const isSelected = cell.date === selected;
            const isToday = cell.date === today;
            return (
              <Pressable
                key={cell.key}
                style={styles.cell}
                onPress={() => setSelected(cell.date)}
                accessibilityRole="button"
                accessibilityLabel={cell.date}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && !isSelected && styles.dayCircleToday,
                    isSelected && styles.dayCircleSelected,
                  ]}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                    {cell.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </PickerDialog>
  );
}

const DAY_SIZE = 40;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    quickOptions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: SPACING.md,
    },
    quickOption: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
    },
    quickOptionLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    quickOptionLabelSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    navButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthTitle: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: SPACING.xs,
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      ...TYPOGRAPHY.caption,
      color: colors.textLight,
    },
    weekRow: {
      flexDirection: 'row',
    },
    cell: {
      flex: 1,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircle: {
      width: DAY_SIZE,
      height: DAY_SIZE,
      borderRadius: DAY_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircleToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayCircleSelected: {
      backgroundColor: colors.primary,
    },
    dayText: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      fontWeight: '500',
    },
    dayTextSelected: {
      color: colors.white,
      fontWeight: '700',
    },
  });
