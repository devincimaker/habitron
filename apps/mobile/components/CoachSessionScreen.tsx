/* eslint-disable max-lines -- HAB-89: split pending */
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
import { useRouter } from 'expo-router';
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
import { MemoryReviewCard } from './MemoryReviewCard';
import { DayRatingCard } from './DayRatingCard';
import { MicButton } from './MicButton';
import { VoiceControl } from './VoiceControl';
import { Button, DisplayMedium, BodyMedium } from './ui';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useDayRatings } from '../hooks/useDayRatings';
import { streamCoachTurn } from '../services/api';
import { getSessionTurn } from '../services/sessions';
import {
  getCoachRequestErrorMessage,
  getCoachSessionStartErrorMessage,
} from '../services/apiUrl';
import type { ChatMessage as ChatMessageType, SessionOpener } from '@habits-coach/shared';
import {
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  TYPOGRAPHY,
  TOUCH_TARGET,
  ROUTINE_ALARM_CHIP,
  type Colors,
} from '../constants/theme';
import { describeCoachActivity } from '../utils/coachActivity';
import { waitForTurn } from '../utils/coachTurnRecovery';
import { CoachStreamDroppedError } from '../utils/sse';
import { formatSessionStatus } from '../utils/coachSessions';
import { spokenDividerFor } from '../utils/voiceTranscript';
import { useThemedStyles } from '../hooks/useColors';

type ReviewState =
  | { phase: 'none' }
  | { phase: 'extracting' }
  | { phase: 'reviewing'; memories: ExtractedMemory[]; selected: Set<number> };

interface CoachSessionScreenProps {
  onDismiss: () => void;
}

/**
 * The skill command that opens a session: the coach speaks first, grounded in
 * the data. A ritual session opens with its own skill, and carries the date when
 * the ritual is for a day other than today — a review of last night done this
 * morning has to review last night.
 */
function openerCommand(opener: SessionOpener, ritualDate: string | null): string {
  if (opener === 'coach') return '/coach';
  const today = getTodayDate();
  return ritualDate && ritualDate !== today ? `/${opener} ${ritualDate}` : `/${opener}`;
}

