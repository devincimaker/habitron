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
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { getTodayDate } from '@habits-coach/shared';
import { useSessionStore } from '../stores/useSessionStore';
import { useSessionsStore } from '../stores/useSessionsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useDailyPlansStore } from '../stores/useDailyPlansStore';
import { useMemoriesStore, ExtractedMemory } from '../stores/useMemoriesStore';
import { useProfileStore } from '../stores/useProfileStore';
import { ChatMessage } from './ChatMessage';
import {
  CoachProposalCard,
  type CoachProposalCardStatus,
} from './CoachProposalCard';
import { MemoryReviewCard } from './MemoryReviewCard';
import { VoiceInputButton } from './VoiceInputButton';
import { Button, DisplayMedium, BodyMedium } from './ui';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { sendMessage } from '../services/api';
import {
  getCoachRequestErrorMessage,
  getCoachSessionStartErrorMessage,
} from '../services/apiUrl';
import { createSessionDebugEvent } from '../services/sessions';
import type {
  ChatMessage as ChatMessageType,
  ChatRequest,
  CoachDebugErrorStage,
} from '@habits-coach/shared';
import {
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
  TOUCH_TARGET,
  type Colors,
} from '../constants/theme';
import { applyCoachProposal } from '../utils/applyCoachProposal';
import {
  getCoachProposalDebugSummaries,
  getLatestCoachProposal,
  getProposalAppliedMessage,
} from '../utils/coachProposal';
import { useThemedStyles } from '../hooks/useColors';

type ReviewState =
  | { phase: 'none' }
  | { phase: 'extracting' }
  | { phase: 'reviewing'; memories: ExtractedMemory[]; selected: Set<number> };

interface CoachSessionScreenProps {
  autoPrompt?: string;
  onDismiss?: () => void;
}

type ProposalStatus = CoachProposalCardStatus | 'dismissed' | 'superseded';

function getTurnIndexFromMessages(messages: Pick<ChatMessageType, 'role'>[]): number {
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  return Math.max(0, userMessageCount - 1);
}

function getTurnIndexForMessage(
  messages: Pick<ChatMessageType, 'id' | 'role'>[],
  messageId: string
): number {
  let userMessageCount = 0;

  for (const message of messages) {
    if (message.role === 'user') {
      userMessageCount += 1;
    }

    if (message.id === messageId) {
      return Math.max(0, userMessageCount - 1);
    }
  }

  return Math.max(0, userMessageCount - 1);
}

function getProposalErrorStage(error: unknown): Extract<CoachDebugErrorStage, 'proposal_validation' | 'proposal_apply'> {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('must include') || message.includes('valid ')
    ? 'proposal_validation'
    : 'proposal_apply';
}

