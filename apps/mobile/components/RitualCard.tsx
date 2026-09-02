import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { BORDER_RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface RitualCardProps {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  /** The one line under the label: done or not, and how big the ask is. */
  meta: string;
  /** Whether the ritual's own record exists — a filled check, not a hollow nudge. */
  done: boolean;
  onPress: () => void;
}

/** A coach practice as a tappable row: the hub's two daily rituals, and the goals review. */
export function RitualCard({ icon, label, meta, done, onPress }: RitualCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${meta}`}
    >
      <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
        <Feather name={icon} size={18} color={done ? colors.white : colors.textSecondary} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>

      {/* Filled when the record exists, hollow when it does not — the hollow
          circle is the nudge, so it has to read as unfinished. */}
      <View style={[styles.status, done ? styles.statusDone : styles.statusPending]}>
        {done && <Feather name="check" size={14} color={colors.white} />}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: TOUCH_TARGET.min,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    cardPressed: {
      opacity: 0.85,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.controlFill,
      marginRight: SPACING.sm + 4,
    },
    iconWrapDone: {
      backgroundColor: colors.primary,
    },
    copy: {
      flex: 1,
    },
    label: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.text,
    },
    meta: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    status: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDone: {
      backgroundColor: colors.primary,
    },
    statusPending: {
      borderWidth: 2,
      borderColor: colors.hairline,
    },
  });
