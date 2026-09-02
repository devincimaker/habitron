import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import type {
  JournalEntry,
  JournalEntryDraft,
  JournalMood,
} from '@habits-coach/shared';
import { Caption, HeadingLarge } from './ui';
import { JournalComposerBar } from './JournalComposerBar';
import { TranscriptionSkeleton } from './TranscriptionSkeleton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useSheetKeyboard } from '../hooks/useSheetKeyboard';
import { useHighlightFlash } from '../hooks/useHighlightFlash';
import { JOURNAL_PROMPTS } from '../constants/journal';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
  prompt?: string | null;
  autoStartVoice?: boolean;
  onClose: () => void;
  /** The sheet closes as the draft is handed over; the store shows it before the write lands. */
  onSave: (draft: JournalEntryDraft) => void;
}

function formatSheetDate(entry?: JournalEntry | null): string {
  const referenceDate = entry?.entryDate
    ? new Date(`${entry.entryDate}T12:00:00`)
    : new Date();

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(referenceDate);
}

export function JournalEntryModal({
  visible,
  entry,
  prompt,
  autoStartVoice = false,
  onClose,
  onSave,
}: JournalEntryModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const { keyboardHeight, bottomInset } = useSheetKeyboard();
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalMood | undefined>();
  const [placeholderPrompt, setPlaceholderPrompt] = useState(JOURNAL_PROMPTS[0]);
  const allowTranscriptionRef = useRef(true);
  const hasAutoStartedVoiceRef = useRef(false);
  const editorRef = useRef<TextInput>(null);
  const landTranscriptRef = useRef(false);
  const { flash, style: highlightStyle } = useHighlightFlash();

  useEffect(() => {
    if (!visible) return;

    allowTranscriptionRef.current = true;
    hasAutoStartedVoiceRef.current = false;
    setContent(entry?.content ?? '');
    setMood(entry?.mood);
    setPlaceholderPrompt(
      JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]
    );
  }, [visible, entry]);

  const appendTranscription = useCallback((text: string) => {
    if (!allowTranscriptionRef.current) return;

    landTranscriptRef.current = true;
    setContent((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${text}` : text;
    });
  }, []);

  // Runs on the render that carries the appended paragraph: flash the page
  // and put the caret after it, which is what scrolls it into view.
  useEffect(() => {
    if (!landTranscriptRef.current) return;
    landTranscriptRef.current = false;

    flash();
    editorRef.current?.focus();
    editorRef.current?.setSelection(content.length, content.length);
  }, [content, flash]);

  const {
    voiceInputProps,
    isTranscribing,
    handleStopRecording,
    handleCancelRecording,
    handleRetryRecording,
  } = useVoiceInput({ onStopSuccess: appendTranscription });

  const handleStop = useCallback(async () => {
    const text = await handleStopRecording();
    if (text?.trim()) appendTranscription(text);
  }, [handleStopRecording, appendTranscription]);

  useEffect(() => {
    if (!visible || !autoStartVoice || hasAutoStartedVoiceRef.current) {
      return;
    }

    hasAutoStartedVoiceRef.current = true;
    void voiceInputProps.onMicPress();
  }, [autoStartVoice, visible, voiceInputProps]);

  const sheetTitle = entry
    ? 'Edit entry'
    : autoStartVoice
      ? 'Voice capture'
      : 'New entry';

  const isDirty = useMemo(() => {
    const initialContent = entry?.content ?? '';
    const initialMood = entry?.mood;
    return (
      content.trim() !== initialContent.trim() ||
      mood !== initialMood
    );
  }, [content, mood, entry]);

  const forceClose = useCallback(async () => {
    allowTranscriptionRef.current = false;
    await handleCancelRecording();
    onClose();
  }, [handleCancelRecording, onClose]);

  const handleDismiss = useCallback(async () => {
    if (isDirty) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes that will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => void forceClose(),
          },
        ]
      );
      return;
    }
    await forceClose();
  }, [isDirty, forceClose]);

  const handleSave = async () => {
    if (!content.trim()) return;

    onSave({
      content: content.trim(),
      mood,
      source: 'manual',
    });
    await forceClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => void handleDismiss()}
    >
      <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Caption color={colors.primaryDark}>{formatSheetDate(entry)}</Caption>
            <HeadingLarge>{sheetTitle}</HeadingLarge>
          </View>

          <Pressable
            style={styles.dismissButton}
            onPress={() => void handleDismiss()}
            accessibilityLabel="Close journal editor"
          >
            <Feather name="x" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.page}>
          {prompt ? (
            <Caption color={colors.primaryDark} style={styles.promptCaption}>
              {prompt}
            </Caption>
          ) : null}

          <Animated.View style={[styles.editorWrap, highlightStyle]}>
            <TextInput
              ref={editorRef}
              // While transcribing the input hugs its text, so the skeleton
              // below it sits exactly where the paragraph will land.
              style={[styles.editor, isTranscribing && styles.editorHugsText]}
              placeholder={placeholderPrompt}
              placeholderTextColor={colors.textLight}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus={!entry && !autoStartVoice}
              accessibilityLabel="Journal entry"
            />

            {isTranscribing ? <TranscriptionSkeleton /> : null}
          </Animated.View>
        </View>

        <JournalComposerBar
          mood={mood}
          onMoodChange={setMood}
          canSave={Boolean(content.trim())}
          onSave={() => void handleSave()}
          voice={{
            ...voiceInputProps,
            onDiscard: () => void handleCancelRecording(),
            onStop: () => void handleStop(),
            onRetry: () => void handleRetryRecording(),
          }}
          bottomInset={bottomInset}
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topBarCopy: {
    flex: 1,
    gap: 2,
  },
  dismissButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  page: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  promptCaption: {
    marginBottom: SPACING.sm,
  },
  editorWrap: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  editor: {
    flex: 1,
    ...TYPOGRAPHY.editorBody,
    color: colors.text,
    // A multiline TextInput carries its own top inset; zero it so the first
    // line sits on the page's padding and not 5pt below it.
    paddingTop: 0,
    paddingBottom: SPACING.md,
  },
  editorHugsText: {
    flex: 0,
  },
});
