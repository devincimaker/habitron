/** What to show while the coach is busy with a given Habitron tool. */
const ACTIVITY_LABELS: Record<string, string> = {
  get_day_context: 'Reading your day…',
  list_tasks: 'Looking at your tasks…',
  list_habits: 'Looking at your habits…',
  list_tags: 'Checking your categories…',
  list_memories: 'Recalling what I know…',
  get_habit_history: 'Reviewing your habit history…',
  get_task_history: 'Reviewing what got done…',
  get_journal_history: 'Reading your journal…',
  get_plan_history: 'Reviewing past plans…',
  create_task: 'Adding a task…',
  update_task: 'Updating a task…',
  set_task_status: 'Updating a task…',
  set_checklist_item_done: 'Ticking off an item…',
  delete_task: 'Removing a task…',
  create_tag: 'Creating a category…',
  update_tag: 'Updating a category…',
  delete_tag: 'Removing a category…',
  log_habit: 'Logging a habit…',
  save_day_plan: 'Saving your plan…',
  set_plan_item_outcome: 'Recording how it went…',
  add_journal_entry: 'Saving a journal entry…',
  add_memory: 'Remembering that…',
  delete_memory: 'Forgetting that…',
  Skill: 'Thinking…',
};

export function describeCoachActivity(toolName: string): string {
  return ACTIVITY_LABELS[toolName] ?? 'Working…';
}
