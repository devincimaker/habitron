import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage as ChatMessageType } from '@habits-coach/shared';
import { Avatar } from './ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../constants/theme';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      {!isUser && (
        <Avatar text="S" size="sm" style={styles.avatar} />
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.text, isUser && styles.userText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    marginRight: SPACING.sm,
  },
  bubble: {
    maxWidth: '75%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  assistantBubble: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.sm,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: BORDER_RADIUS.sm,
  },
  text: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.text,
  },
  userText: {
    color: COLORS.white,
  },
});
