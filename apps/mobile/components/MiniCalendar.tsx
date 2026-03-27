import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SPACING, FONT_SIZES, type Colors } from '../constants/theme';
import { getLast7Days } from '../utils/dateUtils';
import { useThemedStyles } from '../hooks/useColors';

interface MiniCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export function MiniCalendar({
  selectedDate, onSelectDate }: MiniCalendarProps) {
  const [styles] = useThemedStyles(createStyles);
  const days = getLast7Days();

  return (
    <View style={styles.container}>
      {days.map((day) => {
        const isSelected = day.date === selectedDate;

        return (
          <Pressable
            key={day.date}
            style={styles.dayColumn}
            onPress={() => onSelectDate(day.date)}
          >
            <Text style={styles.weekdayLetter}>{day.weekdayLetter}</Text>
            <View
              style={[
                styles.dayNumberContainer,
                isSelected && styles.selectedContainer,
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  isSelected && styles.selectedText,
                ]}
              >
                {day.dayNumber}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const DAY_SIZE = 44;

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  weekdayLetter: {
    fontSize: FONT_SIZES.xs,
    color: colors.textSecondary,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  dayNumberContainer: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedContainer: {
    backgroundColor: colors.primary,
  },
  dayNumber: {
    fontSize: FONT_SIZES.md,
    color: colors.text,
    fontWeight: '500',
  },
  selectedText: {
    color: colors.white,
    fontWeight: '600',
  },
});
