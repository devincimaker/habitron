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
  ScrollView,
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
import { useMemoriesStore, ExtractedMemory } from '../stores/useMemoriesStore';
import { useProfileStore } from '../stores/useProfileStore';
import { ChatMessage } from '../components/ChatMessage';
import { CoachProposalCard } from '../components/CoachProposalCard';
import { MemoryReviewCard } from '../components/MemoryReviewCard';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { Button, DisplayMedium, BodyMedium } from '../components/ui';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { sendMessage } from '../services/api';
import { getCoachRequestErrorMessage } from '../services/apiUrl';
import type { ChatMessage as ChatMessageType, ChatRequest, CoachProposal } from '@habits-coach/shared';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, TOUCH_TARGET } from '../constants/theme';
import { applyCoachProposal } from '../utils/applyCoachProposal';
import { getProposalAppliedMessage } from '../utils/coachProposal';

type ReviewState =
  | { phase: 'none' }
  | { phase: 'extracting' }
  | { phase: 'reviewing'; memories: ExtractedMemory[]; selected: Set<number> };

export default function SessionScreen() {
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
    setLoading,
    checkAndRecoverSession,
  } = useSessionStore();

  const { loadSessions } = useSessionsStore();
  const { habits, addHabit, removeHabit, updateHabit } = useHabitsStore();
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
  const [pendingProposal, setPendingProposal] = useState<CoachProposal | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ phase: 'none' });
  const [isClosing, setIsClosing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasSentAutoPrompt = useRef(false);
  const today = getTodayDate();
  const todayPlan = plansByDate[today] ?? null;

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
  const sendUserMessage = useCallback(async (text: string) => {
    addMessage({ role: 'user', content: text });
    setLoading(true);

    try {
      const allMessages = [
        ...messages,
        { role: 'user' as const, content: text, id: '', timestamp: 0 },
      ];
      const request: ChatRequest = {
        messages: allMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        habits,
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
      };

      const response = await sendMessage(request);
      addMessage({
        role: 'assistant',
        content: response.message,
        proposal: response.proposal ?? undefined,
      });

      if (response.proposal) {
        setPendingProposal(response.proposal);
      }
    } catch (error) {
      console.warn('Error sending message:', error);
      addMessage({
        role: 'assistant',
        content: getCoachRequestErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [
    addMessage,
    journalEntries,
    goals,
    habits,
    memories,
    messages,
    setLoading,
    today,
    todayPlan,
    todos,
    userName,
  ]);

  const performEndSession = useCallback(async () => {
    setPendingProposal(null);

    // Short sessions don't need memory extraction
    if (messages.length <= 2) {
      exitSession();
      return;
    }

    // Extract memories from meaningful conversations
    setReviewState({ phase: 'extracting' });
    const extracted = await extractMemories(
      messages.map((m) => ({ role: m.role, content: m.content }))
    );

    if (extracted.length === 0) {
      exitSession();
      return;
    }

    // Show review screen with all memories selected by default
    setReviewState({
      phase: 'reviewing',
      memories: extracted,
      selected: new Set(extracted.map((_, i) => i)),
    });
  }, [messages, extractMemories, exitSession]);

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
    setInputText('');
    setPendingProposal(null);
    await sendUserMessage(text);
  }, [inputText, isLoading, sendUserMessage]);

  const handleConfirmProposal = useCallback(async () => {
    if (!pendingProposal) return;

    try {
      await applyCoachProposal(pendingProposal, {
        addGoal,
        updateGoal,
        archiveGoal,
        addHabit,
        updateHabit,
        removeHabit,
        addTodo,
        updateTodo,
        setTodoStatus,
        removeTodo,
        addJournalEntry: addEntry,
        saveAcceptedPlan,
        existingPlanId:
          pendingProposal.dailyPlanDraft?.date === today ? todayPlan?.id : undefined,
      });

      addMessage({
        role: 'assistant',
        content: getProposalAppliedMessage(pendingProposal),
      });

      await Promise.all([
        loadGoals(),
        loadTodos(),
        loadEntries(),
        loadPlan(today),
      ]);
    } catch (error) {
      console.error('Error executing proposal:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.',
      });
    }

    setPendingProposal(null);
  }, [
    addEntry,
    addGoal,
    addHabit,
    addMessage,
    addTodo,
    archiveGoal,
    loadEntries,
    loadGoals,
    loadPlan,
    loadTodos,
    pendingProposal,
    removeHabit,
    removeTodo,
    saveAcceptedPlan,
    setTodoStatus,
    today,
    todayPlan?.id,
    updateGoal,
    updateHabit,
    updateTodo,
  ]);

  const handleDismissProposal = useCallback(() => {
    setPendingProposal(null);
    addMessage({
      role: 'assistant',
      content: 'No problem! Is there anything else you would like to work on?',
    });
  }, [addMessage]);

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

  // Voice input hook - handles recording and transcription
  const {
    isRecordingMode,
    voiceInputProps,
    handleStopRecording,
  } = useVoiceInput({
    onSend: sendUserMessage,
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
    ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Prevent showing empty content during modal dismissal
  if (isClosing) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  // Memory review - extracting phase
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // Memory review - showing extracted memories
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
          <Ionicons name="close" size={32} color={COLORS.textLight} />
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
                <Text style={styles.loadingText}>Habitron is thinking...</Text>
              </View>
            )}
            {pendingProposal && (
              <CoachProposalCard
                proposal={pendingProposal}
                onConfirm={handleConfirmProposal}
                onDismiss={handleDismissProposal}
              />
            )}
          </>
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
              placeholderTextColor={COLORS.textLight}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Session header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background,
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
    color: COLORS.textSecondary,
    ...TYPOGRAPHY.bodyMedium,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET.min,
    maxHeight: 100,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  sendIcon: {
    fontSize: 18,
    color: COLORS.white,
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
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  skipButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
