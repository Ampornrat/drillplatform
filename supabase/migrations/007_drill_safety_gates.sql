-- ============================================================
-- Migration 007: Per-drill Safety Gate Status (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS drill_safety_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES safety_gate_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'failed', 'waived')),
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drill_id, rule_id)
);

DROP TRIGGER IF EXISTS update_drill_safety_gates_updated_at ON drill_safety_gates;
CREATE TRIGGER update_drill_safety_gates_updated_at
  BEFORE UPDATE ON drill_safety_gates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE drill_safety_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_drill_safety_gates" ON drill_safety_gates;
CREATE POLICY "auth_read_drill_safety_gates"
  ON drill_safety_gates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "commander_manage_drill_safety_gates" ON drill_safety_gates;
CREATE POLICY "commander_manage_drill_safety_gates"
  ON drill_safety_gates FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'commander'))
  WITH CHECK (get_user_role() IN ('admin', 'commander'));

-- RPC: upsert gate status for a drill (called from UI)
CREATE OR REPLACE FUNCTION upsert_drill_safety_gate(
  p_drill_id UUID,
  p_rule_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  INSERT INTO drill_safety_gates (drill_id, rule_id, status, checked_by, checked_at, notes)
  VALUES (p_drill_id, p_rule_id, p_status, v_user_id, NOW(), p_notes)
  ON CONFLICT (drill_id, rule_id) DO UPDATE SET
    status     = EXCLUDED.status,
    checked_by = EXCLUDED.checked_by,
    checked_at = EXCLUDED.checked_at,
    notes      = EXCLUDED.notes,
    updated_at = NOW();

  RETURN json_build_object('success', true);
END;
$$;

-- Enable realtime for live-update pages
ALTER PUBLICATION supabase_realtime ADD TABLE event_log;
ALTER PUBLICATION supabase_realtime ADD TABLE drill_safety_gates;
ALTER PUBLICATION supabase_realtime ADD TABLE drills;
