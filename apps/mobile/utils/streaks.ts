/**
 * Consecutive days present in a set of dates, for the ritual cards.
 *
 * This is deliberately a second implementation of `reviewStreak` in
 * `packages/habitron/src/dayReview.ts`, and the duplication is forced rather
 * than chosen: `apps/mobile` depends on `@habits-coach/shared` and not on
 * `@habits-coach/habitron`, and moving the rule into `shared` does not help
 * either — that package is consumed as CJS, so an ESM importer fails with
 * `does not provide an export named …` (which is why
 * `packages/habitron/src/time.ts` re-declares the weekday list instead of
 * importing it). HAB-86's plan assumed one shared function; there is no module
 * both sides can reach today. HAB-138 owns closing that gap.
 *
 * The rule itself must stay in step with habitron's: a missing **today** does
 * not break the streak, because the day is not over. A missing yesterday does.
 */
export interface DateStreak {
  current: number;
  longest: number;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dateStreak(dates: string[], today: string): DateStreak {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = unique[i] === addDays(unique[i - 1], 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = unique[unique.length - 1];
  const current = last === today || last === addDays(today, -1) ? run : 0;

  return { current, longest };
}
