import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  JournalEntry,
  JournalEntryDraft,
  JournalMood,
} from '@habits-coach/shared';
import { BodyMedium, Caption, HeadingLarge, Input, Label } from './ui';
import { OptionChips } from './OptionChips';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { JOURNAL_MOODS, JOURNAL_PROMPTS } from '../constants/journal';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles, useColors } from '../hooks/useColors';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
  prompt?: string | null;
  recentTags?: string[];
  autoStartVoice?: boolean;
  onClose: () => void;
  onSave: (draft: JournalEntryDraft) => Promise<void>;
}

const MOOD_OPTIONS = JOURNAL_MOODS.map((mood) => ({
  label: `${mood.emoji} ${mood.label}`,
  value: mood.value,
}));

function formatTags(tags: string[]): string {
  return tags.join(', ');
}

function parseTags(value: string): string[] {
  const uniqueTags = new Map<string, string>();

  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const key = tag.toLowerCase();
      if (!uniqueTags.has(key)) {
        uniqueTags.set(key, tag);
      }
    });

  return Array.from(uniqueTags.values());
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
  recentTags = [],
  autoStartVoice = false,
  onClose,
  onSave,
}: JournalEntryModalProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalMood | undefined>();
  const [tagsText, setTagsText] = useState('');
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
    setTagsText(formatTags(entry?.tags ?? []));
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

  const {
    voiceInputProps,
    handleCancelRecording,
    isRecordingMode,
    isTranscribing,
  } = useVoiceInput({
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

  const parsedTags = useMemo(() => parseTags(tagsText), [tagsText]);
  const isVoiceActive = isRecordingMode || isTranscribing;
  const sheetTitle = entry
    ? 'Edit entry'
    : autoStartVoice
      ? 'Voice capture'
      : 'New entry';

  const isDirty = useMemo(() => {
    const initialContent = entry?.content ?? '';
    const initialMood = entry?.mood;
    const initialTags = formatTags(entry?.tags ?? []);
    return (
      content.trim() !== initialContent.trim() ||
      mood !== initialMood ||
      tagsText !== initialTags
    );
  }, [content, mood, tagsText, entry]);

  const addSuggestedTag = useCallback(
    (tag: string) => {
      const exists = parsedTags.some(
        (current) => current.toLowerCase() === tag.toLowerCase()
      );
      if (exists) return;

      setTagsText(formatTags([...parsedTags, tag]));
    },
    [parsedTags]
  );

  const moodTagsSection = (
    <>
      <View style={styles.metaGroup}>
        <Label>Mood</Label>
        <OptionChips
          options={MOOD_OPTIONS}
          selectedValue={mood}
          onChange={(value) => setMood(value)}
          allowDeselect
          onClear={() => setMood(undefined)}
          size="sm"
          wrap
        />
      </View>

      <View style={styles.metaGroup}>
        <Label>Tags</Label>
        <Input
          placeholder="e.g. work, fitness, personal"
          value={tagsText}
          onChangeText={setTagsText}
          autoCapitalize="none"
          containerStyle={styles.fieldNoMargin}
        />

        {recentTags.length > 0 ? (
          <View style={styles.suggestedTags}>
            {recentTags.slice(0, 8).map((tag) => (
              <Pressable
                key={tag}
                style={styles.suggestedTagChip}
                onPress={() => addSuggestedTag(tag)}
                accessibilityLabel={`Add tag: ${tag}`}
                accessibilityRole="button"
              >
                <Caption color={colors.primaryDark}>{tag}</Caption>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </>
  );

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
        tags: parsedTags,
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {prompt ? (
            <View style={styles.promptCard}>
              <Caption color={colors.primaryDark}>Prompt</Caption>
              <HeadingLarge style={styles.promptText}>{prompt}</HeadingLarge>
            </View>
          ) : null}

          <View style={styles.composerCard}>
            <View style={styles.editorHeader}>
              <Label>Entry</Label>
              {!isVoiceActive ? <VoiceInputButton {...voiceInputProps} /> : null}
            </View>

            <Input
              placeholder={placeholderPrompt}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus={!autoStartVoice}
              containerStyle={[styles.fieldNoMargin, styles.expandingField]}
              inputStyle={styles.expandingInput}
            />

            {isVoiceActive ? (
              <View style={styles.recordingRow}>
                <VoiceInputButton {...voiceInputProps} />
              </View>
            ) : null}

            {!entry ? moodTagsSection : null}
          </View>

          {entry ? (
            <View style={styles.metaCard}>
              {moodTagsSection}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <Pressable
            style={[styles.footerButton, styles.footerSecondaryButton]}
            onPress={() => void handleDismiss()}
            accessibilityRole="button"
          >
            <BodyMedium color={colors.textSecondary}>Cancel</BodyMedium>
          </Pressable>

          <Pressable
            style={[
              styles.footerButton,
              styles.footerPrimaryButton,
              (!content.trim() || isSaving) && styles.footerPrimaryButtonDisabled,
            ]}
            onPress={() => void handleSave()}
            disabled={!content.trim() || isSaving}
            accessibilityRole="button"
          >
            <BodyMedium color={colors.white} style={styles.footerPrimaryButtonText}>
              {isSaving ? 'Saving...' : entry ? 'Save changes' : 'Save entry'}
            </BodyMedium>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  dismissButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.lg,
  },
  promptCard: {
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  promptText: {
    color: colors.text,
  },
  composerCard: {
    flex: 1,
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  fieldNoMargin: {
    marginBottom: 0,
  },
  expandingField: {
    flex: 1,
  },
  expandingInput: {
    flex: 1,
  },
  recordingRow: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: colors.surface,
  },
  metaCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  metaGroup: {
    gap: SPACING.sm,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  suggestedTagChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.primaryLight,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
  },
  footerSecondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  footerPrimaryButton: {
    flex: 1.4,
    backgroundColor: colors.primaryDark,
  },
  footerPrimaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  footerPrimaryButtonText: {
    fontWeight: '600',
  },
});
