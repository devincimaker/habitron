import type { JournalMood } from '@habits-coach/shared';

export const JOURNAL_MOODS: Array<{
  value: JournalMood;
  emoji: string;
  label: string;
}> = [
  { value: 'terrible', emoji: '😢', label: 'Terrible' },
  { value: 'bad', emoji: '😔', label: 'Bad' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'great', emoji: '😄', label: 'Great' },
];

export const JOURNAL_MOOD_BY_VALUE = Object.fromEntries(
  JOURNAL_MOODS.map((mood) => [mood.value, mood])
) as Record<JournalMood, (typeof JOURNAL_MOODS)[number]>;
