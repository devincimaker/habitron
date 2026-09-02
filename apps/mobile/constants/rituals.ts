import type { RitualId } from '@habits-coach/shared';

/** The rituals with a card on the Coach hub: the daily ones. The goals review lives on the Goals screen. */
export type DayRitualId = Exclude<RitualId, 'review-goals'>;

/**
 * The two daily practices, static because there are exactly two and adding a
 * third is a product decision rather than data. `window` orders them and picks
 * the copy; it is not a schedule — a ritual can be done at any hour.
 */
export interface RitualDefinition {
  id: DayRitualId;
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
