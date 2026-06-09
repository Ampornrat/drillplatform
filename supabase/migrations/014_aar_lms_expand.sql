-- Migration 014: AAR + LMS Expand
-- Adds: finding_type/severity/evidence fields to improvement_actions
-- Adds: lms_courses, lms_assignments, sop_updates, scenario_bank_updates tables
-- Adds: create_improvement_action, close_improvement_action, propose_sop_update RPCs

-- ── Expand improvement_actions ────────────────────────────────────────────────

ALTER TABLE improvement_actions
  ADD COLUMN IF NOT EXISTS finding_type       TEXT,
  ADD COLUMN IF NOT EXISTS severity           TEXT DEFAULT 'warning'
    CHECK (severity IS NULL OR severity IN ('info','warning','critical')),
  ADD COLUMN IF NOT EXISTS evidence_event_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS root_cause         TEXT,
  ADD COLUMN IF NOT EXISTS recommended_track  TEXT,
  ADD COLUMN IF NOT EXISTS owner_id           UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── LMS Courses (lookup / seed) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lms_courses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code     TEXT        NOT NULL UNIQUE,
  course_name     TEXT        NOT NULL,
  course_name_th  TEXT,
  finding_type    TEXT,
  description     TEXT,
  duration_hours  INT         DEFAULT 4,
  provider        TEXT        DEFAULT 'Internal',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lms_courses_read" ON lms_courses;
CREATE POLICY "lms_courses_read" ON lms_courses FOR SELECT TO authenticated USING (true);

INSERT INTO lms_courses (course_code, course_name, course_name_th, finding_type, description, duration_hours)
VALUES
  ('MCI-TRIAGE-101',   'MCI Triage / START-SALT',             'การ Triage ผู้บาดเจ็บหมู่ START/SALT',  'triage_accuracy_low',    'ฝึกปฏิบัติ START & SALT triage protocol สำหรับ MCI', 8),
  ('SAFETY-HAZ-101',   'Incident Safety / HazMat Awareness',  'ความปลอดภัยในเหตุสารเคมี',              'safety_gate_violation',  'การระบุ hazard, PPE, scene safety และ HazMat zone',   6),
  ('FACILITY-CAP-101', 'Facility Capability Matching',        'การจับคู่ขีดความสามารถโรงพยาบาล',       'hospital_mismatch',      'METHANE report และการประสานงานโรงพยาบาล',             4),
  ('LOG-COLD-101',     'Medical Logistics / Cold Chain',      'โลจิสติกส์การแพทย์',                   'logistics_stockout',     'การวางแผนสำรองและ cold chain สำหรับวัสดุการแพทย์',    6),
  ('DOC-MIST-101',     'METHANE / MIST / Record Completeness','บันทึก METHANE / MIST ให้ครบถ้วน',      'documentation_gap',      'ฝึกการบันทึก MIST handover และ triage paperwork',      4),
  ('COMMS-SITREP-101', 'Radio / SITREP / METHANE Drill',      'การสื่อสารวิทยุและ SITREP',             'comms_failure',          'ฝึก radio procedure, SITREP format และ METHANE drill', 4),
  ('IAP-CMD-101',      'IAP Cycle / Incident Command',        'วัฏจักร IAP และ Incident Command',      'iap_delay',              'ฝึกสร้าง IAP ให้ทันภายใน 60 นาที',                   6),
  ('COP-SIT-101',      'COP Situational Awareness',           'การรักษา COP ให้ครบถ้วน',               'cop_incomplete',         'ฝึก Common Operating Picture และ situational awareness', 4)
ON CONFLICT (course_code) DO NOTHING;

-- ── LMS Assignments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lms_assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      UUID        REFERENCES improvement_actions(id) ON DELETE CASCADE,
  course_code     TEXT        NOT NULL,
  assignee_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline        DATE,
  status          TEXT        NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','completed','expired','cancelled')),
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  drill_id        UUID        REFERENCES drills(id) ON DELETE SET NULL
);

ALTER TABLE lms_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lms_assignments_read" ON lms_assignments;
CREATE POLICY "lms_assignments_read" ON lms_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lms_assignments_write" ON lms_assignments;
CREATE POLICY "lms_assignments_write" ON lms_assignments FOR ALL TO authenticated
  USING (get_user_role() IN ('admin','evaluator','commander'))
  WITH CHECK (get_user_role() IN ('admin','evaluator','commander'));

-- ── SOP Updates ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sop_updates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID        REFERENCES drills(id) ON DELETE SET NULL,
  aar_report_id   UUID        REFERENCES aar_reports(id) ON DELETE SET NULL,
  finding_id      UUID        REFERENCES improvement_actions(id) ON DELETE SET NULL,
  sop_code        TEXT,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  change_type     TEXT        NOT NULL DEFAULT 'update'
    CHECK (change_type IN ('create','update','retire','review')),
  priority        TEXT        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  status          TEXT        NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','under_review','approved','rejected','implemented')),
  proposed_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sop_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sop_updates_read" ON sop_updates;
CREATE POLICY "sop_updates_read" ON sop_updates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sop_updates_write" ON sop_updates;
CREATE POLICY "sop_updates_write" ON sop_updates FOR ALL TO authenticated
  USING (get_user_role() IN ('admin','evaluator','commander'))
  WITH CHECK (get_user_role() IN ('admin','evaluator','commander'));

