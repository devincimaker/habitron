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
import { useSessionsStore } from '../../stores/useSessionsStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useMemoriesStore, ExtractedMemory } from '../../stores/useMemoriesStore';
import { ChatMessage } from '../../components/ChatMessage';
import { SuggestionCard } from '../../components/SuggestionCard';
import { MemoryReviewCard } from '../../components/MemoryReviewCard';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { SessionListItem } from '../../components/SessionListItem';
import { SessionDetailModal } from '../../components/SessionDetailModal';
import { Button, Avatar, DisplayMedium, BodyMedium } from '../../components/ui';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { sendMessage, transcribeAudio } from '../../services/api';
import { ChatMessage as ChatMessageType, HabitAction } from '@habits-coach/shared';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../constants/theme';

type ReviewState =
  | { phase: 'none' }
  | { phase: 'extracting' }
  | { phase: 'reviewing'; memories: ExtractedMemory[]; selected: Set<number> };

export default function CoachScreen() {
  const { autoStart } = useLocalSearchParams<{ autoStart?: string }>();

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

  const {
    sessions,
    isLoading: isLoadingSessions,
    loadSessions,
    loadSessionDetail,
    selectedSession,
    clearSelectedSession,
    deleteSession,
  } = useSessionsStore();

  const { habits, addHabit, removeHabit, updateHabit } = useHabitsStore();
  const { memories, loadMemories, extractMemories, saveMemories } = useMemoriesStore();

  const [inputText, setInputText] = useState('');
  const [pendingAction, setPendingAction] = useState<HabitAction | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ phase: 'none' });
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
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

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Check for recoverable session on mount
  useEffect(() => {
    const checkRecovery = async () => {
      const result = await checkAndRecoverSession();
      if (result === 'finalized') {
        // Refresh session list since we finalized an orphaned session
        loadSessions();
      }
    };
    checkRecovery();
  }, [checkAndRecoverSession, loadSessions]);

  // Auto-start session when navigated from push notification
  useEffect(() => {
    if (autoStart === 'true' && !isActive && reviewState.phase === 'none') {
      startSession();
    }
  }, [autoStart, isActive, reviewState.phase, startSession]);

  // Handle session press
  const handleSessionPress = useCallback((id: string) => {
    loadSessionDetail(id);
    setShowSessionDetail(true);
  }, [loadSessionDetail]);

  const handleCloseSessionDetail = useCallback(() => {
    setShowSessionDetail(false);
    clearSelectedSession();
  }, [clearSelectedSession]);

  const handleDeleteSession = useCallback(async () => {
    if (selectedSession) {
      await deleteSession(selectedSession.id);
      handleCloseSessionDetail();
    }
  }, [selectedSession, deleteSession, handleCloseSessionDetail]);

  // Helper to send message and get AI response
  const sendUserMessage = useCallback(async (text: string) => {
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
  }, [messages, habits, memories, addMessage, setLoading]);

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
        // Pass sessionId to link memories to this session
        await saveMemories(selectedMemories, sessionId || undefined);
      } catch (error) {
        console.error('Failed to save memories:', error);
      }
    }

    setReviewState({ phase: 'none' });
    await endSession();
    // Refresh session list to show the new session
    loadSessions();
  }, [reviewState, saveMemories, sessionId, endSession, loadSessions]);

  const handleSkipMemories = useCallback(async () => {
    setReviewState({ phase: 'none' });
    await endSession();
    // Refresh session list to show the new session
    loadSessions();
  }, [endSession, loadSessions]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    setPendingAction(null);
    await sendUserMessage(text);
  }, [inputText, isLoading, sendUserMessage]);

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

      if (text.trim()) {
        await sendUserMessage(text);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptionError(
        error instanceof Error ? error.message : 'Failed to transcribe audio'
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording, sendUserMessage]);

  const handleRetryRecording = useCallback(() => {
    setTranscriptionError(null);
    setIsRecordingMode(false);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Not in session - show start button and session history
  if (!isActive && reviewState.phase === 'none') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.landingScrollView} contentContainerStyle={styles.landingContent}>
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary]}
            style={styles.startContainer}
          >
            <Avatar
              text="S"
              size="lg"
              backgroundColor={COLORS.white}
              textColor={COLORS.primary}
              style={styles.coachAvatar}
            />
            <DisplayMedium color={COLORS.white} style={styles.coachName}>
              Coach Sage
            </DisplayMedium>
            <BodyMedium color={COLORS.white} style={styles.coachSubtitle}>
              Ready to help you build better habits
            </BodyMedium>
            <Button
              title="Start Coaching Session"
              variant="secondary"
              onPress={startSession}
              size="lg"
            />
          </LinearGradient>

          {/* Previous Sessions */}
          {sessions.length > 0 && (
            <View style={styles.sessionsSection}>
              <Text style={styles.sectionTitle}>Previous Sessions</Text>
              {sessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  onPress={handleSessionPress}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Session Detail Modal */}
        <SessionDetailModal
          visible={showSessionDetail}
          session={selectedSession}
          onClose={handleCloseSessionDetail}
          onDelete={handleDeleteSession}
        />
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
      <View style={styles.container}>
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

        <View style={styles.reviewFooter}>
          <Button
            title="Skip"
            variant="outline"
            onPress={handleSkipMemories}
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
  // Landing screen with session history
  landingScrollView: {
    flex: 1,
  },
  landingContent: {
    flexGrow: 1,
  },
  // Start session screen
  startContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  coachAvatar: {
    marginBottom: SPACING.md,
  },
  coachName: {
    marginBottom: SPACING.xs,
  },
  coachSubtitle: {
    opacity: 0.9,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  // Sessions section
  sessionsSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
    ...TYPOGRAPHY.label,
    color: COLORS.success,
  },
  endSessionText: {
    ...TYPOGRAPHY.label,
    color: COLORS.error,
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
    ...TYPOGRAPHY.bodyMedium,
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
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodyLarge,
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