export function CoachSessionScreen({ onDismiss }: CoachSessionScreenProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    isActive,
    sessionId,
    startedAt,
    endedAt,
    opener,
    ritualDate,
    messages,
    isLoading,
    startError,
    endSession,
    ensureBackendSession,
    addLocalMessage,
    addMessage,
    appendToMessage,
    finalizeMessage,
    setLoading,
  } = useSessionStore();

  const { loadSessions } = useSessionsStore();
  const { loadHabits } = useHabitsStore();
  const { loadGoals } = useGoalsStore();
  const { loadTodos } = useTodosStore();
  const { loadEntries } = useJournalStore();
  const { loadPlan } = useDailyPlansStore();
  const { loadMemories, extractMemories, saveMemories } = useMemoriesStore();
  const { name: userName } = useProfileStore();

  const [inputText, setInputText] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ phase: 'none' });
  const flatListRef = useRef<FlatList>(null);
  const hasSentOpener = useRef(false);
  const isSendingRef = useRef(false);
  const today = getTodayDate();

  useEffect(() => {
    loadMemories();
    loadGoals();
    loadTodos();
    loadEntries();
    loadPlan(today);
  }, [loadEntries, loadGoals, loadMemories, loadPlan, loadTodos, today]);

  // Ending is the deliberate act: finalize, then leave. Leaving on its own is
  // just onDismiss — the route keeps the session open on unmount.
  const exitSession = useCallback(() => {
    setInputText('');
    setReviewState({ phase: 'none' });
    void endSession().then(loadSessions);
    onDismiss();
  }, [endSession, loadSessions, onDismiss]);

  // The coach reads and writes real data during a turn; pull the app's stores back in line.
  const refreshData = useCallback(async () => {
    try {
      await Promise.all([
        loadHabits(),
        loadGoals(),
        loadTodos(),
        loadEntries(),
        loadPlan(today),
        loadMemories(),
      ]);
    } catch (error) {
      console.warn('Failed to refresh data after coach turn:', error);
    }
  }, [loadEntries, loadGoals, loadHabits, loadMemories, loadPlan, loadTodos, today]);

  const runTurn = useCallback(
    async (prompt: string, options: { echoUser: boolean }): Promise<boolean> => {
      if (isSendingRef.current) {
        return false;
      }

      isSendingRef.current = true;
      let assistantMessageId: string | null = null;
      let streamed = '';
      let finalMessage: string | null = null;
      let errorMessage: string | null = null;

      try {
        const currentSessionId = await ensureBackendSession();
        if (options.echoUser) {
          await addMessage({ role: 'user', content: prompt });
        }
        setLoading(true);
        setActivity(null);

        try {
          await streamCoachTurn(
            {
              sessionId: currentSessionId,
              prompt,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              userName: userName || undefined,
            },
            (event) => {
              switch (event.type) {
                case 'text':
                  streamed += event.delta;
                  setActivity(null);
                  if (assistantMessageId) {
                    appendToMessage(assistantMessageId, event.delta);
                  } else {
                    assistantMessageId = addLocalMessage({ role: 'assistant', content: event.delta });
                  }
                  break;
                case 'tool':
                  setActivity(describeCoachActivity(event.name));
                  break;
                case 'done':
                  finalMessage = event.message;
                  break;
                case 'error':
                  errorMessage = event.message;
                  break;
                case 'session':
                  break;
              }
            }
          );
        } catch (error) {
          // The socket went, the turn did not: iOS drops the stream when the
          // app is suspended, and the server keeps running the turn and
          // records how it ended on the session. Read that back rather than fail.
          if (error instanceof CoachStreamDroppedError) {
            setActivity('Reconnecting to the coach…');
          }
          const recovered =
            error instanceof CoachStreamDroppedError
              ? await waitForTurn(prompt, () => getSessionTurn(currentSessionId))
              : null;
          // Recovery can outlast the session it belongs to: the user may have
          // ended this one and opened another while it polled. The store owns
          // one session's messages, so a late reply goes nowhere but its own.
          if (useSessionStore.getState().sessionId !== currentSessionId) return false;
          if (recovered?.status === 'done') {
            finalMessage = recovered.reply;
          } else if (recovered) {
            errorMessage = recovered.error;
          } else {
            console.warn('Error sending message:', error);
            Sentry.captureException(error, {
              tags: {
                feature: 'coach-session',
                stage: 'chat_generation',
                sessionId: currentSessionId,
              },
              extra: { prompt },
            });
            errorMessage = getCoachRequestErrorMessage(error);
          }
        }

        let content = finalMessage ?? streamed;
        if (errorMessage) {
          content = content ? `${content}\n\n${errorMessage}` : errorMessage;
        }
        if (assistantMessageId) {
          await finalizeMessage(assistantMessageId, content);
        } else if (content) {
          await addMessage({ role: 'assistant', content });
        }

        await refreshData();
        return true;
      } catch (error) {
        console.warn('Could not start coaching session:', error);
        Alert.alert('Could not start session', getCoachSessionStartErrorMessage(error));
        return false;
      } finally {
        setActivity(null);
        setLoading(false);
        isSendingRef.current = false;
      }
    },
    [
      addLocalMessage,
      addMessage,
      appendToMessage,
      ensureBackendSession,
      finalizeMessage,
      refreshData,
      setLoading,
      userName,
    ]
  );

  const sendUserMessage = useCallback(
    (text: string): Promise<boolean> => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return Promise.resolve(false);
      }
      return runTurn(trimmedText, { echoUser: true });
    },
    [runTurn]
  );

  // The coach opens every new session, grounded in the day's data.
  useEffect(() => {
    if (!isActive || !sessionId || messages.length > 0 || hasSentOpener.current) {
      return;
    }
    if (reviewState.phase !== 'none' || isLoading) {
      return;
    }

    hasSentOpener.current = true;
    void runTurn(openerCommand(opener, ritualDate), { echoUser: false });
  }, [isActive, isLoading, messages.length, opener, reviewState.phase, ritualDate, runTurn, sessionId]);

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
    // isLoading only goes up once the session exists, so the ref is what keeps a
    // second tap in that window from being treated as a send of its own.
    if (!text || isLoading || isSendingRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // The turn resolves only when the whole reply has streamed, so clear on send
    // and put the text back if the turn never started. A draft typed while the
    // session was failing to open wins over the restore.
    setInputText('');
    const didSend = await sendUserMessage(text);
    if (!didSend) {
      setInputText((current) => current || text);
    }
  }, [inputText, isLoading, sendUserMessage]);

  const handleRetryStart = useCallback(() => {
    void ensureBackendSession().catch(() => {});
  }, [ensureBackendSession]);

  const dayRatings = useDayRatings({ opener, ritualDate });
  const { message: ratingsMessage, markSent: markRatingsSent } = dayRatings;

  // Send is the ordinary path: one user message, and the coach saves the review.
  const handleSendRatings = useCallback(() => {
    if (!ratingsMessage || isLoading || isSendingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markRatingsSent();
    void sendUserMessage(ratingsMessage);
  }, [isLoading, markRatingsSent, ratingsMessage, sendUserMessage]);

  const {
    isVoiceActive,
    voiceInputProps,
    handleStopRecording,
    handleSendRecording,
    handleCancelRecording,
    handleRetryRecording,
  } = useVoiceInput({
    onSend: async (text) => {
      await sendUserMessage(text);
    },
    onStopSuccess: setInputText,
  });

  // Voice mode needs the audio session to itself and a session to talk in.
  const canOpenVoiceMode = sessionId !== null && !isVoiceActive && !isLoading;

  const handleStopAndEdit = useCallback(async () => {
    const text = await handleStopRecording();
    if (text?.trim()) {
      setInputText(text);
    }
  }, [handleStopRecording]);

  const { onMicPress, ...voiceControlProps } = voiceInputProps;

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => (
      <ChatMessage message={item} divider={spokenDividerFor(messages, index)} />
    ),
    [messages]
  );

  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  const backButton = (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={onDismiss}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </TouchableOpacity>
  );

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

  if (isActive && !sessionId && startError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.sessionHeader}>{backButton}</View>
        <View style={styles.preparingContainer}>
          <BodyMedium style={styles.preparingText}>
            {getCoachSessionStartErrorMessage(new Error(startError))}
          </BodyMedium>
          <Button title="Try again" onPress={handleRetryStart} size="md" />
        </View>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.sessionHeader}>{backButton}</View>
        <View style={styles.preparingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <BodyMedium style={styles.preparingText}>{activity ?? 'Loading your coach...'}</BodyMedium>
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
        {backButton}

        {startedAt !== null && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={1}>
              {formatSessionStatus(startedAt, endedAt)}
            </Text>
          </View>
        )}

        {endedAt === null ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.voiceModeButton, !canOpenVoiceMode && styles.voiceModeButtonDisabled]}
              onPress={() => router.push('/interactive')}
              disabled={!canOpenVoiceMode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Talk with the coach"
              accessibilityState={{ disabled: !canOpenVoiceMode }}
            >
              <Ionicons name="pulse" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleEndSession}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="End session"
            >
              <Text style={styles.endText}>End</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerButton} />
        )}
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
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>{activity ?? 'Habitron is thinking...'}</Text>
            </View>
          ) : null
        }
      />

      {dayRatings.visible && !isVoiceActive && (
        <DayRatingCard
          ratings={dayRatings.ratings}
          disabled={isLoading}
          onRate={dayRatings.setRating}
          onSend={handleSendRatings}
        />
      )}

      <View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom || SPACING.sm },
        ]}
      >
        {isVoiceActive ? (
          <VoiceControl
            {...voiceControlProps}
            onDiscard={() => void handleCancelRecording()}
            onStop={() => void handleStopAndEdit()}
            onSend={() => void handleSendRecording()}
            onRetry={() => void handleRetryRecording()}
          />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                dayRatings.visible ? 'Or just tell me how it went…' : 'Type your message...'
              }
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
              <MicButton onPress={onMicPress} disabled={isLoading} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // Voice mode's door. One audio session at a time: it closes while the
  // composer's own voice pill holds the microphone or a turn is running.
  voiceModeButton: {
    width: TOUCH_TARGET.min - 8,
    height: TOUCH_TARGET.min - 8,
    borderRadius: (TOUCH_TARGET.min - 8) / 2,
    backgroundColor: ROUTINE_ALARM_CHIP.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeButtonDisabled: {
    opacity: 0.35,
  },
  headerButton: {
    minWidth: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    paddingHorizontal: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPill: {
    flexShrink: 1,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.controlFill,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    color: colors.textSecondary,
  },
  endText: {
    ...TYPOGRAPHY.label,
    fontSize: FONT_SIZES.body,
    color: colors.primary,
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
