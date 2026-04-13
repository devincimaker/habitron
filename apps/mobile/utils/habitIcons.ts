import { Ionicons } from '@expo/vector-icons';

export type HabitIconName = keyof typeof Ionicons.glyphMap;

export interface HabitIconOption {
  icon: HabitIconName;
  label: string;
  accentColor: string;
  keywords: string[];
}

export interface HabitIconCategory {
  name: string;
  options: HabitIconOption[];
}

export const DEFAULT_HABIT_ICON: HabitIconName = 'checkmark-circle';

export const HABIT_ICON_CATEGORIES: HabitIconCategory[] = [
  {
    name: 'Movement',
    options: [
      {
        icon: 'walk',
        label: 'Walk',
        accentColor: '#6FCF97',
        keywords: ['walk', 'steps', 'stroll', 'hike'],
      },
      {
        icon: 'bicycle',
        label: 'Bike',
        accentColor: '#4DB6E2',
        keywords: ['bike', 'cycle', 'ride'],
      },
      {
        icon: 'barbell',
        label: 'Lift',
        accentColor: '#FF9F6E',
        keywords: ['lift', 'gym', 'strength', 'weights'],
      },
      {
        icon: 'body',
        label: 'Stretch',
        accentColor: '#70C7A5',
        keywords: ['stretch', 'mobility', 'yoga'],
      },
      {
        icon: 'fitness',
        label: 'Workout',
        accentColor: '#5BC0EB',
        keywords: ['workout', 'exercise', 'train', 'run'],
      },
    ],
  },
  {
    name: 'Health',
    options: [
      {
        icon: 'water',
        label: 'Hydrate',
        accentColor: '#78C9FF',
        keywords: ['water', 'hydrate', 'hydration'],
      },
      {
        icon: 'nutrition',
        label: 'Eat well',
        accentColor: '#69D08C',
        keywords: ['meal', 'food', 'eat', 'nutrition', 'protein'],
      },
      {
        icon: 'bed',
        label: 'Sleep',
        accentColor: '#8896FF',
        keywords: ['sleep', 'bed', 'rest', 'nap'],
      },
      {
        icon: 'medical',
        label: 'Medication',
        accentColor: '#FF8A80',
        keywords: ['med', 'medicine', 'medication', 'vitamin', 'pill'],
      },
      {
        icon: 'heart',
        label: 'Wellness',
        accentColor: '#FF7E9D',
        keywords: ['heart', 'wellness', 'health', 'care'],
      },
    ],
  },
  {
    name: 'Mind',
    options: [
      {
        icon: 'book',
        label: 'Read',
        accentColor: '#F9C74F',
        keywords: ['read', 'book', 'kindle'],
      },
      {
        icon: 'school',
        label: 'Study',
        accentColor: '#7AC7E3',
        keywords: ['study', 'class', 'course', 'homework'],
      },
      {
        icon: 'language',
        label: 'Language',
        accentColor: '#FFAA66',
        keywords: ['language', 'spanish', 'french', 'practice'],
      },
      {
        icon: 'bulb',
        label: 'Think',
        accentColor: '#FFD166',
        keywords: ['think', 'brainstorm', 'idea', 'reflect'],
      },
      {
        icon: 'library',
        label: 'Learn',
        accentColor: '#7BC8A4',
        keywords: ['learn', 'research', 'lesson'],
      },
    ],
  },
  {
    name: 'Focus',
    options: [
      {
        icon: 'briefcase',
        label: 'Work',
        accentColor: '#6C8CFF',
        keywords: ['work', 'office', 'career'],
      },
      {
        icon: 'laptop',
        label: 'Code',
        accentColor: '#5BA8FF',
        keywords: ['code', 'build', 'ship', 'dev', 'program'],
      },
      {
        icon: 'time',
        label: 'Focus',
        accentColor: '#8E7CFF',
        keywords: ['focus', 'deep work', 'timer', 'pomodoro'],
      },
      {
        icon: 'calendar',
        label: 'Plan',
        accentColor: '#5BC0EB',
        keywords: ['plan', 'calendar', 'schedule', 'review'],
      },
      {
        icon: 'construct',
        label: 'Make',
        accentColor: '#F29E4C',
        keywords: ['make', 'create', 'project', 'craft'],
      },
    ],
  },
  {
    name: 'Reset',
    options: [
      {
        icon: 'happy',
        label: 'Mood',
        accentColor: '#F6BD60',
        keywords: ['mood', 'gratitude', 'joy'],
      },
      {
        icon: 'leaf',
        label: 'Breathe',
        accentColor: '#74C69D',
        keywords: ['breath', 'breathe', 'calm', 'meditate'],
      },
      {
        icon: 'sunny',
        label: 'Morning',
        accentColor: '#F4A261',
        keywords: ['morning', 'sunrise', 'wake'],
      },
      {
        icon: 'moon',
        label: 'Evening',
        accentColor: '#7B8CDE',
        keywords: ['evening', 'night', 'wind down'],
      },
      {
        icon: 'sparkles',
        label: 'Self-care',
        accentColor: '#C77DFF',
        keywords: ['self care', 'self-care', 'reset', 'care'],
      },
    ],
  },
  {
    name: 'Progress',
    options: [
      {
        icon: 'star',
        label: 'Consistency',
        accentColor: '#B28DFF',
        keywords: ['consistency', 'daily', 'routine'],
      },
      {
        icon: 'flag',
        label: 'Goal',
        accentColor: '#FFB84D',
        keywords: ['goal', 'target', 'mission'],
      },
      {
        icon: 'trophy',
        label: 'Win',
        accentColor: '#F6A6C1',
        keywords: ['win', 'achievement', 'reward'],
      },
      {
        icon: 'rocket',
        label: 'Launch',
        accentColor: '#FF8F70',
        keywords: ['launch', 'publish', 'ship'],
      },
      {
        icon: 'checkmark-circle',
        label: 'Habit',
        accentColor: '#5BC0EB',
        keywords: ['habit', 'check', 'complete', 'done'],
      },
    ],
  },
];

export const HABIT_ICON_OPTIONS = HABIT_ICON_CATEGORIES.flatMap(
  (category) => category.options
);

const HABIT_ICON_LABELS = new Map(
  HABIT_ICON_OPTIONS.map((option) => [option.icon, option.label])
);

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function getHabitIconLabel(icon?: string | null): string {
  if (!icon) {
    return HABIT_ICON_LABELS.get(DEFAULT_HABIT_ICON) ?? 'Habit';
  }

  return HABIT_ICON_LABELS.get(icon as HabitIconName) ?? 'Habit';
}

export function getSuggestedHabitIcon(name?: string | null): HabitIconName {
  const normalizedName = normalizeText(name ?? '');

  if (!normalizedName) {
    return DEFAULT_HABIT_ICON;
  }

  for (const option of HABIT_ICON_OPTIONS) {
    if (
      option.keywords.some((keyword) => normalizedName.includes(normalizeText(keyword)))
    ) {
      return option.icon;
    }
  }

  return DEFAULT_HABIT_ICON;
}

export function resolveHabitIcon(
  name?: string | null,
  icon?: string | null
): HabitIconName {
  if (icon && icon.trim()) {
    return icon as HabitIconName;
  }

  return getSuggestedHabitIcon(name);
}

export function getHabitIconOption(icon: HabitIconName): HabitIconOption | undefined {
  return HABIT_ICON_OPTIONS.find((option) => option.icon === icon);
}
