import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES } from '../constants/theme';
import type { CoachingSessionSummary } from '@habits-coach/shared';

interface SessionListItemProps {
  session: CoachingSessionSummary;
  onPress: (id: string) => void;
}

export function SessionListItem({ session, onPress }: SessionListItemProps) {
  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress(session.id)}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {session.name || 'Untitled Session'}
        </Text>
        <Text style={styles.meta}>
          {dateStr} at {timeStr} · {session.messageCount} messages
          {session.memoryCount ? ` · ${session.memoryCount} memories` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZES.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  meta: {
    fontSize: FONT_SIZES.footnote,
    color: COLORS.textSecondary,
  },
});
