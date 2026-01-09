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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useSessionStore } from '../../stores/useSessionStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useMemoriesStore, ExtractedMemory } from '../../stores/useMemoriesStore';
import { ChatMessage } from '../../components/ChatMessage';
import { SuggestionCard } from '../../components/SuggestionCard';
import { MemoryReviewCard } from '../../components/MemoryReviewCard';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { sendMessage, transcribeAudio } from '../../services/api';
import { ChatMessage as ChatMessageType, HabitAction } from '@habits-coach/shared';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../constants/theme';

type ReviewState =
  | { phase: 'none' }
  | { phase: 'extracting' }
  | { phase: 'reviewing'; memories: ExtractedMemory[]; selected: Set<number> };

export default function CoachScreen() {
  const { autoStart } = useLocalSearchParams<{ autoStart?: string }>();

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
  const { memories, loadMemories, extractMemories, saveMemories } = useMemoriesStore();

  const [inputText, setInputText] = useState('');
  const [pendingAction, setPendingAction] = useState<HabitAction | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ phase: 'none' });
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const {
    isRecording,
    recordingDuration,
    meterLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError,
  } = useAudioRecorder();

  // Load memories on mount
  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  // Auto-start session when navigated from push notification
  useEffect(() => {
    if (autoStart === 'true' && !isActive && reviewState.phase === 'none') {
      startSession();
    }
  }, [autoStart, isActive, reviewState.phase, startSession]);

  const handleStartSession = useCallback(() => {
    startSession();
  }, [startSession]);

  const handleEndSession = useCallback(async () => {
    setPendingAction(null);

    // If session has meaningful content, extract memories
    if (messages.length > 2) {
      setReviewState({ phase: 'extracting' });

      const extracted = await extractMemories(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );

      if (extracted.length > 0) {
        // Show review screen with all memories selected by default
        setReviewState({
          phase: 'reviewing',
          memories: extracted,
          selected: new Set(extracted.map((_, i) => i)),
        });
      } else {
        // No memories extracted, just end the session
        setReviewState({ phase: 'none' });
        endSession();
      }
    } else {
      // Short session, no need to extract
      endSession();
    }
  }, [messages, extractMemories, endSession]);

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
        await saveMemories(selectedMemories);
      } catch (error) {
        console.error('Failed to save memories:', error);
      }
    }

    setReviewState({ phase: 'none' });
    endSession();
  }, [reviewState, saveMemories, endSession]);

  const handleSkipMemories = useCallback(() => {
    setReviewState({ phase: 'none' });
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

  const handleMicPress = useCallback(async () => {
    setTranscriptionError(null);
    setIsRecordingMode(true);
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    const audioUri = await stopRecording();
    if (!audioUri) {
      setIsRecordingMode(false);
      return;
    }

    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(audioUri);
      setInputText(text);
      setIsRecordingMode(false);
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptionError(
        error instanceof Error ? error.message : 'Failed to transcribe audio'
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording]);

  const handleSendRecording = useCallback(async () => {
    const audioUri = await stopRecording();
    if (!audioUri) {
      setIsRecordingMode(false);
      return;
    }

    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(audioUri);
      setIsRecordingMode(false);

      // Immediately send the message
      if (text.trim()) {
        addMessage({ role: 'user', content: text });
        setLoading(true);

        try {
          const allMessages = [...messages, { role: 'user' as const, content: text, id: '', timestamp: 0 }];
          const response = await sendMessage(allMessages, habits, memories);
          addMessage({ role: 'assistant', content: response.message, action: response.action });

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
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptionError(
        error instanceof Error ? error.message : 'Failed to transcribe audio'
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording, addMessage, setLoading, messages, habits, memories]);

  const handleRetryRecording = useCallback(() => {
    setTranscriptionError(null);
    setIsRecordingMode(false);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Not in session - show start button
  if (!isActive && reviewState.phase === 'none') {
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

  // Memory review - extracting phase
  if (reviewState.phase === 'extracting') {
    return (
      <View style={styles.container}>
        <View style={styles.reviewContainer}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewEmoji}>🧠</Text>
            <Text style={styles.reviewTitle}>Processing Session</Text>
            <Text style={styles.reviewSubtitle}>
              Extracting what I learned about you...
            </Text>
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
      <View style={styles.container}>
        <ScrollView
          style={styles.reviewScrollView}
          contentContainerStyle={styles.reviewContent}
        >
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewEmoji}>✨</Text>
            <Text style={styles.reviewTitle}>Session Complete</Text>
            <Text style={styles.reviewSubtitle}>
              Here's what I learned about you. Select what you'd like me to remember for future sessions.
            </Text>
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

        <View style={styles.reviewFooter}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipMemories}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              selectedCount === 0 && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveMemories}
            activeOpacity={0.8}
            disabled={selectedCount === 0}
          >
            <Text style={styles.saveButtonText}>
              {selectedCount === 0
                ? 'Select memories'
                : `Save ${selectedCount} ${selectedCount === 1 ? 'memory' : 'memories'}`}
            </Text>
          </TouchableOpacity>
        </View>
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
        {isRecordingMode ? (
          <VoiceInputButton
            mode={isTranscribing ? 'transcribing' : 'recording'}
            onMicPress={() => {}}
            meterLevel={meterLevel}
            recordingDuration={recordingDuration}
            onStopPress={handleStopRecording}
            onSendPress={handleSendRecording}
            error={transcriptionError || recordingError}
            onRetry={handleRetryRecording}
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
                onMicPress={handleMicPress}
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
    width: 40,
    height: 40,
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
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  reviewSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  saveButton: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
