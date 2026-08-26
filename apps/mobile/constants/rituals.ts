import type { RitualId } from '@habits-coach/shared';

/**
 * The two daily practices, static because there are exactly two and adding a
 * third is a product decision rather than data. `window` orders them and picks
 * the copy; it is not a schedule — a ritual can be done at any hour.
 */
export interface RitualDefinition {
  id: RitualId;
  label: string;
  /** Feather icon name. Sun for the morning practice, moon for the evening one. */
  icon: 'sun' | 'moon';
  window: 'morning' | 'evening';
  /** Shown when the ritual has not happened yet, as the size of the ask. */
  notYetHint: string;
}

export const RITUALS: RitualDefinition[] = [
  {
    id: 'plan-day',
    label: 'Plan the day',
    icon: 'sun',
    window: 'morning',
    notYetHint: 'a few minutes',
  },
  {
    id: 'review-day',
    label: 'Review the day',
    icon: 'moon',
    window: 'evening',
    notYetHint: '30s',
  },
];
