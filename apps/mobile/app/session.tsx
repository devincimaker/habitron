import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getTodayDate } from '@habits-coach/shared';
import { useSessionStore } from '../stores/useSessionStore';
import { useSessionsStore } from '../stores/useSessionsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';
import { useMemoriesStore } from '../stores/useMemoriesStore';
import { useProfileStore } from '../stores/useProfileStore';
import { ChatMessage } from '../components/ChatMessage';
import { CoachProposalCard } from '../components/CoachProposalCard';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { sendMessage } from '../services/api';
import {
  getCoachRequestErrorMessage,
  getCoachSessionStartErrorMessage,
} from '../services/apiUrl';
import { updateSessionSkill } from '../services/sessions';
import type { ChatMessage as ChatMessageType, ChatRequest, CoachProposal } from '@habits-coach/shared';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, TOUCH_TARGET, type Colors } from '../constants/theme';
import { applyCoachProposal } from '../utils/applyCoachProposal';
import { useThemedStyles } from '../hooks/useColors';

export default function SessionScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { autoPrompt } = useLocalSearchParams<{
    autoPrompt?: string;
  }>();

  const {
    isActive,
    sessionId,
    messages,
    isLoading,
    startSession,
    endSession,
    addMessage,
    updateMessage,
    setLoading,
    checkAndRecoverSession,
  } = useSessionStore();

  const { loadSessions } = useSessionsStore();
  const { habits, addHabit, removeHabit, updateHabit, archiveHabit } = useHabitsStore();
  const { goals, loadGoals, addGoal, updateGoal, archiveGoal } = useGoalsStore();
  const {
    todos,
    loadTodos,
    addTodo,
    updateTodo,
    setTodoStatus,
    removeTodo,
  } = useTodosStore();
  const { entries: journalEntries, loadEntries, addEntry } = useJournalStore();
  const { plansByDate, loadPlan, saveAcceptedPlan } = useDailyPlansStore();
  const { memories, loadMemories } = useMemoriesStore();
  const { name: userName } = useProfileStore();

  const [inputText, setInputText] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasSentAutoPrompt = useRef(false);
  const today = getTodayDate();
  const todayPlan = plansByDate[today] ?? null;
  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.active),
    [habits]
  );

  // Load memories on mount
  useEffect(() => {
    loadMemories();
    loadGoals();
    loadTodos();
    loadEntries();
    loadPlan(today);
  }, [loadEntries, loadGoals, loadMemories, loadPlan, loadTodos, today]);

  // Start session on mount if not already active
  useEffect(() => {
    const initSession = async () => {
      // Check for recoverable session first
      const result = await checkAndRecoverSession();
      if (result === 'finalized') {
        loadSessions();
      }

      // Start new session if not active
      if (!isActive) {
        startSession();
      }
    };
    initSession();
  }, []);

  // Handle session exit - navigate immediately, cleanup in background
  const exitSession = useCallback(() => {
    setIsClosing(true);
    loadSessions();
    router.back();
    endSession(); // Don't await - let it run in background
  }, [router, loadSessions, endSession]);

  // Helper to send message and get AI response
  const sendUserMessage = useCallback(async (text: string): Promise<boolean> => {
    let activeSessionId: string | null = null;
    let didQueueUserMessage = false;

    try {
      activeSessionId = await addMessage({ role: 'user', content: text });
      didQueueUserMessage = true;
      setLoading(true);

      const allMessages = [
        ...messages,
        { role: 'user' as const, content: text, id: '', timestamp: 0 },
      ];
      const request: ChatRequest = {
        sessionId: activeSessionId ?? useSessionStore.getState().sessionId ?? undefined,
        messages: allMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        habits: activeHabits,
        goals,
        journalEntries: journalEntries.slice(0, 10),
        dailyPlan: todayPlan,
        memories: memories.map((memory) => ({
          content: memory.content,
          category: memory.category,
        })),
        userName: userName || undefined,
        today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const response = await sendMessage(request);
      addMessage({
        role: 'assistant',
        content: response.message,
        proposal: response.proposal ?? undefined,
        proposalStatus: response.proposal ? 'pending' : undefined,
      });
      return true;
    } catch (error) {
      console.warn('Error sending message:', error);
      if (!didQueueUserMessage) {
        Alert.alert('Could not start session', getCoachSessionStartErrorMessage(error));
        return false;
      }

      await addMessage({
        role: 'assistant',
        content: getCoachRequestErrorMessage(error),
      });
      return true;
    } finally {
      if (didQueueUserMessage) {
        setLoading(false);
      }
    }
  }, [
    addMessage,
    journalEntries,
    goals,
    activeHabits,
    memories,
    messages,
    setLoading,
    today,
    todayPlan,
    todos,
    userName,
  ]);

  const performEndSession = useCallback(async () => {
    exitSession();
  }, [exitSession]);

  const handleEndSession = useCallback(() => {
    // Skip confirmation if user hasn't sent any messages
    const hasUserMessages = messages.some((m) => m.role === 'user');
    if (!hasUserMessages) {
      performEndSession();
      return;
    }

    Alert.alert(
      'End Session',
      'Are you sure you want to end this coaching session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: performEndSession,
        },
      ]
    );
  }, [messages, performEndSession]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const didSend = await sendUserMessage(text);
    if (didSend) {
      setInputText('');
    }
  }, [inputText, isLoading, sendUserMessage]);

  const handleConfirmProposal = useCallback(async (messageId: string) => {
    const proposalMessage = useSessionStore
      .getState()
      .messages
      .find((message) => message.id === messageId);
    const proposal = proposalMessage?.proposal;

    if (!proposal) return;

    updateMessage(messageId, { proposalStatus: 'applying' });

    try {
      await applyCoachProposal(proposal, {
        addGoal,
        updateGoal,
        archiveGoal,
        addHabit,
        updateHabit,
        archiveHabit,
        removeHabit,
        addTodo,
        updateTodo,
        setTodoStatus,
        removeTodo,
        addJournalEntry: addEntry,
        saveAcceptedPlan,
        existingPlanId:
          proposal.dailyPlanDraft?.date === today ? todayPlan?.id : undefined,
      });

      updateMessage(messageId, { proposalStatus: 'applied' });

      await Promise.all([
        loadGoals(),
        loadTodos(),
        loadEntries(),
        loadPlan(today),
      ]);

      if (sessionId && proposal.dailyPlanDraft) {
        await updateSessionSkill(sessionId, 'day-planning', {
          phase: 'accepted',
          isLead: true,
          statePatch: {
            acceptedAt: new Date().toISOString(),
            acceptedPlanDate: proposal.dailyPlanDraft.date,
            hasDraft: false,
            lastResponseMode: 'accepted',
          },
        });
      }
    } catch (error) {
      console.error('Error executing proposal:', error);
      updateMessage(messageId, { proposalStatus: 'failed' });
    }
  }, [
    addEntry,
    addGoal,
    addHabit,
    addTodo,
    archiveGoal,
    archiveHabit,
    loadEntries,
    loadGoals,
    loadPlan,
    loadTodos,
    removeHabit,
    removeTodo,
    saveAcceptedPlan,
    setTodoStatus,
    today,
    todayPlan?.id,
    updateGoal,
    updateHabit,
    updateMessage,
    updateTodo,
  ]);

  const handleDismissProposal = useCallback((messageId: string) => {
    updateMessage(messageId, {
      proposalStatus: 'dismissed',
    });
  }, [updateMessage]);

  useEffect(() => {
    if (autoPrompt !== 'plan-day' || hasSentAutoPrompt.current) {
      return;
    }

    if (!isActive || isLoading) {
      return;
    }

    hasSentAutoPrompt.current = true;
    sendUserMessage(
      'Plan my day using my goals, habits, tasks, journal, and anything you already know about me.'
    );
  }, [autoPrompt, isActive, isLoading, sendUserMessage]);

  // Voice input hook - handles recording and transcription
  const {
    isRecordingMode,
    voiceInputProps,
    handleStopRecording,
  } = useVoiceInput({
    onSend: async (text) => {
      await sendUserMessage(text);
    },
    onStopSuccess: setInputText,
  });

  // Custom handler for "stop & edit" flow (puts transcribed text in input field)
  const handleStopAndEdit = useCallback(async () => {
    const text = await handleStopRecording();
    if (text) {
      setInputText(text);
    }
  }, [handleStopRecording]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageType }) => {
      const proposal = item.proposal;
      const shouldRenderProposal =
        proposal && item.proposalStatus !== 'dismissed';

      return (
        <>
          <ChatMessage message={item} />
          {shouldRenderProposal ? (
            <CoachProposalCard
              proposal={proposal}
              status={item.proposalStatus === 'failed' ? 'failed' : item.proposalStatus === 'applying' ? 'applying' : item.proposalStatus === 'applied' ? 'applied' : 'pending'}
              goals={goals}
              habits={activeHabits}
              todos={todos}
              onConfirm={() => handleConfirmProposal(item.id)}
              onDismiss={() => handleDismissProposal(item.id)}
            />
          ) : null}
        </>
      );
    },
    [activeHabits, goals, handleConfirmProposal, handleDismissProposal, todos]
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Prevent showing empty content during modal dismissal
  if (isClosing) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  // Active session - show chat interface
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header with end session button */}
      <View style={styles.sessionHeader}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={32} color={colors.textLight} />
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
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Habitron is thinking...</Text>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || SPACING.sm }]}>
        {isRecordingMode ? (
          <VoiceInputButton
            {...voiceInputProps}
            onStopPress={handleStopAndEdit}
          />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={500}
              editable={!isLoading}
              onSubmitEditing={handleSendMessage}
              blurOnSubmit={false}
            />
            {inputText.trim() ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  isLoading && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            ) : (
              <VoiceInputButton
                mode="idle"
                onMicPress={voiceInputProps.onMicPress}
              />
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Session header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: colors.background,
  },
  closeButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Messages
  messageList: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  loadingText: {
    marginLeft: SPACING.sm,
    color: colors.textSecondary,
    ...TYPOGRAPHY.bodyMedium,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET.min,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodyLarge,
    color: colors.text,
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendIcon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: 'bold',
  },
  // Review screen
  reviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  reviewScrollView: {
    flex: 1,
  },
  reviewContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  reviewHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  reviewEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  reviewTitle: {
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  reviewSubtitle: {
    textAlign: 'center',
  },
  memoriesList: {
    marginTop: SPACING.md,
  },
  reviewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: SPACING.sm,
  },
  skipButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
