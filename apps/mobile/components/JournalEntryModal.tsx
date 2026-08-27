import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type {
  JournalEntry,
  JournalEntryDraft,
  JournalMood,
} from '@habits-coach/shared';
import { Caption, HeadingLarge } from './ui';
import { JournalComposerBar } from './JournalComposerBar';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useSheetKeyboard } from '../hooks/useSheetKeyboard';
import { JOURNAL_PROMPTS } from '../constants/journal';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
  prompt?: string | null;
  autoStartVoice?: boolean;
  onClose: () => void;
  onSave: (draft: JournalEntryDraft) => Promise<void>;
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
  const [isSaving, setIsSaving] = useState(false);
  const [placeholderPrompt, setPlaceholderPrompt] = useState(JOURNAL_PROMPTS[0]);
  const allowTranscriptionRef = useRef(true);
  const hasAutoStartedVoiceRef = useRef(false);

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

    setContent((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${text}` : text;
    });
  }, []);

  const { voiceInputProps, handleCancelRecording } = useVoiceInput({
    onStopSuccess: appendTranscription,
    onSend: async (text) => {
      appendTranscription(text);
    },
  });

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

    setIsSaving(true);
    try {
      await onSave({
        content: content.trim(),
        mood,
        source: 'manual',
      });
      await forceClose();
    } finally {
      setIsSaving(false);
    }
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

          <TextInput
            style={styles.editor}
            placeholder={placeholderPrompt}
            placeholderTextColor={colors.textLight}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus={!entry && !autoStartVoice}
            accessibilityLabel="Journal entry"
          />
        </View>

        <JournalComposerBar
          mood={mood}
          onMoodChange={setMood}
          canSave={Boolean(content.trim()) && !isSaving}
          isSaving={isSaving}
          onSave={() => void handleSave()}
          voice={voiceInputProps}
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
  editor: {
    flex: 1,
    ...TYPOGRAPHY.editorBody,
    color: colors.text,
    // A multiline TextInput carries its own top inset; zero it so the first
    // line sits on the page's padding and not 5pt below it.
    paddingTop: 0,
    paddingBottom: SPACING.md,
  },
});
