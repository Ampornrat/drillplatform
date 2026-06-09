-- Migration 013: Evaluation Expand
-- Adds: measurement_rules table, v_safety_violations view
-- Creates evaluator_flags if not yet present (idempotent with 012)
-- Expands: evaluator_flags with metric scoring fields
-- Realtime: evaluation_scores

-- ── Create evaluator_flags if migration 012 was not applied ──────────────────

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

ALTER TABLE evaluator_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evaluator_flags_read" ON evaluator_flags;
CREATE POLICY "evaluator_flags_read"
  ON evaluator_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "evaluator_flags_write" ON evaluator_flags;
CREATE POLICY "evaluator_flags_write"
  ON evaluator_flags FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'evaluator', 'commander', 'controller'))
  WITH CHECK (get_user_role() IN ('admin', 'evaluator', 'commander', 'controller'));

-- ── Expand evaluator_flags with scoring fields ────────────────────────────────

ALTER TABLE evaluator_flags
  ADD COLUMN IF NOT EXISTS metric_code        TEXT,
  ADD COLUMN IF NOT EXISTS subject_ref        TEXT,
  ADD COLUMN IF NOT EXISTS score              NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_score          NUMERIC(5,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS result             TEXT
    CHECK (result IS NULL OR result IN ('pass', 'gap', 'fail')),
  ADD COLUMN IF NOT EXISTS finding            TEXT,
  ADD COLUMN IF NOT EXISTS evidence_event_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS root_cause         TEXT;

-- ── Measurement rules table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS measurement_rules (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code          TEXT        NOT NULL UNIQUE,
  metric_name          TEXT        NOT NULL,
  metric_name_th       TEXT,
  category             TEXT        NOT NULL,
  description          TEXT,
  max_score            NUMERIC(5,2) NOT NULL DEFAULT 5,
  pass_threshold       NUMERIC(5,2) NOT NULL DEFAULT 3,
  is_safety_critical   BOOLEAN      NOT NULL DEFAULT FALSE,
  start_event_type     TEXT,
  end_event_type       TEXT,
  time_target_seconds  INTEGER,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE measurement_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "measurement_rules_authenticated_read" ON measurement_rules;
CREATE POLICY "measurement_rules_authenticated_read"
  ON measurement_rules FOR SELECT TO authenticated USING (true);

-- Seed 6 core metrics
INSERT INTO measurement_rules
  (metric_code, metric_name, metric_name_th, category, description,
   max_score, pass_threshold, is_safety_critical,
   start_event_type, end_event_type, time_target_seconds)
VALUES
  ('TRIAGE_ACCURACY',
   'Triage Accuracy', 'ความแม่นยำ Triage', 'medical',
   'ความแม่นยำในการ triage ผู้บาดเจ็บตาม START/SALT protocol',
   5, 3, false, null, null, null),

  ('P1_FIRST_CONTACT',
   'P1 First Contact Time', 'เวลาถึง P1 ครั้งแรก', 'medical',
   'เวลาตั้งแต่เกิดเหตุจนผู้บาดเจ็บ P1 ได้รับการดูแลครั้งแรก (เป้าหมาย ≤ 10 นาที)',
   5, 3, false, 'INCIDENT_CREATED', 'PATIENT_TRIAGED', 600),

  ('SAFETY_VIOLATIONS',
   'Safety Violations', 'การละเมิดความปลอดภัย', 'safety',
   'จำนวนการละเมิดกฎความปลอดภัย — แสดงแยกเป็น critical flag ไม่นำไปเฉลี่ย',
   5, 5, true, null, null, null),

  ('RECORD_COMPLETENESS',
   'Record Completeness', 'ความครบถ้วนเวชระเบียน', 'documentation',
   'ความครบถ้วนของการบันทึก MIST/MARCH, triage tag และ paperwork',
   5, 3, false, null, null, null),

  ('IAP_CYCLE_TIME',
   'IAP Cycle Time', 'เวลา IAP Cycle', 'command',
   'เวลาตั้งแต่เกิดเหตุจนอนุมัติ IAP (เป้าหมาย ≤ 60 นาที)',
   5, 3, false, 'INCIDENT_CREATED', 'IAP_ACTIVATED', 3600),

  ('COP_COMPLETENESS',
   'COP Completeness', 'ความครบถ้วน COP', 'command',
   'ความครบถ้วนของ Common Operating Picture (sites, teams, patients)',
   5, 3, false, null, null, null)
ON CONFLICT (metric_code) DO NOTHING;

-- ── Safety violations view (only if drill_safety_gates exists) ───────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drill_safety_gates'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'safety_gate_rules'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW v_safety_violations AS
      SELECT
        dsg.id,
        dsg.drill_id,
        sgr.id           AS rule_id,
        sgr.rule_code,
        sgr.title,
        sgr.description,
        sgr.category,
        sgr.severity,
        dsg.status,
        dsg.notes        AS violation_notes,
        dsg.passed_at,
        dsg.created_at,
        d.title          AS drill_title
      FROM drill_safety_gates dsg
      JOIN safety_gate_rules sgr ON sgr.id = dsg.rule_id
      JOIN drills d              ON d.id  = dsg.drill_id
      WHERE dsg.status = 'failed'
    $view$;
    RAISE NOTICE 'v_safety_violations view created';
  ELSE
    RAISE NOTICE 'Skipping v_safety_violations — drill_safety_gates not found (run migration 007 first)';
  END IF;
END $$;

-- ── Realtime for evaluation_scores ────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_scores')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'evaluation_scores')
    THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_scores';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluator_flags')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'evaluator_flags')
    THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE evaluator_flags';
    END IF;
  END IF;
END $$;