export function CoachSessionScreen({
  autoPrompt,
  onDismiss,
}: CoachSessionScreenProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const {
    isActive,
    sessionId,
    messages,
    isLoading,
    endSession,
    addMessage,
    setLoading,
  } = useSessionStore();

  const { loadSessions } = useSessionsStore();
  const { habits, loadHabits, addHabit, updateHabit, archiveHabit, removeHabit } = useHabitsStore();
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
  const { memories, loadMemories, extractMemories, saveMemories } = useMemoriesStore();
  const { name: userName } = useProfileStore();

  const [inputText, setInputText] = useState('');
  const [proposalStatuses, setProposalStatuses] = useState<
    Partial<Record<string, ProposalStatus>>
  >({});
  const [reviewState, setReviewState] = useState<ReviewState>({ phase: 'none' });
  const flatListRef = useRef<FlatList>(null);
  const hasSentAutoPrompt = useRef(false);
  const isSendingRef = useRef(false);
  const today = getTodayDate();
  const todayPlan = plansByDate[today] ?? null;
  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.active),
    [habits]
  );
  const latestProposal = useMemo(
    () => getLatestCoachProposal(messages),
    [messages]
  );
  const latestProposalStatus: ProposalStatus | null = latestProposal
    ? proposalStatuses[latestProposal.messageId] ?? 'pending'
    : null;
  const visibleProposal = latestProposalStatus === 'dismissed' || latestProposalStatus === 'superseded'
    ? null
    : latestProposal;
  const proposalActionContext = useMemo(
    () => ({ goals, habits, todos }),
    [goals, habits, todos]
  );

  useEffect(() => {
    loadMemories();
    loadGoals();
    loadTodos();
    loadEntries();
    loadPlan(today);
  }, [loadEntries, loadGoals, loadMemories, loadPlan, loadTodos, today]);

  const exitSession = useCallback(() => {
    loadSessions();
    setInputText('');
    setProposalStatuses({});
    setReviewState({ phase: 'none' });
    void endSession();
    onDismiss?.();
  }, [endSession, loadSessions, onDismiss]);

  const setProposalStatus = useCallback((
    messageId: string | null,
    status: ProposalStatus | null
  ) => {
    if (!messageId) {
      return;
    }

    setProposalStatuses((previous) => {
      const currentStatus = previous[messageId] ?? null;

      if (currentStatus === status) {
        return previous;
      }

      if (status === null) {
        if (!(messageId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[messageId];
        return next;
      }

      return {
        ...previous,
        [messageId]: status,
      };
    });
  }, []);

  const logSessionDebugEvent = useCallback(
    async (event: Parameters<typeof createSessionDebugEvent>[1]) => {
      const currentSessionId = useSessionStore.getState().sessionId ?? sessionId;
      if (!currentSessionId) {
        return;
      }

      try {
        await createSessionDebugEvent(currentSessionId, event);
      } catch (error) {
        console.warn('Failed to create session debug event:', error);
      }
    },
    [sessionId]
  );

  const sendUserMessage = useCallback(async (text: string): Promise<boolean> => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) {
      return false;
    }

    isSendingRef.current = true;
    let didQueueUserMessage = false;

    try {
      await addMessage({ role: 'user', content: trimmedText });
      didQueueUserMessage = true;
      if (latestProposalStatus === 'pending') {
        setProposalStatus(latestProposal?.messageId ?? null, 'superseded');
      }
      setLoading(true);

      const allMessages = useSessionStore.getState().messages;
      const currentSessionId = useSessionStore.getState().sessionId ?? sessionId ?? undefined;
      const turnIndex = getTurnIndexFromMessages(allMessages);
      const request: ChatRequest = {
        messages: allMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        habits: activeHabits,
        goals,
        todos,
        journalEntries: journalEntries.slice(0, 10),
        dailyPlan: todayPlan,
        memories: memories.map((memory) => ({
          content: memory.content,
          category: memory.category,
        })),
        userName: userName || undefined,
        today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        sessionId: currentSessionId,
      };

      const response = await sendMessage(request);
      const assistantMessageId = await addMessage({
        role: 'assistant',
        content: response.message,
        proposal: response.proposal ?? undefined,
      });

      if (response.proposal) {
        await logSessionDebugEvent({
          eventType: 'proposal_received',
          turnIndex,
          proposalPayload: response.proposal,
          metadata: {
            assistantMessageId: assistantMessageId ?? null,
            actionCount: response.proposal.actions.length,
            actionSummaries: getCoachProposalDebugSummaries(response.proposal),
          },
        });
      }
      return true;
    } catch (error) {
      console.warn('Error sending message:', error);
      if (!didQueueUserMessage) {
        Alert.alert('Could not start session', getCoachSessionStartErrorMessage(error));
        return false;
      }

      Sentry.captureException(error, {
        tags: {
          feature: 'coach-session',
          stage: 'chat_generation',
          sessionId: useSessionStore.getState().sessionId ?? sessionId ?? 'none',
        },
        extra: {
          inputText: trimmedText,
        },
      });
      await addMessage({
        role: 'assistant',
        content: getCoachRequestErrorMessage(error),
      });
      return true;
    } finally {
      if (didQueueUserMessage) {
        setLoading(false);
      }
      isSendingRef.current = false;
    }
  }, [
    addMessage,
    latestProposal?.messageId,
    latestProposalStatus,
    journalEntries,
    goals,
    activeHabits,
    memories,
    logSessionDebugEvent,
    setProposalStatus,
    setLoading,
    sessionId,
    today,
    todayPlan,
    todos,
    userName,
  ]);

  const performEndSession = useCallback(async () => {
    if (messages.length <= 2) {
      exitSession();
      return;
    }

    setReviewState({ phase: 'extracting' });
    const extracted = await extractMemories(
      messages.map((m) => ({ role: m.role, content: m.content }))
    );

    if (extracted.length === 0) {
      exitSession();
      return;
    }

    setReviewState({
      phase: 'reviewing',
      memories: extracted,
      selected: new Set(extracted.map((_, i) => i)),
    });
  }, [messages, extractMemories, exitSession]);

  const handleEndSession = useCallback(() => {
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

  const handleToggleMemory = useCallback((index: number) => {
    setReviewState((prev) => {
      if (prev.phase !== 'reviewing') return prev;

      const newSelected = new Set(prev.selected);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      return { ...prev, selected: newSelected };
    });
  }, []);

  const handleSaveMemories = useCallback(async () => {
    if (reviewState.phase !== 'reviewing') return;

    const selectedMemories = reviewState.memories.filter((_, i) =>
      reviewState.selected.has(i)
    );

    if (selectedMemories.length > 0) {
      try {
        await saveMemories(selectedMemories, sessionId || undefined);
      } catch (error) {
        console.error('Failed to save memories:', error);
      }
    }

    exitSession();
  }, [reviewState, saveMemories, sessionId, exitSession]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const didSend = await sendUserMessage(text);
    if (didSend) {
      setInputText('');
    }
  }, [inputText, isLoading, sendUserMessage]);

  const handleConfirmProposal = useCallback(async () => {
    if (!visibleProposal || latestProposalStatus !== 'pending') return;

    const { messageId, proposal } = visibleProposal;
    const turnIndex = getTurnIndexForMessage(messages, messageId);
    const actionSummaries = getCoachProposalDebugSummaries(proposal);

    try {
      setProposalStatus(messageId, 'applying');

      await logSessionDebugEvent({
        eventType: 'proposal_apply_started',
        turnIndex,
        proposalPayload: proposal,
        metadata: {
          proposalMessageId: messageId,
          actionCount: proposal.actions.length,
          actionSummaries,
        },
      });

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

      setProposalStatus(messageId, 'applied');
    } catch (error) {
      setProposalStatus(messageId, null);

      console.error('Error executing proposal:', error);
      Sentry.captureException(error, {
        tags: {
          feature: 'coach-session',
          stage: getProposalErrorStage(error),
          sessionId: useSessionStore.getState().sessionId ?? sessionId ?? 'none',
        },
        extra: {
          proposalMessageId: messageId,
          actionSummaries,
        },
      });
      await logSessionDebugEvent({
        eventType: 'proposal_apply_failed',
        turnIndex,
        proposalPayload: proposal,
        errorMessage: error instanceof Error ? error.message : 'Unknown proposal apply error',
        errorStage: getProposalErrorStage(error),
        metadata: {
          proposalMessageId: messageId,
          actionCount: proposal.actions.length,
          actionSummaries,
        },
      });
      await addMessage({
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.',
      });
      return;
    }

    try {
      const appliedMessageId = await addMessage({
        role: 'assistant',
        content: getProposalAppliedMessage(proposal, proposalActionContext),
      });

      await logSessionDebugEvent({
        eventType: 'proposal_apply_succeeded',
        turnIndex,
        proposalPayload: proposal,
        metadata: {
          proposalMessageId: messageId,
          appliedMessageId: appliedMessageId ?? null,
          actionCount: proposal.actions.length,
          actionSummaries,
        },
      });

      await Promise.all([
        loadHabits(),
        loadGoals(),
        loadTodos(),
        loadEntries(),
        loadPlan(today),
      ]);
    } catch (error) {
      console.error('Error refreshing coach session after proposal apply:', error);
      Sentry.captureException(error, {
        tags: {
          feature: 'coach-session',
          stage: 'proposal_apply',
          sessionId: useSessionStore.getState().sessionId ?? sessionId ?? 'none',
        },
        extra: {
          proposalMessageId: messageId,
          actionSummaries,
          postApplyRefresh: true,
        },
      });
    }
  }, [
    addEntry,
    addGoal,
    addHabit,
    addMessage,
    addTodo,
    archiveHabit,
    archiveGoal,
    loadHabits,
    loadEntries,
    loadGoals,
    loadPlan,
    loadTodos,
    latestProposalStatus,
    logSessionDebugEvent,
    messages,
    proposalActionContext,
    removeHabit,
    removeTodo,
    saveAcceptedPlan,
    sessionId,
    setProposalStatus,
    setTodoStatus,
    today,
    todayPlan?.id,
    updateGoal,
    updateHabit,
    updateTodo,
    visibleProposal,
  ]);

  const handleDismissProposal = useCallback(() => {
    if (latestProposalStatus !== 'pending') {
      return;
    }

    setProposalStatus(visibleProposal?.messageId ?? null, 'dismissed');
    void addMessage({
      role: 'assistant',
      content: 'No problem! Is there anything else you would like to work on?',
    });
  }, [
    addMessage,
    latestProposalStatus,
    setProposalStatus,
    visibleProposal?.messageId,
  ]);

  useEffect(() => {
    if (autoPrompt !== 'plan-day' || hasSentAutoPrompt.current) {
      return;
    }

    if (!isActive || reviewState.phase !== 'none' || isLoading) {
      return;
    }

    hasSentAutoPrompt.current = true;
    sendUserMessage(
      'Plan my day using my goals, habits, tasks, journal, and anything you already know about me.'
    );
  }, [autoPrompt, isActive, isLoading, reviewState.phase, sendUserMessage]);

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

  const handleStopAndEdit = useCallback(async () => {
    const text = await handleStopRecording();
    if (text) {
      setInputText(text);
    }
  }, [handleStopRecording]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  if (reviewState.phase === 'extracting') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.reviewContainer}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewEmoji}>🧠</Text>
            <DisplayMedium style={styles.reviewTitle}>Processing Session</DisplayMedium>
            <BodyMedium style={styles.reviewSubtitle}>
              Extracting what I learned about you...
            </BodyMedium>
          </View>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (reviewState.phase === 'reviewing') {
    const selectedCount = reviewState.selected.size;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.reviewScrollView}
          contentContainerStyle={styles.reviewContent}
        >
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewEmoji}>✨</Text>
            <DisplayMedium style={styles.reviewTitle}>Session Complete</DisplayMedium>
            <BodyMedium style={styles.reviewSubtitle}>
              Here's what I learned about you. Select what you'd like me to remember for future sessions.
            </BodyMedium>
          </View>

          <View style={styles.memoriesList}>
            {reviewState.memories.map((memory, index) => (
              <MemoryReviewCard
                key={index}
                content={memory.content}
                category={memory.category}
                selected={reviewState.selected.has(index)}
                onToggle={() => handleToggleMemory(index)}
              />
            ))}
          </View>
        </ScrollView>

        <View style={[styles.reviewFooter, { paddingBottom: insets.bottom || SPACING.md }]}>
          <Button
            title="Skip"
            variant="outline"
            onPress={exitSession}
            size="md"
            style={styles.skipButton}
          />
          <Button
            title={
              selectedCount === 0
                ? 'Select memories'
                : `Save ${selectedCount} ${selectedCount === 1 ? 'memory' : 'memories'}`
            }
            onPress={handleSaveMemories}
            disabled={selectedCount === 0}
            size="md"
            style={styles.saveButton}
          />
        </View>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.preparingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <BodyMedium style={styles.preparingText}>Loading your coach...</BodyMedium>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.sessionHeader}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={32} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        style={styles.messageListContainer}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onLayout={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={
          <>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Habitron is thinking...</Text>
              </View>
            )}
            {visibleProposal && latestProposalStatus && (
              <CoachProposalCard
                proposal={visibleProposal.proposal}
                status={latestProposalStatus as CoachProposalCardStatus}
                actionContext={proposalActionContext}
                onConfirm={handleConfirmProposal}
                onDismiss={handleDismissProposal}
              />
            )}
          </>
        }
      />

      <View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom || SPACING.sm },
        ]}
      >
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
  messageListContainer: {
    flex: 1,
    minHeight: 0,
  },
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
  preparingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  preparingText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
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
  reviewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  reviewScrollView: {
    flex: 1,
  },
  reviewContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
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
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  reviewSubtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  memoriesList: {
    gap: SPACING.md,
  },
  reviewFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: SPACING.md,
    backgroundColor: colors.background,
  },
  skipButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
