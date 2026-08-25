/**
 * Puts the test account into a known state, so a visual proof has something to
 * photograph and a fresh branch database has someone to sign in as.
 *
 *   pnpm seed
 *
 * Needs apps/api/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_EMAIL
 * and TEST_USER_PASSWORD. It deletes and rewrites only the fixture tables, and
 * only rows whose user_id is the test account's — never a truncate, and never
 * another account.
 *
 * In shared mode this is the live project: every shared-mode simulator is signed
 * into this same account, so a run changes what all of them are looking at.
 */
import { config as loadEnv } from 'dotenv';
import { createHabitron, today } from '@habits-coach/habitron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildFixtures } from './seed/fixtures.js';
import { adminClient, readTestUserEnv, upsertTestUser } from './seed/test-user.js';

// `override` because this script deletes rows: the worktree's own apps/api/.env
// is the only thing that says which project, and plain dotenv would let a
// SUPABASE_URL exported in the shell win over it — pointing a branch worktree's
// seed at the live database.
loadEnv({ override: true });

const FIXTURE_TABLES = [
  'todo_checklist_items',
  'todos',
  'todo_tags',
  'todo_lists',
  'habit_logs',
  'habit_reminders',
  'habits',
  'habit_sections',
  'journal_entries',
] as const;

function step(message: string): void {
  console.log(`==> ${message}`);
}

async function wipe(supabase: SupabaseClient, userId: string): Promise<void> {
  for (const table of FIXTURE_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function count(supabase: SupabaseClient, table: string, userId: string): Promise<number> {
  const { count: rows, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return rows ?? 0;
}

/** The Supabase project ref, so a run says out loud which database it is rewriting. */
function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0];
}

const env = readTestUserEnv();
const timezone = process.env.HABITRON_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
const supabase = adminClient(env.supabaseUrl, env.serviceRoleKey);

step(`Resolving ${env.email} on project ${projectRef(env.supabaseUrl)}`);
const user = await upsertTestUser(supabase, env.email, env.password);
console.log(`    ${user.created ? 'created' : 'found'} ${user.id}`);

step('Clearing the fixture tables');
await wipe(supabase, user.id);

const day = today(timezone);
const fixtures = buildFixtures(day);
const habitron = createHabitron({
  supabaseUrl: env.supabaseUrl,
  serviceRoleKey: env.serviceRoleKey,
  userId: user.id,
  timezone,
});

step(`Writing ${fixtures.tags.length} tags`);
const tagId = new Map<string, string>();
for (const tag of fixtures.tags) {
  const created = await habitron.db.createTag(tag.name, tag.color);
  tagId.set(tag.name, created.id);
}

step(`Writing ${fixtures.tasks.length} tasks around ${day}`);
for (const task of fixtures.tasks) {
  const created = await habitron.db.createTask({
    title: task.title,
    dueDate: task.dueDate ?? undefined,
    scheduledDate: task.scheduledDate ?? undefined,
    priority: task.priority,
    estimateMinutes: task.estimateMinutes,
    checklist: task.checklist,
    tagId: task.tag ? tagId.get(task.tag) : undefined,
  });
  if (task.status === 'completed') {
    await habitron.db.setTaskStatus(created.id, 'completed');
    // setTaskStatus stamps completed_at as now; the fixture wants the day it
    // claims, so that yesterday's completions do not all land on today.
    const { error } = await supabase
      .from('todos')
      .update({ completed_at: task.completedAt })
      .eq('id', created.id)
      .eq('user_id', user.id);
    if (error) throw new Error(`Failed to backdate ${task.title}: ${error.message}`);
  }
}

step('Writing habit sections and habits');
const { data: sectionRows, error: sectionError } = await supabase
  .from('habit_sections')
  .insert(fixtures.sections.map((section) => ({ user_id: user.id, name: section.name, sort_order: section.sortOrder })))
  .select('id, name');
if (sectionError) throw new Error(`Failed to write habit sections: ${sectionError.message}`);
const sectionId = new Map((sectionRows ?? []).map((row) => [row.name as string, row.id as string]));

const { data: habitRows, error: habitError } = await supabase
  .from('habits')
  .insert(
    fixtures.habits.map((habit) => ({
      user_id: user.id,
      name: habit.name,
      frequency: habit.frequency,
      weekly_days: null,
      weekly_count: habit.weeklyCount ?? null,
      interval_days: habit.intervalDays ?? null,
      start_date: fixtures.habitStartDate,
      goal_days: null,
      goal_type: habit.goalType,
      target_amount: habit.targetAmount ?? null,
      unit: habit.unit ?? null,
      check_in_mode: 'auto',
      record_increment: habit.recordIncrement ?? null,
      section_id: sectionId.get(habit.section) ?? null,
      constant_reminder: false,
      auto_popup_log: false,
      active: true,
    }))
  )
  .select('id, name');
if (habitError) throw new Error(`Failed to write habits: ${habitError.message}`);
const habitId = new Map((habitRows ?? []).map((row) => [row.name as string, row.id as string]));

step(`Writing ${fixtures.habitLogs.length} habit logs`);
for (const log of fixtures.habitLogs) {
  const id = habitId.get(log.habit);
  if (!id) throw new Error(`No habit named ${log.habit} to log against`);
  await habitron.db.logHabit({ habitId: id, date: log.date, status: 'completed', amount: log.amount });
}

step(`Writing ${fixtures.journal.length} journal entries`);
for (const entry of fixtures.journal) {
  await habitron.db.addJournalEntry({
    entryDate: entry.entryDate,
    content: entry.content,
    mood: entry.mood,
  });
}

step('Writing the profile');
const { error: profileError } = await supabase
  .from('user_profiles')
  .upsert({ user_id: user.id, name: fixtures.profile.name }, { onConflict: 'user_id' });
if (profileError) throw new Error(`Failed to write the profile: ${profileError.message}`);

step('Reading it back');
console.log(`    user ${user.id} (${user.email})`);
const tables = [...FIXTURE_TABLES, 'user_profiles'];
const counts = await Promise.all(tables.map((table) => count(supabase, table, user.id)));
tables.forEach((table, index) => console.log(`    ${table}: ${counts[index]}`));
