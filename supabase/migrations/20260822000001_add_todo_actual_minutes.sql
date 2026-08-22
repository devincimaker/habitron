ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS actual_minutes INTEGER CHECK (actual_minutes > 0);
