import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage as ChatMessageType } from '@habits-coach/shared';
import { Avatar } from './ui';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface ChatMessageProps {
  message: ChatMessageType;
  /** "Spoken · 5 min": drawn above the first message of a voice-mode run. */
  divider?: string | null;
}

export function ChatMessage({ message, divider }: ChatMessageProps) {
  const [styles] = useThemedStyles(createStyles);
  const isUser = message.role === 'user';

  return (
    <>
      {divider ? (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{divider}</Text>
          <View style={styles.dividerLine} />
        </View>
      ) : null}
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
    </>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
    borderRadius: BORDER_RADIUS.lg,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BORDER_RADIUS.sm,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderTopRightRadius: BORDER_RADIUS.sm,
  },
  text: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.text,
  },
  userText: {
    color: colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...TYPOGRAPHY.caption,
    color: colors.textLight,
  },
});
