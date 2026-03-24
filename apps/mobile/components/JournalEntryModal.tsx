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
import type { JournalEntry, JournalEntryDraft, JournalMood } from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { OptionChips } from './OptionChips';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { JOURNAL_MOODS } from '../constants/journal';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
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

export function JournalEntryModal({
  visible,
  entry,
  recentTags = [],
  autoStartVoice = false,
  onClose,
  onSave,
}: JournalEntryModalProps) {
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

  const moodHelperText = useMemo(() => {
    if (!mood) return 'Optional, but useful for reflection and coaching.';
    return `Selected mood: ${JOURNAL_MOODS.find((option) => option.value === mood)?.label}`;
  }, [mood]);

  const addSuggestedTag = useCallback((tag: string) => {
    const nextTags = parseTags(tagsText);
    const exists = nextTags.some((current) => current.toLowerCase() === tag.toLowerCase());
    if (exists) return;

    setTagsText(formatTags([...nextTags, tag]));
  }, [tagsText]);

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
        tags: parseTags(tagsText),
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <HeadingLarge>{entry ? 'Edit entry' : autoStartVoice ? 'Voice note' : 'New entry'}</HeadingLarge>
            <Caption>
              {autoStartVoice
                ? 'Start talking and the transcript will appear below.'
                : 'Capture what mattered, then save it.'}
            </Caption>
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Entry"
            placeholder="What happened, what mattered, and what should the coach understand?"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus={!autoStartVoice}
          />

          <View style={styles.section}>
            <Label>Mood</Label>
            <OptionChips
              options={MOOD_OPTIONS}
              selectedValue={mood}
              onChange={(value) => setMood(value)}
            />
            <Caption style={styles.helperText}>{moodHelperText}</Caption>
          </View>

          <Input
            label="Tags"
            placeholder="reflection, work, health"
            value={tagsText}
            onChangeText={setTagsText}
            autoCapitalize="none"
          />

          {recentTags.length > 0 ? (
            <View style={styles.section}>
              <Caption>Recent tags</Caption>
              <View style={styles.suggestedTags}>
                {recentTags.slice(0, 6).map((tag) => (
                  <Pressable
                    key={tag}
                    style={styles.suggestedTagChip}
                    onPress={() => addSuggestedTag(tag)}
                  >
                    <Caption color={COLORS.primaryDark}>#{tag}</Caption>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.dualSectionRow}>
            <View style={[styles.section, styles.halfSection]}>
              <Label>Energy</Label>
              <OptionChips
                options={SCALE_OPTIONS}
                selectedValue={energy}
                onChange={(value) => setEnergy(value)}
              />
            </View>

            <View style={[styles.section, styles.halfSection]}>
              <Label>Stress</Label>
              <OptionChips
                options={SCALE_OPTIONS}
                selectedValue={stress}
                onChange={(value) => setStress(value)}
              />
            </View>
          </View>

          <View style={styles.voiceCard}>
            <View style={styles.voiceCopy}>
              <Label>Voice dictation</Label>
              <Caption>
                Speak naturally. The transcription stays in the language you used.
              </Caption>
            </View>
            <View style={styles.dictationControl}>
              <VoiceInputButton {...voiceInputProps} />
            </View>
            {isRecordingMode || isTranscribing ? (
              <Caption color={COLORS.primaryDark}>
                Keep this sheet open until transcription finishes.
              </Caption>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => void handleDismiss()}
            size="md"
            style={styles.footerSecondaryButton}
          />
          <Button
            title={entry ? 'Save Entry' : 'Add Entry'}
            onPress={handleSave}
            loading={isSaving}
            disabled={!content.trim()}
            size="md"
            style={styles.footerPrimaryButton}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  topBarCopy: {
    flex: 1,
    gap: 4,
  },
  dismissButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  section: {
    gap: SPACING.sm,
  },
  helperText: {
    marginTop: 2,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  suggestedTagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  dualSectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.lg,
  },
  halfSection: {
    flex: 1,
  },
  voiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  voiceCopy: {
    gap: 4,
  },
  dictationControl: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  footerSecondaryButton: {
    flex: 1,
  },
  footerPrimaryButton: {
    flex: 1.6,
  },
});
