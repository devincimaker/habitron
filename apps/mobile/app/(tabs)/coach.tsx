import { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSessionStore } from '../../stores/useSessionStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useMemoriesStore } from '../../stores/useMemoriesStore';
import { ChatMessage } from '../../components/ChatMessage';
import { SuggestionCard } from '../../components/SuggestionCard';
import { sendMessage } from '../../services/api';
import { ChatMessage as ChatMessageType, HabitAction } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function CoachScreen() {
  const {
    isActive,
    messages,
    isLoading,
    startSession,
    endSession,
    addMessage,
    setLoading,
  } = useSessionStore();

  const { habits, addHabit, removeHabit, updateHabit } = useHabitsStore();
  const { memories, loadMemories } = useMemoriesStore();

  const [inputText, setInputText] = useState('');
  const [pendingAction, setPendingAction] = useState<HabitAction | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load memories on mount
  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleStartSession = useCallback(() => {
    startSession();
  }, [startSession]);

  const handleEndSession = useCallback(() => {
    setPendingAction(null);
    endSession();
  }, [endSession]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    setPendingAction(null);

    // Add user message
    addMessage({ role: 'user', content: text });

    // Get AI response
    setLoading(true);
    try {
      const allMessages = [...messages, { role: 'user' as const, content: text, id: '', timestamp: 0 }];
      const response = await sendMessage(allMessages, habits, memories);

      // Add assistant message
      addMessage({ role: 'assistant', content: response.message, action: response.action });

      // If there's an action, show the suggestion card
      if (response.action) {
        setPendingAction(response.action);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [inputText, isLoading, messages, habits, memories, addMessage, setLoading]);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      switch (pendingAction.type) {
        case 'add':
          await addHabit({
            name: pendingAction.habit.name,
            frequency: pendingAction.habit.frequency,
            timeOfDay: pendingAction.habit.timeOfDay,
            reason: pendingAction.habit.reason,
          });
          addMessage({
            role: 'assistant',
            content: `Great! I've added "${pendingAction.habit.name}" to your habits. You can track it on your Habits screen.`,
          });
          break;

        case 'remove':
          if (pendingAction.habit.id) {
            await removeHabit(pendingAction.habit.id);
            addMessage({
              role: 'assistant',
              content: `Done! I've removed "${pendingAction.habit.name}" from your habits.`,
            });
          }
          break;

        case 'edit':
          if (pendingAction.habit.id) {
            await updateHabit(pendingAction.habit.id, {
              name: pendingAction.habit.name,
              frequency: pendingAction.habit.frequency,
              timeOfDay: pendingAction.habit.timeOfDay,
              reason: pendingAction.habit.reason,
            });
            addMessage({
              role: 'assistant',
              content: `Updated! "${pendingAction.habit.name}" has been modified.`,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error executing action:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.',
      });
    }

    setPendingAction(null);
  }, [pendingAction, addHabit, removeHabit, updateHabit, addMessage]);

  const handleDismissAction = useCallback(() => {
    setPendingAction(null);
    addMessage({
      role: 'assistant',
      content: 'No problem! Is there anything else you would like to work on?',
    });
  }, [addMessage]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Not in session - show start button
  if (!isActive) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.primary]}
          style={styles.startContainer}
        >
          <View style={styles.coachAvatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
          <Text style={styles.coachName}>Coach Sage</Text>
          <Text style={styles.coachSubtitle}>
            Ready to help you build better habits
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartSession}
            activeOpacity={0.9}
          >
            <Text style={styles.startButtonText}>Start Coaching Session</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // In session - show chat interface
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header with end session button */}
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>Session Active</Text>
        <TouchableOpacity onPress={handleEndSession} activeOpacity={0.7}>
          <Text style={styles.endSessionText}>End Session</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onLayout={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={
          <>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.loadingText}>Sage is thinking...</Text>
              </View>
            )}
            {pendingAction && (
              <SuggestionCard
                action={pendingAction}
                onConfirm={handleConfirmAction}
                onDismiss={handleDismissAction}
              />
            )}
          </>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor={COLORS.textLight}
          multiline
          maxLength={500}
          editable={!isLoading}
          onSubmitEditing={handleSendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Start session screen
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  coachAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  coachName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  coachSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  startButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  // Session header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sessionTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '500',
  },
  endSessionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontWeight: '500',
  },
  // Messages
  messageList: {
    paddingVertical: SPACING.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  loadingText: {
    marginLeft: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  sendButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
});
