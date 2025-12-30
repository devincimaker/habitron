import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage as ChatMessageType } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../constants/theme';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>S</Text>
        </View>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.sm,
  },
  bubble: {
    maxWidth: '75%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
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
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.white,
  },
});
