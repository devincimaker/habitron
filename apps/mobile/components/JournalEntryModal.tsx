import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { JournalEntry, JournalEntryDraft, JournalMood } from '@habits-coach/shared';
import { Button, Caption, HeadingLarge, Input, Label } from './ui';
import { OptionChips } from './OptionChips';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { JOURNAL_MOODS } from '../constants/journal';
import { COLORS, SPACING } from '../constants/theme';

interface JournalEntryModalProps {
  visible: boolean;
  entry?: JournalEntry | null;
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

  useEffect(() => {
    if (!visible) return;

    allowTranscriptionRef.current = true;
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

  const moodHelperText = useMemo(() => {
    if (!mood) return 'Optional, but useful for reflection and coaching.';
    return `Selected mood: ${JOURNAL_MOODS.find((option) => option.value === mood)?.label}`;
  }, [mood]);

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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <HeadingLarge style={styles.title}>
            {entry ? 'Edit Journal Entry' : 'New Journal Entry'}
          </HeadingLarge>

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
            label="What's on your mind?"
            placeholder="Write freely. What happened, what mattered, and what should Habitron understand about your day?"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
          />

          <View style={styles.section}>
            <Label>Tags</Label>
            <Input
              placeholder="reflection, work, health"
              value={tagsText}
              onChangeText={setTagsText}
              autoCapitalize="none"
              containerStyle={styles.inlineInput}
            />
            <Caption>Separate tags with commas.</Caption>
          </View>

          <View style={styles.section}>
            <Label>Energy</Label>
            <OptionChips
              options={SCALE_OPTIONS}
              selectedValue={energy}
              onChange={(value) => setEnergy(value)}
            />
          </View>

          <View style={styles.section}>
            <Label>Stress</Label>
            <OptionChips
              options={SCALE_OPTIONS}
              selectedValue={stress}
              onChange={(value) => setStress(value)}
            />
          </View>

          <View style={styles.dictationSection}>
            <Label>Voice Dictation</Label>
            <View style={styles.dictationControl}>
              <VoiceInputButton {...voiceInputProps} />
            </View>
            <Caption>
              Record a thought and Habitron will transcribe it into the journal entry.
            </Caption>
            {isRecordingMode || isTranscribing ? (
              <Caption color={COLORS.primaryDark} style={styles.helperText}>
                Keep this sheet open until transcription finishes.
              </Caption>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Cancel" variant="ghost" onPress={() => void handleDismiss()} size="md" />
          <Button
            title={entry ? 'Save Entry' : 'Add Entry'}
            onPress={handleSave}
            loading={isSaving}
            disabled={!content.trim()}
            size="md"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  title: {
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.md,
  },
  inlineInput: {
    marginBottom: SPACING.xs,
  },
  dictationSection: {
    marginBottom: SPACING.md,
  },
  dictationControl: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  helperText: {
    marginTop: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
});
