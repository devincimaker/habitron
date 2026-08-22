-- Deleting a todo or habit that an accepted plan references used to fail:
-- the FK is ON DELETE SET NULL, but daily_plan_item_reference_check requires
-- todo/habit items to keep their id. Demote such items to notes instead, so the
-- plan keeps its title snapshot and outcome history while the entity goes away.

CREATE OR REPLACE FUNCTION demote_plan_items_for_deleted_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'todos' THEN
    UPDATE daily_plan_items
    SET item_type = 'note', todo_id = NULL
    WHERE todo_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'habits' THEN
    UPDATE daily_plan_items
    SET item_type = 'note', habit_id = NULL
    WHERE habit_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS demote_plan_items_before_todo_delete ON todos;
CREATE TRIGGER demote_plan_items_before_todo_delete
  BEFORE DELETE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION demote_plan_items_for_deleted_entity();

DROP TRIGGER IF EXISTS demote_plan_items_before_habit_delete ON habits;
CREATE TRIGGER demote_plan_items_before_habit_delete
  BEFORE DELETE ON habits
  FOR EACH ROW
  EXECUTE FUNCTION demote_plan_items_for_deleted_entity();