-- ── Scenario Bank Updates ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scenario_bank_updates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID        REFERENCES drills(id) ON DELETE SET NULL,
  aar_report_id   UUID        REFERENCES aar_reports(id) ON DELETE SET NULL,
  template_id     UUID,
  title           TEXT        NOT NULL,
  summary         TEXT,
  lessons_learned TEXT,
  difficulty_adj  TEXT        CHECK (difficulty_adj IN ('easier','same','harder')),
  metric_data     JSONB       NOT NULL DEFAULT '{}',
  finding_codes   TEXT[]      NOT NULL DEFAULT '{}',
  submitted_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','merged','rejected'))
);

ALTER TABLE scenario_bank_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scenario_bank_updates_read" ON scenario_bank_updates;
CREATE POLICY "scenario_bank_updates_read" ON scenario_bank_updates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "scenario_bank_updates_write" ON scenario_bank_updates;
CREATE POLICY "scenario_bank_updates_write" ON scenario_bank_updates FOR ALL TO authenticated
  USING (get_user_role() IN ('admin','evaluator','commander'))
  WITH CHECK (get_user_role() IN ('admin','evaluator','commander'));

-- ── create_improvement_action RPC ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_improvement_action(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   text;
  v_id     uuid;
  v_drill  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized','message','ต้องเข้าสู่ระบบก่อน');
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin','evaluator','commander','controller') THEN
    RETURN jsonb_build_object('error','forbidden','message','ไม่มีสิทธิ์');
  END IF;

  SELECT drill_id INTO v_drill FROM aar_reports
  WHERE id = (payload->>'aar_report_id')::uuid;

  INSERT INTO improvement_actions (
    aar_report_id, finding_type, finding_code, category, description,
    recommendation, root_cause, recommended_track, priority, severity,
    responsible_party, owner_id, due_date,
    evidence_event_ids, lms_course, created_by
  ) VALUES (
    (payload->>'aar_report_id')::uuid,
    payload->>'finding_type',
    payload->>'finding_code',
    COALESCE(payload->>'category','area_for_improvement'),
    COALESCE(payload->>'description',''),
    payload->>'recommendation',
    payload->>'root_cause',
    payload->>'recommended_track',
    COALESCE(payload->>'priority','medium'),
    COALESCE(payload->>'severity','warning'),
    payload->>'responsible_party',
    (payload->>'owner_id')::uuid,
    (payload->>'due_date')::date,
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(payload->'evidence_event_ids') x), '{}'),
    payload->>'lms_course',
    v_uid
  ) RETURNING id INTO v_id;

  PERFORM _log_event('IMPROVEMENT_ACTION_CREATED',
    'Improvement: ' || COALESCE(payload->>'finding_type','') || ' — ' || COALESCE(payload->>'description',''),
    'drill', v_drill, 'info');

  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('id',v_id));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error','internal','message',SQLERRM);
END;
$$;

-- ── close_improvement_action RPC ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION close_improvement_action(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   text;
  v_drill  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized','message','ต้องเข้าสู่ระบบก่อน');
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin','evaluator','commander','controller') THEN
    RETURN jsonb_build_object('error','forbidden','message','ไม่มีสิทธิ์');
  END IF;

  SELECT r.drill_id INTO v_drill
  FROM improvement_actions ia
  JOIN aar_reports r ON r.id = ia.aar_report_id
  WHERE ia.id = (payload->>'action_id')::uuid;

  UPDATE improvement_actions SET
    status       = COALESCE(payload->>'status','resolved'),
    completed_at = CASE WHEN COALESCE(payload->>'status','resolved') = 'resolved' THEN NOW() ELSE NULL END,
    updated_at   = NOW()
  WHERE id = (payload->>'action_id')::uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found','message','ไม่พบ Action');
  END IF;

  PERFORM _log_event('IMPROVEMENT_ACTION_UPDATED',
    'Action ' || payload->>'action_id' || ' → ' || COALESCE(payload->>'status','resolved'),
    'drill', v_drill, 'info');

  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error','internal','message',SQLERRM);
END;
$$;

-- ── propose_sop_update RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION propose_sop_update(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized','message','ต้องเข้าสู่ระบบก่อน');
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin','evaluator','commander') THEN
    RETURN jsonb_build_object('error','forbidden','message','ไม่มีสิทธิ์');
  END IF;

  INSERT INTO sop_updates (
    drill_id, aar_report_id, finding_id, sop_code, title,
    description, change_type, priority, proposed_by
  ) VALUES (
    (payload->>'drill_id')::uuid,
    (payload->>'aar_report_id')::uuid,
    (payload->>'finding_id')::uuid,
    payload->>'sop_code',
    COALESCE(payload->>'title','SOP Update'),
    COALESCE(payload->>'description',''),
    COALESCE(payload->>'change_type','update'),
    COALESCE(payload->>'priority','medium'),
    v_uid
  ) RETURNING id INTO v_id;

  PERFORM _log_event('SOP_UPDATE_PROPOSED',
    'SOP Update proposed: ' || COALESCE(payload->>'title',''),
    'drill', (payload->>'drill_id')::uuid, 'info');

  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('id',v_id));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error','internal','message',SQLERRM);
END;
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['improvement_actions','lms_assignments','sop_updates','scenario_bank_updates'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
      AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t)
      THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || t;
      END IF;
    END LOOP;
  END IF;
END $$;
