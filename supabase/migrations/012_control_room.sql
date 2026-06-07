-- Migration 012: Exercise Control Room
-- Tables: sim_clock_state, inject_deliveries, evaluator_flags

-- ── sim_clock_state ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sim_clock_state (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      UUID        NOT NULL UNIQUE REFERENCES scenario_instances(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'standby'
    CHECK (status IN ('standby','live','paused','safety_pause','completed')),
  elapsed_seconds  INT         NOT NULL DEFAULT 0,
  speed_multiplier NUMERIC     NOT NULL DEFAULT 1.0,
  started_at       TIMESTAMPTZ,
  paused_at        TIMESTAMPTZ,
  last_tick_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── inject_deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inject_deliveries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inject_id          UUID        NOT NULL REFERENCES msel_injects(id) ON DELETE CASCADE,
  scenario_id        UUID        NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
  delivered_to_role  TEXT,
  delivered_to_team  TEXT,
  delivered_to_user  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  delivered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at    TIMESTAMPTZ,
  acknowledged_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── evaluator_flags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluator_flags (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id          UUID        NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
  flagged_by           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flagged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category             TEXT        NOT NULL DEFAULT 'observation'
    CHECK (category IN ('observation','strength','weakness','safety_concern','critical_incident')),
  title                TEXT        NOT NULL,
  description          TEXT,
  severity             TEXT        NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  elapsed_seconds_at   INT,
  is_resolved          BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at          TIMESTAMPTZ,
  resolved_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-create sim_clock_state when scenario is created ───────────
CREATE OR REPLACE FUNCTION create_sim_clock_for_scenario()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sim_clock_state (scenario_id)
  VALUES (NEW.id)
  ON CONFLICT (scenario_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_sim_clock ON scenario_instances;
CREATE TRIGGER trg_create_sim_clock
  AFTER INSERT ON scenario_instances
  FOR EACH ROW EXECUTE FUNCTION create_sim_clock_for_scenario();

-- Backfill for existing scenarios
INSERT INTO sim_clock_state (scenario_id)
SELECT id FROM scenario_instances
ON CONFLICT (scenario_id) DO NOTHING;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE sim_clock_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inject_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluator_flags    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read sim_clock_state"   ON sim_clock_state;
DROP POLICY IF EXISTS "manage sim_clock_state" ON sim_clock_state;
CREATE POLICY "read sim_clock_state"   ON sim_clock_state FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "manage sim_clock_state" ON sim_clock_state FOR ALL    TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());

DROP POLICY IF EXISTS "read inject_deliveries"   ON inject_deliveries;
DROP POLICY IF EXISTS "manage inject_deliveries" ON inject_deliveries;
CREATE POLICY "read inject_deliveries"   ON inject_deliveries FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "manage inject_deliveries" ON inject_deliveries FOR ALL    TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());

DROP POLICY IF EXISTS "read evaluator_flags"   ON evaluator_flags;
DROP POLICY IF EXISTS "manage evaluator_flags" ON evaluator_flags;
CREATE POLICY "read evaluator_flags"   ON evaluator_flags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "manage evaluator_flags" ON evaluator_flags FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
