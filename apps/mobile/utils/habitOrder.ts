import type { Habit, HabitSection } from '@habits-coach/shared';
import type { HabitOrderUpdate } from '../services/habits';

/**
 * The Habits screen is one flat list rather than a SectionList: a SectionList
 * cannot reorder, and per-section lists cannot hand an item to each other.
 * Headers are ordinary rows, which is what makes a drag from Morning into
 * Afternoon a plain index move.
 *
 * `idleHidden` marks the header and placeholder of an *empty* routine. Those
 * rows are always in the data and render as nothing until a drag is in flight.
 * They cannot be added on drag start instead: the list captures the dragged
 * item's index when the gesture begins, so inserting rows above it afterwards
 * would silently shift the drag by two rows per empty routine.
 */
export type HabitRow<T extends Habit> =
  | { type: 'header'; key: string; sectionId: string | null; title: string; idleHidden: boolean }
  | { type: 'habit'; key: string; habit: T }
  | { type: 'placeholder'; key: string; sectionId: string | null };

/** The trailing bucket for habits with no routine, or one that no longer exists. */
const NO_ROUTINE_TITLE = 'No routine';

export function sortHabitsByPosition<T extends Habit>(habits: T[]): T[] {
  return [...habits].sort((a, b) =>
    a.position === b.position ? a.createdAt - b.createdAt : a.position - b.position
  );
}

export function buildHabitRows<T extends Habit>(
  sections: HabitSection[],
  habits: T[]
): HabitRow<T>[] {
  const known = new Set(sections.map((section) => section.id));
  const bySection = new Map<string | null, T[]>();

  for (const habit of habits) {
    // A dangling section_id belongs with the no-routine habits, which is where
    // the screen has always shown it.
    const key = habit.sectionId && known.has(habit.sectionId) ? habit.sectionId : null;
    const bucket = bySection.get(key) ?? [];
    bucket.push(habit);
    bySection.set(key, bucket);
  }

  const rows: HabitRow<T>[] = [];

  const pushGroup = (sectionId: string | null, title: string) => {
    const members = sortHabitsByPosition(bySection.get(sectionId) ?? []);
    const suffix = sectionId ?? 'none';

    rows.push({
      type: 'header',
      key: `header:${suffix}`,
      sectionId,
      title,
      idleHidden: members.length === 0,
    });

    if (!members.length) {
      // An empty routine still needs one hittable row to be a drop target.
      rows.push({ type: 'placeholder', key: `placeholder:${suffix}`, sectionId });
      return;
    }
    for (const habit of members) {
      rows.push({ type: 'habit', key: habit.id, habit });
    }
  };

  for (const section of sections) {
    pushGroup(section.id, section.name);
  }
  pushGroup(null, NO_ROUTINE_TITLE);

  return rows;
}

/**
 * Walks the reordered flat array: the routine is the last header seen, and
 * `position` restarts at 0 after each one. Only genuinely changed rows come
 * back, so a drop that lands where it started writes nothing.
 */
export function resolveOrderFromRows<T extends Habit>(rows: HabitRow<T>[]): HabitOrderUpdate[] {
  const updates: HabitOrderUpdate[] = [];
  // Before the first header there is no routine yet; a habit dragged above it
  // clamps into the first section rather than falling out of the list.
  const firstHeader = rows.find((row) => row.type === 'header');
  let sectionId: string | null = firstHeader?.type === 'header' ? firstHeader.sectionId : null;
  let position = 0;

  for (const row of rows) {
    if (row.type === 'header') {
      // Only a *new* routine restarts the count. In the clamp case the first
      // header names the routine those leading habits were already assigned to,
      // so resetting here would hand position 0 to two of them.
      if (row.sectionId !== sectionId) position = 0;
      sectionId = row.sectionId;
      continue;
    }
    if (row.type === 'placeholder') continue;

    const { habit } = row;
    const currentSectionId = habit.sectionId ?? null;
    if (currentSectionId !== sectionId || habit.position !== position) {
      updates.push({ id: habit.id, sectionId, position });
    }
    position += 1;
  }

  return updates;
}

export function applyHabitOrder<T extends Habit>(habits: T[], updates: HabitOrderUpdate[]): T[] {
  if (!updates.length) return habits;
  const byId = new Map(updates.map((update) => [update.id, update]));

  return habits.map((habit) => {
    const update = byId.get(habit.id);
    if (!update) return habit;
    return { ...habit, sectionId: update.sectionId ?? undefined, position: update.position };
  });
}
