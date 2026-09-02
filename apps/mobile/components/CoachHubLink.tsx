import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface CoachHubLinkProps {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  /** A short count beside the chevron; left out when there is nothing to count. */
  count?: string;
  onPress: () => void;
}

/** One of the hub's rows under the sessions: what the coach knows, and where it can go. */
export function CoachHubLink({ icon, label, count, onPress }: CoachHubLinkProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={colors.textSecondary} />
      </View>
      <Text style={styles.label}>{label}</Text>
      {count ? <Text style={styles.count}>{count}</Text> : null}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.controlFill,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    label: {
      flex: 1,
      ...TYPOGRAPHY.bodyMedium,
      color: colors.text,
    },
    count: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginRight: SPACING.xs,
    },
  });
