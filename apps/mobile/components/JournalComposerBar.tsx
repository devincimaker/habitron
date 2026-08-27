import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatActionButton } from './ui';
import type { JournalMood } from '@habits-coach/shared';
import { VoiceInputButton } from './VoiceInputButton';
import { JOURNAL_MOODS, JOURNAL_MOOD_STYLES } from '../constants/journal';
import { BORDER_RADIUS, SPACING, type Colors } from '../constants/theme';
import { useColorTheme, useThemedStyles } from '../hooks/useColors';

const CHIP_SIZE = 40;
const CHIP_GAP = 4;
/**
 * The mood palette is tuned for light mode; its pastel surface glares on a
 * dark bar. There the fill is the same mood's border at 22% instead, which
 * still reads as that mood. Every `JOURNAL_MOOD_STYLES` value is 6-digit hex,
 * so the alpha is one appended byte (0x38 / 255 ≈ 22%).
 */
const DARK_SELECTED_FILL_ALPHA = '38';

interface JournalComposerBarProps {
  mood?: JournalMood;
  onMoodChange: (mood: JournalMood | undefined) => void;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  voice: ComponentProps<typeof VoiceInputButton>;
  /** Home inset when the keyboard is down, 0 when the bar rides the keyboard. */
  bottomInset: number;
}

export function JournalComposerBar({
  mood,
  onMoodChange,
  canSave,
  isSaving,
  onSave,
  voice,
  bottomInset,
}: JournalComposerBarProps) {
  const [styles] = useThemedStyles(createStyles);
  const isDark = useColorTheme() === 'dark';
  // A failed recording keeps its error until the sheet is reopened, so the
  // error gets its own row rather than standing where the chips go — losing
  // the mic for the rest of an entry is the recorder's bug to fix, losing the
  // moods with it would be this bar's.
  const voiceState = voice.error
    ? 'error'
    : voice.mode === 'idle'
      ? 'idle'
      : 'capturing';

  const moodChips = JOURNAL_MOODS.map((option) => {
    const isSelected = mood === option.value;
    const moodStyle = JOURNAL_MOOD_STYLES[option.value];

    return (
      <Pressable
        key={option.value}
        style={[
          styles.chip,
          isSelected && {
            backgroundColor: isDark
              ? `${moodStyle.border}${DARK_SELECTED_FILL_ALPHA}`
              : moodStyle.surface,
            borderColor: moodStyle.border,
          },
        ]}
        hitSlop={2}
        onPress={() => onMoodChange(isSelected ? undefined : option.value)}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={styles.chipEmoji}>{option.emoji}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]}>
      {voiceState === 'error' ? (
        <View style={styles.voiceRow}>
          <VoiceInputButton {...voice} />
        </View>
      ) : null}

      <View style={styles.controlRow}>
        {voiceState === 'capturing' ? null : (
          <View style={styles.moodRow}>{moodChips}</View>
        )}

        {voiceState === 'error' ? null : <VoiceInputButton {...voice} />}

        <FlatActionButton
          title={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={!canSave}
          height={CHIP_SIZE}
          accessibilityLabel="Save entry"
        />
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  bar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 48,
  },
  voiceRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  moodRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_GAP,
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    minWidth: 32,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
});
