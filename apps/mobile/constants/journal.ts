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

export const JOURNAL_PALETTE = {
  paper: '#FFF9F1',
  paperAlt: '#F7EBDD',
  ink: '#2F241B',
  mutedInk: '#756453',
  line: '#E8D8C2',
  accent: '#B86A36',
  accentSoft: '#F6D7B6',
  chip: '#FFF2E0',
  chipBorder: '#E7C79F',
  shadow: 'rgba(117, 84, 46, 0.12)',
} as const;

export const JOURNAL_MOOD_STYLES: Record<
  JournalMood,
  {
    surface: string;
    border: string;
    text: string;
  }
> = {
  terrible: {
    surface: '#FBE2E2',
    border: '#E8B4B4',
    text: '#8B3838',
  },
  bad: {
    surface: '#F7E6D7',
    border: '#E1BEA0',
    text: '#8A5B2B',
  },
  neutral: {
    surface: '#EFE8DD',
    border: '#D5C7B7',
    text: '#70604F',
  },
  good: {
    surface: '#E8F1DD',
    border: '#BDD3A2',
    text: '#4E6B2C',
  },
  great: {
    surface: '#DDF4E6',
    border: '#A8D8B8',
    text: '#2E6A48',
  },
};

export const JOURNAL_PROMPTS = [
  'What shifted today?',
  'What drained or restored your energy?',
  'What should future-you remember about this moment?',
];
