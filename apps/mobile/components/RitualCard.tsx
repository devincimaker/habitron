import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RitualDefinition } from '../constants/rituals';
import type { RitualState } from '../stores/useRitualsStore';
import { BORDER_RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface RitualCardProps {
  ritual: RitualDefinition;
  state: RitualState;
  onPress: (ritual: RitualDefinition) => void;
}

export function RitualCard({ ritual, state, onPress }: RitualCardProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const { doneOnDate, streak } = state;

  const meta = [
    doneOnDate ? 'Done' : `Not yet · ${ritual.notYetHint}`,
    streak.current > 0 ? `${streak.current} day streak` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(ritual)}
      accessibilityRole="button"
      accessibilityLabel={`${ritual.label}. ${meta}`}
    >
      <View style={[styles.iconWrap, doneOnDate && styles.iconWrapDone]}>
        <Feather
          name={ritual.icon}
          size={18}
          color={doneOnDate ? colors.white : colors.textSecondary}
        />
      </View>

      <View style={styles.copy}>
        <Text style={styles.label}>{ritual.label}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>

      {/* Filled when the day's record exists, hollow when it does not — the
          hollow circle is the nudge, so it has to read as unfinished. */}
      <View style={[styles.status, doneOnDate ? styles.statusDone : styles.statusPending]}>
        {doneOnDate && <Feather name="check" size={14} color={colors.white} />}
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
