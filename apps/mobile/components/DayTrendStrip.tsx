import { View, Text, StyleSheet } from 'react-native';
import { rampColor } from '../constants/dayTrend';
import { AXIS_LABELS, TREND_AXES, formatRange, type TrendDay } from '../utils/dayTrend';
import { BORDER_RADIUS, FONT_SIZES, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

const DOT = 14;

interface DayTrendStripProps {
  window: TrendDay[];
}

/**
 * Two weeks of the four axes at a glance — and nothing more.
 *
 * At fourteen columns across a phone a column is about 23pt, so nothing here
 * can be a 44pt target: the tappable things are the gap chips and the day rows
 * below it. An unreviewed day is an empty column, never a grey middle, because
 * "I did not review" and "the day was average" are different facts.
 */
export function DayTrendStrip({ window }: DayTrendStripProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  if (window.length === 0) return null;

  const reviewed = window.filter((day) => day.review !== null).length;
  const half = Math.floor(window.length / 2);
  const today = window[window.length - 1].date;

  // The week divider rides inside the cell it precedes, so the dot rows and the
  // day numbers below them stay on the same columns.
  const renderCells = (
    render: (day: TrendDay) => React.ReactNode,
    dividerStyle: object
  ) => (
    <View style={styles.cells}>
      {window.map((day, index) => (
        <View key={day.date} style={styles.cellGroup}>
          {index === half && <View style={dividerStyle} />}
          {render(day)}
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={styles.card}
      accessibilityLabel={`Last ${window.length} days, ${reviewed} reviewed`}
    >
      {TREND_AXES.map((axis) => (
        <View key={axis} style={styles.row}>
          <Text style={styles.axisLabel}>{AXIS_LABELS[axis]}</Text>
          {renderCells((day) => {
            const color = rampColor(colors.primary, day.review?.[axis]);
            return (
              <View
                style={[styles.dot, color ? { backgroundColor: color } : styles.dotEmpty]}
              />
            );
          }, styles.weekDivider)}
        </View>
      ))}

      <View style={styles.daysRow}>
        <Text style={styles.axisLabel} />
        {renderCells(
          (day) => (
            <Text style={[styles.dayNumber, day.date === today && styles.dayNumberToday]}>
              {day.dayOfMonth}
            </Text>
          ),
          styles.weekDividerSpacer
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.count}>
          {reviewed} of {window.length} days reviewed
        </Text>
        <Text style={styles.range}>{formatRange(window[0].date, today)}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 22,
    },
    daysRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    axisLabel: {
      width: 76,
      flexShrink: 0,
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    cells: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cellGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    weekDivider: {
      width: StyleSheet.hairlineWidth,
      height: DOT,
      marginHorizontal: 2,
      backgroundColor: colors.border,
    },
    weekDividerSpacer: {
      width: StyleSheet.hairlineWidth,
      marginHorizontal: 2,
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      flexShrink: 0,
    },
    dotEmpty: {
      backgroundColor: 'transparent',
    },
    dayNumber: {
      width: DOT,
      textAlign: 'center',
      fontSize: 10,
      color: colors.textLight,
    },
    dayNumberToday: {
      color: colors.text,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: SPACING.sm + 2,
    },
    count: {
      ...TYPOGRAPHY.label,
      fontSize: FONT_SIZES.footnote,
      color: colors.text,
    },
    range: {
      fontSize: FONT_SIZES.xs,
      color: colors.textLight,
    },
  });
