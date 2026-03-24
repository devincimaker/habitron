import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { JOURNAL_MOODS, JOURNAL_PALETTE } from '../constants/journal';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
  prompt?: string | null;
  recentTags?: string[];
  autoStartVoice?: boolean;
  onClose: () => void;
  onSave: (draft: JournalEntryDraft) => Promise<void>;
}

const SCALE_OPTIONS = [
  { label: '1', value: 1 as const },
  { label: '2', value: 2 as const },
  { label: '3', value: 3 as const },
  { label: '4', value: 4 as const },
  { label: '5', value: 5 as const },
];

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
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalMood | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [tagsText, setTagsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const allowTranscriptionRef = useRef(true);
  const hasAutoStartedVoiceRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    allowTranscriptionRef.current = true;
    hasAutoStartedVoiceRef.current = false;
    setContent(entry?.content ?? '');
    setMood(entry?.mood);
    setEnergy(entry?.energy);
    setStress(entry?.stress);
    setTagsText(formatTags(entry?.tags ?? []));
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

  const handleDismiss = useCallback(async () => {
    allowTranscriptionRef.current = false;
    await handleCancelRecording();
    onClose();
  }, [handleCancelRecording, onClose]);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        content: content.trim(),
        mood,
        energy,
        stress,
        tags: parsedTags,
        source: 'manual',
      });
      await handleDismiss();
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
            <Caption color={JOURNAL_PALETTE.accent}>{formatSheetDate(entry)}</Caption>
            <HeadingLarge>{sheetTitle}</HeadingLarge>
          </View>

          <Pressable
            style={styles.dismissButton}
            onPress={() => void handleDismiss()}
            accessibilityLabel="Close journal editor"
          >
            <Feather name="x" size={18} color={COLORS.text} />
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {prompt ? (
            <View style={styles.promptCard}>
              <Caption color={JOURNAL_PALETTE.accent}>Prompt</Caption>
              <HeadingLarge style={styles.promptText}>{prompt}</HeadingLarge>
            </View>
          ) : null}

          <View style={styles.composerCard}>
            <View style={styles.editorHeader}>
              <Label>Entry</Label>
              {!isVoiceActive ? <VoiceInputButton {...voiceInputProps} /> : null}
            </View>

            <Input
              placeholder="What shifted, what mattered, and what should future-you remember?"
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus={!autoStartVoice}
              containerStyle={styles.fieldNoMargin}
            />

            {isVoiceActive ? (
              <View style={styles.recordingRow}>
                <VoiceInputButton {...voiceInputProps} />
              </View>
            ) : null}
          </View>

          <View style={styles.metaCard}>
            <View style={styles.metaGroup}>
              <Label>Mood</Label>
              <OptionChips
                options={MOOD_OPTIONS}
                selectedValue={mood}
                onChange={(value) => setMood(value)}
                allowDeselect
                onClear={() => setMood(undefined)}
                size="sm"
              />
            </View>

            <View style={styles.metaGroup}>
              <Label>Energy</Label>
              <OptionChips
                options={SCALE_OPTIONS}
                selectedValue={energy}
                onChange={(value) => setEnergy(value)}
                allowDeselect
                onClear={() => setEnergy(undefined)}
                size="sm"
              />
            </View>

            <View style={styles.metaGroup}>
              <Label>Stress</Label>
              <OptionChips
                options={SCALE_OPTIONS}
                selectedValue={stress}
                onChange={(value) => setStress(value)}
                allowDeselect
                onClear={() => setStress(undefined)}
                size="sm"
              />
            </View>

            <View style={styles.metaGroup}>
              <Label>Tags</Label>
              <Input
                placeholder="Tags"
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
                    >
                      <Caption color={COLORS.primaryDark}>{tag}</Caption>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={[styles.footerButton, styles.footerSecondaryButton]}
              onPress={() => void handleDismiss()}
              accessibilityRole="button"
            >
              <BodyMedium color={COLORS.textSecondary}>Cancel</BodyMedium>
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
              <BodyMedium color={COLORS.white} style={styles.footerPrimaryButtonText}>
                {isSaving ? 'Saving...' : entry ? 'Save changes' : 'Save entry'}
              </BodyMedium>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarCopy: {
    flex: 1,
    gap: 4,
  },
  dismissButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  promptCard: {
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: JOURNAL_PALETTE.line,
    backgroundColor: JOURNAL_PALETTE.paper,
  },
  promptText: {
    color: JOURNAL_PALETTE.ink,
  },
  composerCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
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
  recordingRow: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  metaCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
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
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
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
    backgroundColor: COLORS.primaryDark,
  },
  footerPrimaryButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  footerPrimaryButtonText: {
    fontWeight: '600',
  },
});
