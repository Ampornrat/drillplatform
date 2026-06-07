-- cop_dispatch_patch.sql
-- Adds task_forces table for grouping dispatched resources.
-- master_registry is already the "object_registry" — no new table needed.
-- lifecycle events are logged to event_log (already exists).
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS task_forces (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id     UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  capability   TEXT,
  destination  TEXT,
  member_ids   JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'forming'
                 CHECK (status IN ('forming','dispatched','on_scene','demobilized')),
  priority     TEXT NOT NULL DEFAULT 'routine'
                 CHECK (priority IN ('routine','urgent','immediate')),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_task_forces_updated_at ON task_forces;
CREATE TRIGGER update_task_forces_updated_at
  BEFORE UPDATE ON task_forces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE task_forces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_forces_auth_read" ON task_forces;
CREATE POLICY "task_forces_auth_read"
  ON task_forces FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_forces_manager_write" ON task_forces;
CREATE POLICY "task_forces_manager_write"
  ON task_forces FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- Realtime for task_forces
ALTER PUBLICATION supabase_realtime ADD TABLE task_forces;
