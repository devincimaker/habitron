import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { MemoryCategory } from '@habits-coach/shared';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  TYPOGRAPHY,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../constants/theme';

interface MemoryReviewCardProps {
  content: string;
  category: MemoryCategory;
  selected: boolean;
  onToggle: () => void;
}

export function MemoryReviewCard({
  content,
  category,
  selected,
  onToggle,
}: MemoryReviewCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: `${CATEGORY_COLORS[category]}20` },
          ]}
        >
          <Text
            style={[styles.categoryText, { color: CATEGORY_COLORS[category] }]}
          >
            {CATEGORY_LABELS[category]}
          </Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
      <Text style={styles.content}>{content}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.small,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    ...TYPOGRAPHY.label,
    fontWeight: 'bold',
  },
  content: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.text,
  },
});
