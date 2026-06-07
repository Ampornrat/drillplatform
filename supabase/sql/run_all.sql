-- Migration 008: Expand profiles.role to support new operational roles
-- New roles: medical, logistics, controller, evaluator
-- Existing roles unchanged: admin, commander, observer, participant, guest

-- Drop old check constraint (may vary by Supabase version — try both forms)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;

-- Add expanded constraint
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'commander',
    'medical',
    'logistics',
    'controller',
    'evaluator',
    'observer',
    'participant',
    'guest'
  ));

-- Update RLS helper function to recognise new management roles
CREATE OR REPLACE FUNCTION is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'commander', 'controller')
  )
$$;

-- Update authority_matrix with permissions for new roles
INSERT INTO authority_matrix (role, resource, action, allowed)
VALUES
  ('medical',    'event_log',       'read',  true),
  ('medical',    'event_log',       'write', true),
  ('medical',    'master_registry', 'read',  true),
  ('medical',    'standards',       'read',  true),
  ('logistics',  'event_log',       'read',  true),
  ('logistics',  'event_log',       'write', true),
  ('logistics',  'master_registry', 'read',  true),
  ('controller', 'drills',          'read',  true),
  ('controller', 'drills',          'write', true),
  ('controller', 'safety_gates',    'read',  true),
  ('controller', 'safety_gates',    'write', true),
  ('controller', 'event_log',       'read',  true),
  ('evaluator',  'event_log',       'read',  true),
  ('evaluator',  'aar',             'read',  true),
  ('evaluator',  'aar',             'write', true),
  ('evaluator',  'standards',       'read',  true)
ON CONFLICT DO NOTHING;
-- ============================================================
-- integration_patch.sql
-- Idempotent backend patch — run this in Supabase SQL editor.
-- NO DROP TABLE, NO DELETE, NO RENAME. Safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. EXPAND ROLE CONSTRAINTS (idempotent)
-- ============================================================

-- profiles.role — expand to new operational roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin', 'commander', 'medical', 'logistics',
    'controller', 'evaluator', 'observer', 'participant', 'guest'
  ));

-- authority_matrix.role — same expansion
ALTER TABLE authority_matrix DROP CONSTRAINT IF EXISTS authority_matrix_role_check;
ALTER TABLE authority_matrix
  ADD CONSTRAINT authority_matrix_role_check
  CHECK (role IN (
    'admin', 'commander', 'medical', 'logistics',
    'controller', 'evaluator', 'observer', 'participant', 'guest'
  ));

-- ============================================================
-- 2. EXPAND / UPDATE HELPER FUNCTIONS
-- ============================================================

-- is_commander_or_above: now includes controller
CREATE OR REPLACE FUNCTION is_commander_or_above()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'commander', 'controller')
  )
$$;

-- is_manager: same as is_commander_or_above (alias for new naming)
CREATE OR REPLACE FUNCTION is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'commander', 'controller')
  )
$$;

-- can_write_drill: check if user can mutate a specific drill
CREATE OR REPLACE FUNCTION can_write_drill(p_drill_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    is_manager()
    OR EXISTS (
      SELECT 1 FROM drill_participants
      WHERE drill_id = p_drill_id AND user_id = auth.uid()
    )
  )
$$;

-- ============================================================
-- 3. METHANE REPORTS (METHANE incident report form)
-- ============================================================
CREATE TABLE IF NOT EXISTS methane_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id       UUID REFERENCES drills(id) ON DELETE SET NULL,
  mechanism      TEXT NOT NULL,
  exact_location TEXT NOT NULL,
  type           TEXT NOT NULL,
  hazards        TEXT DEFAULT '',
  access         TEXT DEFAULT '',
  number_of_casualties INTEGER DEFAULT 0,
  emergency_services TEXT NOT NULL,
  notes          TEXT,
  reported_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE methane_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "methane_reports_auth_read" ON methane_reports;
CREATE POLICY "methane_reports_auth_read"
  ON methane_reports FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "methane_reports_manager_write" ON methane_reports;
CREATE POLICY "methane_reports_manager_write"
  ON methane_reports FOR ALL
  TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ============================================================
-- 4. IAP VERSIONS + SECTIONS (Incident Action Plan)
-- ============================================================
CREATE TABLE IF NOT EXISTS iap_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id      UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  objectives    TEXT[] NOT NULL DEFAULT '{}',
  period_start  TIMESTAMPTZ,
  period_end    TIMESTAMPTZ,
  notes         TEXT,
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drill_id, version)
);

DROP TRIGGER IF EXISTS update_iap_versions_updated_at ON iap_versions;
CREATE TRIGGER update_iap_versions_updated_at
  BEFORE UPDATE ON iap_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE iap_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "iap_versions_auth_read" ON iap_versions;
CREATE POLICY "iap_versions_auth_read"
  ON iap_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "iap_versions_manager_write" ON iap_versions;
CREATE POLICY "iap_versions_manager_write"
  ON iap_versions FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- IAP Sections
CREATE TABLE IF NOT EXISTS iap_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iap_version_id UUID NOT NULL REFERENCES iap_versions(id) ON DELETE CASCADE,
  section_code   TEXT NOT NULL CHECK (section_code IN (
    'objectives', 'organization', 'assignment_of_resources',
    'communications', 'medical_plan', 'incident_map', 'safety_plan'
  )),
  content        JSONB NOT NULL DEFAULT '{}',
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(iap_version_id, section_code)
);

DROP TRIGGER IF EXISTS update_iap_sections_updated_at ON iap_sections;
CREATE TRIGGER update_iap_sections_updated_at
  BEFORE UPDATE ON iap_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE iap_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "iap_sections_auth_read" ON iap_sections;
CREATE POLICY "iap_sections_auth_read"
  ON iap_sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "iap_sections_manager_write" ON iap_sections;
CREATE POLICY "iap_sections_manager_write"
  ON iap_sections FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ============================================================
-- 5. DISPATCH ASSIGNMENTS (Resource / unit dispatch tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS dispatch_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id      UUID REFERENCES drills(id) ON DELETE CASCADE,
  resource_id   UUID REFERENCES master_registry(id) ON DELETE SET NULL,
  assigned_to   TEXT NOT NULL,
  location      TEXT,
  priority      TEXT DEFAULT 'routine'
                  CHECK (priority IN ('routine', 'urgent', 'immediate')),
  status        TEXT DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'en_route', 'on_scene', 'available', 'released')),
  notes         TEXT,
  assigned_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  released_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_dispatch_assignments_updated_at ON dispatch_assignments;
CREATE TRIGGER update_dispatch_assignments_updated_at
  BEFORE UPDATE ON dispatch_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE dispatch_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dispatch_assignments_auth_read" ON dispatch_assignments;
CREATE POLICY "dispatch_assignments_auth_read"
  ON dispatch_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dispatch_assignments_manager_write" ON dispatch_assignments;
CREATE POLICY "dispatch_assignments_manager_write"
  ON dispatch_assignments FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ============================================================
-- 6. FACILITY STATUS (Per-drill facility status log)
-- ============================================================
CREATE TABLE IF NOT EXISTS facility_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id      UUID REFERENCES drills(id) ON DELETE CASCADE,
  site_code     TEXT NOT NULL,
  site_name     TEXT,
  status        TEXT DEFAULT 'normal'
                  CHECK (status IN ('normal', 'surge', 'critical', 'closed')),
  current_load  INTEGER DEFAULT 0,
  capacity      INTEGER,
  notes         TEXT,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_facility_status_updated_at ON facility_status;
CREATE TRIGGER update_facility_status_updated_at
  BEFORE UPDATE ON facility_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE facility_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facility_status_auth_read" ON facility_status;
CREATE POLICY "facility_status_auth_read"
  ON facility_status FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "facility_status_write" ON facility_status;
CREATE POLICY "facility_status_write"
  ON facility_status FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ============================================================
-- 7. NOTIFICATIONS (In-app notification inbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT DEFAULT 'info'
               CHECK (type IN ('info', 'warning', 'critical', 'success')),
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN DEFAULT false,
  drill_id   UUID REFERENCES drills(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications(user_id, read, created_at DESC)
  WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read"
  ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_system_write" ON notifications;
CREATE POLICY "notifications_system_write"
  ON notifications FOR INSERT
  TO authenticated WITH CHECK (true); -- RPCs use SECURITY DEFINER
DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update"
  ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 8. EVALUATION SCORES (Per-drill evaluation metrics)
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id     UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  session_id   UUID REFERENCES iodp_sessions(id) ON DELETE SET NULL,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metric_id    TEXT NOT NULL,
  metric_name  TEXT NOT NULL,
  category     TEXT NOT NULL,
  score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score    NUMERIC(5,2) NOT NULL DEFAULT 10,
  notes        TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drill_id, evaluator_id, metric_id)
);

ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evaluation_scores_auth_read" ON evaluation_scores;
CREATE POLICY "evaluation_scores_auth_read"
  ON evaluation_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "evaluation_scores_evaluator_write" ON evaluation_scores;
CREATE POLICY "evaluation_scores_evaluator_write"
  ON evaluation_scores FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'evaluator', 'commander'))
  WITH CHECK (get_user_role() IN ('admin', 'evaluator', 'commander'));

-- ============================================================
-- 9. IMPROVEMENT ACTIONS (AAR follow-up items)
-- ============================================================
CREATE TABLE IF NOT EXISTS improvement_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aar_report_id     UUID REFERENCES aar_reports(id) ON DELETE CASCADE,
  finding_code      TEXT,
  category          TEXT DEFAULT 'area_for_improvement'
                      CHECK (category IN ('strength', 'area_for_improvement', 'sustain', 'improve')),
  description       TEXT NOT NULL,
  recommendation    TEXT,
  priority          TEXT DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status            TEXT DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred')),
  responsible_party TEXT,
  lms_course        TEXT,
  assignee_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_improvement_actions_updated_at ON improvement_actions;
CREATE TRIGGER update_improvement_actions_updated_at
  BEFORE UPDATE ON improvement_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE improvement_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "improvement_actions_auth_read" ON improvement_actions;
CREATE POLICY "improvement_actions_auth_read"
  ON improvement_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "improvement_actions_manager_write" ON improvement_actions;
CREATE POLICY "improvement_actions_manager_write"
  ON improvement_actions FOR ALL TO authenticated
  USING (is_commander_or_above() OR get_user_role() = 'evaluator')
  WITH CHECK (is_commander_or_above() OR get_user_role() = 'evaluator');

-- ============================================================
-- 10. SIM CLOCK STATE (One row per drill)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_clock_state (
  drill_id         UUID PRIMARY KEY REFERENCES drills(id) ON DELETE CASCADE,
  elapsed_seconds  INTEGER DEFAULT 0,
  is_running       BOOLEAN DEFAULT false,
  started_at       TIMESTAMPTZ,
  paused_at        TIMESTAMPTZ,
  speed_multiplier NUMERIC(4,2) DEFAULT 1.0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_sim_clock_state_updated_at ON sim_clock_state;
CREATE TRIGGER update_sim_clock_state_updated_at
  BEFORE UPDATE ON sim_clock_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sim_clock_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sim_clock_auth_read" ON sim_clock_state;
CREATE POLICY "sim_clock_auth_read"
  ON sim_clock_state FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sim_clock_controller_write" ON sim_clock_state;
CREATE POLICY "sim_clock_controller_write"
  ON sim_clock_state FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ============================================================
-- 11. INJECT DELIVERIES (MSEL inject acknowledgement tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS inject_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inject_id         UUID NOT NULL REFERENCES iodp_injects(id) ON DELETE CASCADE,
  team_code         TEXT NOT NULL,
  status            TEXT DEFAULT 'delivered'
                      CHECK (status IN ('delivered', 'acknowledged', 'completed', 'skipped')),
  delivered_at      TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT,
  UNIQUE(inject_id, team_code)
);

ALTER TABLE inject_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inject_deliveries_auth_read" ON inject_deliveries;
CREATE POLICY "inject_deliveries_auth_read"
  ON inject_deliveries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "inject_deliveries_auth_write" ON inject_deliveries;
CREATE POLICY "inject_deliveries_auth_write"
  ON inject_deliveries FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 12. PATIENT MOVEMENTS (Movement history)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES iodp_patients(id) ON DELETE CASCADE,
  from_site_id   UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  to_site_id     UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  transport_mode TEXT,
  moved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at       TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT
);

ALTER TABLE patient_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_movements_auth_read" ON patient_movements;
CREATE POLICY "patient_movements_auth_read"
  ON patient_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patient_movements_auth_write" ON patient_movements;
CREATE POLICY "patient_movements_auth_write"
  ON patient_movements FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 13. SUPPLY REQUESTS (Field supply request queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id         UUID REFERENCES drills(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES iodp_sessions(id) ON DELETE SET NULL,
  item_code        TEXT NOT NULL,
  item_name        TEXT NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit             TEXT NOT NULL,
  priority         TEXT DEFAULT 'routine'
                     CHECK (priority IN ('routine', 'urgent', 'immediate')),
  status           TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'dispatched', 'received', 'cancelled')),
  requesting_team  TEXT,
  location         TEXT,
  requested_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_supply_requests_updated_at ON supply_requests;
CREATE TRIGGER update_supply_requests_updated_at
  BEFORE UPDATE ON supply_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_requests_auth_read" ON supply_requests;
CREATE POLICY "supply_requests_auth_read"
  ON supply_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "supply_requests_auth_write" ON supply_requests;
CREATE POLICY "supply_requests_auth_write"
  ON supply_requests FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 14. ALTER EXISTING TABLES — add missing columns (idempotent)
-- ============================================================

-- iodp_sessions: add is_template flag for scenario templates
ALTER TABLE iodp_sessions ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE iodp_sessions ADD COLUMN IF NOT EXISTS template_name TEXT;

-- drills: add location_lat/lng for COP map centering
ALTER TABLE drills ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

-- event_log: add session_id FK for IODP events
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS iodp_session_id UUID REFERENCES iodp_sessions(id) ON DELETE SET NULL;

-- aar_reports: add lms_integration flag
ALTER TABLE aar_reports ADD COLUMN IF NOT EXISTS lms_synced BOOLEAN DEFAULT false;

-- ============================================================
-- 15. SEED: authority_matrix entries for new roles
-- ============================================================
INSERT INTO authority_matrix (role, resource, action, allowed)
VALUES
  ('medical',    'event_log',       'read',  true),
  ('medical',    'event_log',       'write', true),
  ('medical',    'master_registry', 'read',  true),
  ('medical',    'standards',       'read',  true),
  ('logistics',  'event_log',       'read',  true),
  ('logistics',  'event_log',       'write', true),
  ('logistics',  'master_registry', 'read',  true),
  ('logistics',  'dispatch',        'write', true),
  ('controller', 'drills',          'read',  true),
  ('controller', 'drills',          'write', true),
  ('controller', 'safety_gates',    'read',  true),
  ('controller', 'safety_gates',    'write', true),
  ('controller', 'event_log',       'read',  true),
  ('controller', 'sim_clock',       'write', true),
  ('controller', 'injects',         'write', true),
  ('evaluator',  'event_log',       'read',  true),
  ('evaluator',  'evaluation',      'write', true),
  ('evaluator',  'aar',             'read',  true),
  ('evaluator',  'aar',             'write', true),
  ('evaluator',  'standards',       'read',  true)
ON CONFLICT (role, resource, action) DO NOTHING;
-- iap_workflow_patch.sql
-- Adds workflow status + approval trail columns to iap_versions.
-- Run AFTER integration_patch.sql. Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE iap_versions
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_comments TEXT,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;

-- Idempotent CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'iap_versions_status_check'
      AND conrelid = 'iap_versions'::regclass
  ) THEN
    ALTER TABLE iap_versions ADD CONSTRAINT iap_versions_status_check
      CHECK (status IN ('draft','safety_brief','pending_approval','approved','active','reviewed','superseded'));
  END IF;
END $$;

-- Backfill any existing rows that have NULL status
UPDATE iap_versions SET status = 'draft' WHERE status IS NULL;
-- ============================================================
-- integration_views.sql
-- Dashboard views — all use CREATE OR REPLACE, safe to re-run.
-- Run AFTER integration_patch.sql (depends on new tables).
-- ============================================================

-- ============================================================
-- v_op_dashboard_summary
-- Active/paused operation per drill aggregated summary
-- ============================================================
CREATE OR REPLACE VIEW v_op_dashboard_summary AS
SELECT
  d.id                                    AS drill_id,
  d.title,
  d.mode,
  d.status,
  d.location,
  d.location_lat,
  d.location_lng,
  d.start_date,
  d.end_date,
  o.id                                    AS organization_id,
  o.name                                  AS organization_name,
  COUNT(DISTINCT dp.user_id)              AS participant_count,
  COUNT(DISTINCT e.id)                    AS total_events,
  COUNT(DISTINCT e.id) FILTER (WHERE e.severity = 'critical')
                                          AS critical_events,
  MAX(e.timestamp)                        AS last_event_at,
  (SELECT COUNT(*) FROM drill_safety_gates sg
   WHERE sg.drill_id = d.id AND sg.status IN ('passed','waived'))
                                          AS gates_passed,
  (SELECT COUNT(*) FROM safety_gate_rules r
   WHERE r.is_active AND r.action = 'block' AND r.condition_type = 'pre_check')
                                          AS gates_blocking_total,
  (SELECT COUNT(*) FROM dispatch_assignments da
   WHERE da.drill_id = d.id AND da.status IN ('assigned','en_route','on_scene'))
                                          AS active_resources
FROM drills d
LEFT JOIN organizations o        ON o.id = d.organization_id
LEFT JOIN drill_participants dp  ON dp.drill_id = d.id
LEFT JOIN event_log e            ON e.drill_id = d.id
WHERE d.mode = 'operation'
GROUP BY d.id, o.id, o.name;


-- ============================================================
-- v_drill_dashboard_summary
-- Drill-mode summary for controller dashboard
-- ============================================================
CREATE OR REPLACE VIEW v_drill_dashboard_summary AS
SELECT
  d.id                                    AS drill_id,
  d.title,
  d.mode,
  d.status,
  d.location,
  d.start_date,
  d.end_date,
  o.name                                  AS organization_name,
  COUNT(DISTINCT dp.user_id)              AS participant_count,
  COUNT(DISTINCT e.id)                    AS total_events,
  MAX(e.timestamp)                        AS last_event_at,
  sc.elapsed_seconds,
  sc.is_running,
  sc.speed_multiplier,
  -- Inject queue stats from any linked active IODP session
  COALESCE((
    SELECT COUNT(*) FROM iodp_injects i
    JOIN iodp_sessions s ON s.id = i.session_id
    WHERE s.organization_id = d.organization_id
      AND s.status = 'active'
      AND i.status = 'queued'
  ), 0)                                   AS injects_queued,
  COALESCE((
    SELECT COUNT(*) FROM iodp_injects i
    JOIN iodp_sessions s ON s.id = i.session_id
    WHERE s.organization_id = d.organization_id
      AND s.status = 'active'
      AND i.status = 'pushed'
  ), 0)                                   AS injects_pushed,
  -- Evaluation average
  (SELECT ROUND(AVG(score / NULLIF(max_score,0)) * 100, 1)
   FROM evaluation_scores es
   WHERE es.drill_id = d.id)              AS eval_avg_pct
FROM drills d
LEFT JOIN organizations o        ON o.id = d.organization_id
LEFT JOIN drill_participants dp  ON dp.drill_id = d.id
LEFT JOIN event_log e            ON e.drill_id = d.id
LEFT JOIN sim_clock_state sc     ON sc.drill_id = d.id
WHERE d.mode = 'drill'
GROUP BY d.id, o.name, sc.elapsed_seconds, sc.is_running, sc.speed_multiplier;


-- ============================================================
-- v_incident_cop_markers
-- All map markers for active IODP sessions (sites + teams + patients)
-- Filter by session_id in application layer.
-- ============================================================
CREATE OR REPLACE VIEW v_incident_cop_markers AS
-- Sites (hospitals, CCPs, LZs, etc.)
SELECT
  s.id          AS session_id,
  'site'        AS marker_type,
  st.id         AS marker_id,
  st.site_code  AS code,
  st.name,
  st.type       AS sub_type,
  st.status,
  st.lat,
  st.lng,
  st.current_load,
  st.capacity,
  NULL::numeric AS score,
  NULL::text    AS triage_level,
  st.updated_at
FROM iodp_sessions s
JOIN iodp_sites st ON st.session_id = s.id
WHERE s.status IN ('active', 'paused')

UNION ALL

-- Teams
SELECT
  s.id,
  'team',
  t.id,
  t.team_code,
  t.name,
  t.type,
  t.status,
  t.lat,
  t.lng,
  t.personnel,
  NULL,
  t.readiness::numeric,
  NULL,
  t.updated_at
FROM iodp_sessions s
JOIN iodp_teams t ON t.session_id = s.id
WHERE s.status IN ('active', 'paused')
  AND t.lat IS NOT NULL

UNION ALL

-- Active patients (not yet admitted/deceased)
SELECT
  s.id,
  'patient',
  p.id,
  p.patient_code,
  p.patient_code,
  'patient',
  p.status,
  p.lat,
  p.lng,
  1,
  NULL,
  NULL,
  p.triage_level,
  p.updated_at
FROM iodp_sessions s
JOIN iodp_patients p ON p.session_id = s.id
WHERE s.status IN ('active', 'paused')
  AND p.lat IS NOT NULL
  AND p.status NOT IN ('admitted', 'deceased');


-- ============================================================
-- v_facility_latest_status
-- Latest recorded facility status (deduped by site_code per drill)
-- ============================================================
CREATE OR REPLACE VIEW v_facility_latest_status AS
SELECT
  fs.drill_id,
  NULL::uuid                AS session_id,
  fs.site_code,
  fs.site_name,
  fs.status,
  fs.current_load,
  fs.capacity,
  ROUND(
    CASE WHEN COALESCE(fs.capacity, 0) > 0
         THEN (fs.current_load::numeric / fs.capacity) * 100
         ELSE 0 END, 1
  )                         AS load_pct,
  fs.notes,
  fs.updated_at
FROM (
  SELECT DISTINCT ON (drill_id, site_code) *
  FROM facility_status
  ORDER BY drill_id, site_code, updated_at DESC
) fs

UNION ALL

-- Facility-type IODP sites as fallback
SELECT
  NULL::uuid                AS drill_id,
  st.session_id,
  st.site_code,
  st.name                   AS site_name,
  st.status,
  st.current_load,
  st.capacity,
  ROUND(
    CASE WHEN COALESCE(st.capacity, 0) > 0
         THEN (st.current_load::numeric / st.capacity) * 100
         ELSE 0 END, 1
  )                         AS load_pct,
  st.meta->>'notes'         AS notes,
  st.updated_at
FROM iodp_sites st
WHERE st.type = 'facility';


-- ============================================================
-- v_patient_current_status
-- Current patient state with location names resolved
-- ============================================================
CREATE OR REPLACE VIEW v_patient_current_status AS
SELECT
  p.id,
  p.session_id,
  s.title_th      AS session_title,
  s.mode          AS session_mode,
  p.patient_code,
  p.triage_level,
  p.status,
  p.lat,
  p.lng,
  p.transport_mode,
  src.name        AS current_location,
  src.type        AS current_location_type,
  dst.name        AS destination,
  dst.type        AS destination_type,
  p.found_at,
  p.triaged_at,
  p.admitted_at,
  p.march_data,
  p.meta,
  p.updated_at
FROM iodp_patients p
JOIN iodp_sessions s ON s.id = p.session_id
LEFT JOIN iodp_sites src ON src.id = p.site_id
LEFT JOIN iodp_sites dst ON dst.id = p.destination_id;


-- ============================================================
-- v_resource_assignment_status
-- Current dispatch assignment status with resource details
-- ============================================================
CREATE OR REPLACE VIEW v_resource_assignment_status AS
SELECT
  da.id,
  da.drill_id,
  d.title         AS drill_title,
  d.mode          AS drill_mode,
  da.resource_id,
  mr.name         AS resource_name,
  mr.type         AS resource_type,
  mr.code         AS resource_code,
  da.assigned_to,
  da.location,
  da.priority,
  da.status,
  da.notes,
  da.assigned_at,
  da.released_at,
  EXTRACT(EPOCH FROM (COALESCE(da.released_at, NOW()) - da.assigned_at)) / 60
                  AS duration_minutes
FROM dispatch_assignments da
LEFT JOIN drills d          ON d.id = da.drill_id
LEFT JOIN master_registry mr ON mr.id = da.resource_id;


-- ============================================================
-- v_msel_queue
-- Pending and pushed MSEL injects with delivery counts
-- ============================================================
CREATE OR REPLACE VIEW v_msel_queue AS
SELECT
  i.id,
  i.session_id,
  s.title_th      AS session_title,
  s.mode,
  i.inject_code,
  i.title,
  i.description,
  i.type,
  i.status,
  i.severity,
  i.target_team,
  i.expected_action,
  i.scheduled_at,
  i.pushed_at,
  COALESCE(dl.delivered_count, 0)     AS delivered_count,
  COALESCE(dl.acknowledged_count, 0)  AS acknowledged_count
FROM iodp_injects i
JOIN iodp_sessions s ON s.id = i.session_id
LEFT JOIN (
  SELECT
    inject_id,
    COUNT(*) AS delivered_count,
    COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_count
  FROM inject_deliveries
  GROUP BY inject_id
) dl ON dl.inject_id = i.id
WHERE i.status IN ('queued', 'pushed')
ORDER BY i.scheduled_at NULLS LAST, i.created_at;


-- ============================================================
-- v_team_performance_summary
-- Aggregated evaluation scores per category per drill
-- ============================================================
CREATE OR REPLACE VIEW v_team_performance_summary AS
SELECT
  es.drill_id,
  d.title                                                   AS drill_title,
  es.category,
  ROUND(AVG(es.score), 2)                                   AS avg_score,
  ROUND(AVG(es.max_score), 2)                               AS avg_max_score,
  ROUND(AVG(es.score / NULLIF(es.max_score, 0)) * 100, 1)  AS avg_pct,
  COUNT(*)                                                  AS metric_count,
  COUNT(DISTINCT es.evaluator_id)                           AS evaluator_count,
  MIN(es.score / NULLIF(es.max_score, 0)) * 100             AS min_pct,
  MAX(es.score / NULLIF(es.max_score, 0)) * 100             AS max_pct
FROM evaluation_scores es
JOIN drills d ON d.id = es.drill_id
GROUP BY es.drill_id, d.title, es.category;


-- ============================================================
-- v_aar_findings_summary
-- Improvement actions with context (overdue flag, LMS status)
-- ============================================================
CREATE OR REPLACE VIEW v_aar_findings_summary AS
SELECT
  ia.id,
  ia.aar_report_id,
  r.drill_id,
  d.title         AS drill_title,
  r.title         AS aar_title,
  r.status        AS aar_status,
  ia.finding_code,
  ia.category,
  ia.description,
  ia.recommendation,
  ia.priority,
  ia.status,
  ia.responsible_party,
  ia.lms_course,
  ia.assignee_id,
  p.full_name     AS assignee_name,
  ia.due_date,
  ia.completed_at,
  CASE
    WHEN ia.due_date < CURRENT_DATE
     AND ia.status NOT IN ('resolved', 'deferred')
    THEN true ELSE false
  END             AS is_overdue
FROM improvement_actions ia
JOIN aar_reports r   ON r.id = ia.aar_report_id
JOIN drills d        ON d.id = r.drill_id
LEFT JOIN profiles p ON p.id = ia.assignee_id;


-- ============================================================
-- v_notification_inbox
-- Current user's notifications (unread first).
-- RLS on notifications table filters to auth.uid().
-- ============================================================
CREATE OR REPLACE VIEW v_notification_inbox AS
SELECT
  n.id,
  n.type,
  n.title,
  n.body,
  n.link,
  n.read,
  n.created_at,
  n.drill_id,
  d.title AS drill_title
FROM notifications n
LEFT JOIN drills d ON d.id = n.drill_id
WHERE n.user_id = auth.uid()
ORDER BY n.read ASC, n.created_at DESC;
-- ============================================================
-- integration_rpc.sql
-- Platform RPC functions — all use CREATE OR REPLACE, safe to re-run.
-- Run AFTER integration_patch.sql.
--
-- Conventions:
--   • All functions are SECURITY DEFINER
--   • auth.uid() check is always first
--   • Role check via get_user_role()
--   • Every mutation writes to event_log
--   • Returns jsonb: {success, data} or {error, message}
-- ============================================================

-- ============================================================
-- INTERNAL HELPER: _log_event
-- Called by all RPCs to log to event_log without exposing service_role
-- ============================================================
CREATE OR REPLACE FUNCTION _log_event(
  p_type     text,
  p_title    text,
  p_mode     text DEFAULT 'drill',
  p_drill_id uuid DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_description text DEFAULT NULL,
  p_data     jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO event_log (event_type, mode, user_id, drill_id, severity, title, description, data)
  VALUES (p_type, p_mode, auth.uid(), p_drill_id, p_severity, p_title, p_description, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


-- ============================================================
-- log_platform_event(payload jsonb)
-- Public RPC — UI / Server Actions use this to log events.
-- ============================================================
CREATE OR REPLACE FUNCTION log_platform_event(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  INSERT INTO event_log (
    event_type, mode, user_id, drill_id,
    severity, title, description, data, session_id
  )
  VALUES (
    COALESCE(payload->>'event_type', 'generic'),
    COALESCE(payload->>'mode', 'drill'),
    v_uid,
    (payload->>'drill_id')::uuid,
    COALESCE(payload->>'severity', 'info'),
    payload->>'title',
    payload->>'description',
    COALESCE(payload->'data', '{}'),
    payload->>'session_id'
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_event_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- create_incident_from_methane(payload jsonb)
-- Creates a METHANE report + linked operation drill record.
-- Required role: admin, commander
-- ============================================================
CREATE OR REPLACE FUNCTION create_incident_from_methane(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_drill_id uuid;
  v_report_id uuid;
  v_title    text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Commander หรือ Admin');
  END IF;

  -- Build incident title from METHANE data
  v_title := COALESCE(
    payload->>'title',
    'Incident: ' || COALESCE(payload->>'type', 'Unknown') || ' at ' || COALESCE(payload->>'exact_location', '?')
  );

  -- Create drill record (operation mode)
  INSERT INTO drills (title, description, mode, status, location, organization_id, created_by)
  VALUES (
    v_title,
    payload->>'hazards',
    COALESCE(payload->>'mode', 'operation'),
    'active',
    payload->>'exact_location',
    (payload->>'organization_id')::uuid,
    v_uid
  )
  RETURNING id INTO v_drill_id;

  -- Create METHANE report
  INSERT INTO methane_reports (
    drill_id, mechanism, exact_location, type,
    hazards, access, number_of_casualties, emergency_services, reported_by
  )
  VALUES (
    v_drill_id,
    COALESCE(payload->>'mechanism', ''),
    COALESCE(payload->>'exact_location', ''),
    COALESCE(payload->>'type', ''),
    COALESCE(payload->>'hazards', ''),
    COALESCE(payload->>'access', ''),
    COALESCE((payload->>'number_of_casualties')::integer, 0),
    COALESCE(payload->>'emergency_services', ''),
    v_uid
  )
  RETURNING id INTO v_report_id;

  PERFORM _log_event('incident_created', v_title, 'operation', v_drill_id, 'warning',
    'METHANE incident report submitted',
    jsonb_build_object('methane_report_id', v_report_id));

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('drill_id', v_drill_id, 'methane_report_id', v_report_id)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- create_iap_version(payload jsonb)
-- Creates a new IAP version for a drill.
-- Required role: admin, commander
-- ============================================================
CREATE OR REPLACE FUNCTION create_iap_version(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_drill_id uuid;
  v_version  integer;
  v_iap_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Commander หรือ Admin');
  END IF;

  v_drill_id := (payload->>'drill_id')::uuid;
  IF v_drill_id IS NULL THEN
    RETURN jsonb_build_object('error', 'validation_error', 'message', 'drill_id จำเป็น');
  END IF;

  -- Auto-increment version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM iap_versions WHERE drill_id = v_drill_id;

  INSERT INTO iap_versions (
    drill_id, version, objectives, period_start, period_end, notes, created_by
  )
  VALUES (
    v_drill_id,
    v_version,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(payload->'objectives')),
      ARRAY[]::text[]
    ),
    (payload->>'period_start')::timestamptz,
    (payload->>'period_end')::timestamptz,
    payload->>'notes',
    v_uid
  )
  RETURNING id INTO v_iap_id;

  PERFORM _log_event('iap_created', 'IAP Version ' || v_version || ' created',
    'operation', v_drill_id, 'info');

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('iap_id', v_iap_id, 'version', v_version)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- update_iap_section(payload jsonb)
-- Upserts a single IAP section.
-- Required role: admin, commander
-- ============================================================
CREATE OR REPLACE FUNCTION update_iap_section(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_version_id uuid;
  v_section_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Commander หรือ Admin');
  END IF;

  v_version_id := (payload->>'iap_version_id')::uuid;

  INSERT INTO iap_sections (iap_version_id, section_code, content, updated_by)
  VALUES (
    v_version_id,
    payload->>'section_code',
    COALESCE(payload->'content', '{}'),
    v_uid
  )
  ON CONFLICT (iap_version_id, section_code) DO UPDATE SET
    content    = EXCLUDED.content,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
  RETURNING id INTO v_section_id;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('section_id', v_section_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- dispatch_object(payload jsonb)
-- Dispatches a resource to an assignment.
-- Required role: admin, commander, logistics
-- ============================================================
CREATE OR REPLACE FUNCTION dispatch_object(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_drill_id   uuid;
  v_dispatch_id uuid;
  v_resource_name text := 'Resource';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'logistics') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Commander, Logistics หรือ Admin');
  END IF;

  v_drill_id := (payload->>'drill_id')::uuid;

  -- Get resource name for logging
  IF payload->>'resource_id' IS NOT NULL THEN
    SELECT name INTO v_resource_name FROM master_registry WHERE id = (payload->>'resource_id')::uuid;
  END IF;

  INSERT INTO dispatch_assignments (
    drill_id, resource_id, assigned_to, location, priority, notes, assigned_by
  )
  VALUES (
    v_drill_id,
    (payload->>'resource_id')::uuid,
    COALESCE(payload->>'assigned_to', 'Unknown'),
    payload->>'location',
    COALESCE(payload->>'priority', 'routine'),
    payload->>'notes',
    v_uid
  )
  RETURNING id INTO v_dispatch_id;

  PERFORM _log_event(
    'resource_dispatched',
    v_resource_name || ' dispatched to ' || (payload->>'assigned_to'),
    'operation', v_drill_id, 'info',
    NULL,
    jsonb_build_object('dispatch_id', v_dispatch_id)
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('dispatch_id', v_dispatch_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- update_facility_status(payload jsonb)
-- Logs a facility status update and updates iodp_sites if applicable.
-- Required role: admin, commander, medical, logistics
-- ============================================================
CREATE OR REPLACE FUNCTION update_facility_status(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_fs_id    uuid;
  v_drill_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical', 'logistics') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ไม่มีสิทธิ์อัปเดตสถานะ Facility');
  END IF;

  v_drill_id := (payload->>'drill_id')::uuid;

  -- Log to facility_status table
  INSERT INTO facility_status (
    drill_id, site_code, site_name, status, current_load, capacity, notes, updated_by
  )
  VALUES (
    v_drill_id,
    COALESCE(payload->>'site_code', 'UNKNOWN'),
    payload->>'site_name',
    COALESCE(payload->>'status', 'normal'),
    COALESCE((payload->>'current_load')::integer, 0),
    (payload->>'capacity')::integer,
    payload->>'notes',
    v_uid
  )
  RETURNING id INTO v_fs_id;

  -- Also update iodp_sites if session_id is provided
  IF payload->>'session_id' IS NOT NULL THEN
    UPDATE iodp_sites
    SET
      status       = COALESCE(payload->>'status', status),
      current_load = COALESCE((payload->>'current_load')::integer, current_load),
      updated_at   = NOW()
    WHERE session_id = (payload->>'session_id')::uuid
      AND site_code  = payload->>'site_code';
  END IF;

  PERFORM _log_event(
    'facility_status_updated',
    'Facility ' || COALESCE(payload->>'site_code', '') || ': ' || COALESCE(payload->>'status', ''),
    'operation', v_drill_id, 'info'
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('facility_status_id', v_fs_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- submit_field_checkin(payload jsonb)
-- Records a field team check-in for a session.
-- Required role: any authenticated user
-- ============================================================
CREATE OR REPLACE FUNCTION submit_field_checkin(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_team_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  -- Update team status + location if it exists
  UPDATE iodp_teams
  SET
    status     = COALESCE(payload->>'status', status),
    personnel  = COALESCE((payload->>'personnel_count')::integer, personnel),
    updated_at = NOW()
  WHERE session_id = (payload->>'session_id')::uuid
    AND team_code  = payload->>'team_code'
  RETURNING id INTO v_team_id;

  -- Log check-in event
  INSERT INTO iodp_events (
    session_id, event_code, severity, actor, description
  )
  VALUES (
    (payload->>'session_id')::uuid,
    'CHECKIN_' || COALESCE(payload->>'team_code', 'UNKNOWN'),
    'info',
    payload->>'team_code',
    COALESCE(payload->>'location', '') || ' — Check-in submitted'
  );

  PERFORM _log_event(
    'team_checked_in',
    'Team ' || COALESCE(payload->>'team_code', '') || ' checked in',
    'drill', NULL, 'info'
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('team_id', v_team_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- submit_field_triage(payload jsonb)
-- Updates patient triage level, status, and destination.
-- Required role: medical, commander, admin
-- ============================================================
CREATE OR REPLACE FUNCTION submit_field_triage(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_patient   iodp_patients%ROWTYPE;
  v_from_site uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Medical, Commander หรือ Admin');
  END IF;

  -- Fetch current patient for movement history
  SELECT * INTO v_patient FROM iodp_patients WHERE id = (payload->>'patient_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบข้อมูลผู้ป่วย');
  END IF;

  v_from_site := v_patient.site_id;

  -- Update patient record
  UPDATE iodp_patients SET
    triage_level   = COALESCE(payload->>'triage_level', triage_level),
    status         = COALESCE(payload->>'status', status),
    destination_id = COALESCE((payload->>'destination_id')::uuid, destination_id),
    transport_mode = COALESCE(payload->>'transport_mode', transport_mode),
    march_data     = CASE WHEN payload->'march_data' IS NOT NULL THEN payload->'march_data' ELSE march_data END,
    triaged_at     = CASE WHEN triage_level IS NULL THEN NOW() ELSE triaged_at END,
    updated_at     = NOW()
  WHERE id = v_patient.id;

  -- Record movement if destination changed
  IF payload->>'destination_id' IS NOT NULL
     AND (payload->>'destination_id')::uuid IS DISTINCT FROM v_from_site THEN
    INSERT INTO patient_movements (patient_id, from_site_id, to_site_id, transport_mode, moved_by)
    VALUES (
      v_patient.id,
      v_from_site,
      (payload->>'destination_id')::uuid,
      payload->>'transport_mode',
      v_uid
    );
  END IF;

  -- Log triage event
  INSERT INTO iodp_events (session_id, event_code, severity, actor, description, patient_id)
  VALUES (
    v_patient.session_id,
    'TRIAGE_' || COALESCE(payload->>'triage_level', 'UPD'),
    CASE payload->>'triage_level'
      WHEN 'P1' THEN 'critical'
      WHEN 'BLACK' THEN 'critical'
      ELSE 'info'
    END,
    v_uid::text,
    'Patient ' || v_patient.patient_code || ' triaged as ' || COALESCE(payload->>'triage_level', '?'),
    v_patient.id
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('patient_id', v_patient.id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- submit_supply_request(payload jsonb)
-- Creates a supply request from the field.
-- Required role: any authenticated user
-- ============================================================
CREATE OR REPLACE FUNCTION submit_supply_request(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_req_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  INSERT INTO supply_requests (
    drill_id, session_id, item_code, item_name,
    quantity, unit, priority, requesting_team, location, requested_by
  )
  VALUES (
    (payload->>'drill_id')::uuid,
    (payload->>'session_id')::uuid,
    COALESCE(payload->>'item_code', 'UNKNOWN'),
    COALESCE(payload->>'item_name', 'ไม่ระบุ'),
    COALESCE((payload->>'quantity')::integer, 1),
    COALESCE(payload->>'unit', 'unit'),
    COALESCE(payload->>'priority', 'routine'),
    payload->>'requesting_team',
    payload->>'location',
    v_uid
  )
  RETURNING id INTO v_req_id;

  PERFORM _log_event(
    'supply_requested',
    'Supply request: ' || COALESCE(payload->>'item_name', '') || ' ×' || COALESCE(payload->>'quantity', '1'),
    COALESCE(payload->>'mode', 'drill'),
    (payload->>'drill_id')::uuid,
    CASE payload->>'priority' WHEN 'immediate' THEN 'warning' WHEN 'urgent' THEN 'warning' ELSE 'info' END
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('request_id', v_req_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- push_msel_inject(payload jsonb)
-- Marks inject as pushed and creates delivery records per team.
-- Required role: admin, commander, controller
-- ============================================================
CREATE OR REPLACE FUNCTION push_msel_inject(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_inject   iodp_injects%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'controller') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Controller, Commander หรือ Admin');
  END IF;

  SELECT * INTO v_inject FROM iodp_injects WHERE id = (payload->>'inject_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบ Inject');
  END IF;

  -- Mark inject as pushed
  UPDATE iodp_injects SET
    status    = 'pushed',
    pushed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_inject.id;

  -- Create delivery record(s)
  INSERT INTO inject_deliveries (inject_id, team_code, status)
  VALUES (
    v_inject.id,
    COALESCE(payload->>'target_team', v_inject.target_team, 'ALL'),
    'delivered'
  )
  ON CONFLICT (inject_id, team_code) DO UPDATE SET
    status       = 'delivered',
    delivered_at = NOW();

  -- Log event on the session
  INSERT INTO iodp_events (session_id, event_code, severity, actor, description)
  VALUES (
    v_inject.session_id,
    'INJECT_' || v_inject.inject_code,
    COALESCE(v_inject.severity, 'info'),
    v_uid::text,
    'Inject pushed: ' || v_inject.title
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('inject_id', v_inject.id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- update_sim_clock(payload jsonb)
-- Controls the simulation clock (start / pause / resume / reset / set_speed).
-- Required role: admin, commander, controller
-- ============================================================
CREATE OR REPLACE FUNCTION update_sim_clock(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_drill_id uuid;
  v_action   text;
  v_clock    sim_clock_state%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'controller') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Controller, Commander หรือ Admin');
  END IF;

  v_drill_id := (payload->>'drill_id')::uuid;
  v_action   := COALESCE(payload->>'action', 'start');

  -- Ensure clock row exists
  INSERT INTO sim_clock_state (drill_id) VALUES (v_drill_id)
  ON CONFLICT (drill_id) DO NOTHING;

  SELECT * INTO v_clock FROM sim_clock_state WHERE drill_id = v_drill_id;

  CASE v_action
    WHEN 'start' THEN
      UPDATE sim_clock_state SET
        is_running  = true,
        started_at  = COALESCE(v_clock.started_at, NOW()),
        paused_at   = NULL,
        updated_at  = NOW()
      WHERE drill_id = v_drill_id;

    WHEN 'pause' THEN
      UPDATE sim_clock_state SET
        is_running = false,
        paused_at  = NOW(),
        updated_at = NOW()
      WHERE drill_id = v_drill_id;

    WHEN 'resume' THEN
      UPDATE sim_clock_state SET
        is_running = true,
        paused_at  = NULL,
        updated_at = NOW()
      WHERE drill_id = v_drill_id;

    WHEN 'reset' THEN
      UPDATE sim_clock_state SET
        elapsed_seconds = 0,
        is_running      = false,
        started_at      = NULL,
        paused_at       = NULL,
        updated_at      = NOW()
      WHERE drill_id = v_drill_id;

    WHEN 'set_speed' THEN
      UPDATE sim_clock_state SET
        speed_multiplier = COALESCE((payload->>'speed_multiplier')::numeric, 1.0),
        updated_at       = NOW()
      WHERE drill_id = v_drill_id;

    WHEN 'tick' THEN
      UPDATE sim_clock_state SET
        elapsed_seconds = elapsed_seconds + COALESCE((payload->>'delta_seconds')::integer, 1),
        updated_at      = NOW()
      WHERE drill_id = v_drill_id AND is_running = true;

    ELSE
      RETURN jsonb_build_object('error', 'validation_error', 'message', 'Unknown action: ' || v_action);
  END CASE;

  SELECT * INTO v_clock FROM sim_clock_state WHERE drill_id = v_drill_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'drill_id',         v_drill_id,
      'elapsed_seconds',  v_clock.elapsed_seconds,
      'is_running',       v_clock.is_running,
      'speed_multiplier', v_clock.speed_multiplier
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- submit_evaluation_score(payload jsonb)
-- Upserts an evaluation score for a metric.
-- Required role: admin, evaluator, commander
-- ============================================================
CREATE OR REPLACE FUNCTION submit_evaluation_score(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_drill_id uuid;
  v_score_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'evaluator', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin');
  END IF;

  v_drill_id := (payload->>'drill_id')::uuid;

  INSERT INTO evaluation_scores (
    drill_id, session_id, evaluator_id, metric_id, metric_name,
    category, score, max_score, notes, evaluated_at
  )
  VALUES (
    v_drill_id,
    (payload->>'session_id')::uuid,
    v_uid,
    COALESCE(payload->>'metric_id', 'M000'),
    COALESCE(payload->>'metric_name', 'Unknown Metric'),
    COALESCE(payload->>'category', 'general'),
    COALESCE((payload->>'score')::numeric, 0),
    COALESCE((payload->>'max_score')::numeric, 10),
    payload->>'notes',
    COALESCE((payload->>'evaluated_at')::timestamptz, NOW())
  )
  ON CONFLICT (drill_id, evaluator_id, metric_id) DO UPDATE SET
    score        = EXCLUDED.score,
    max_score    = EXCLUDED.max_score,
    notes        = EXCLUDED.notes,
    evaluated_at = EXCLUDED.evaluated_at
  RETURNING id INTO v_score_id;

  PERFORM _log_event(
    'evaluation_score_submitted',
    'Score for ' || (payload->>'metric_name') || ': ' || (payload->>'score') || '/' || (payload->>'max_score'),
    'drill', v_drill_id, 'info'
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('score_id', v_score_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- generate_aar_findings(payload jsonb)
-- Bulk-inserts improvement_actions for an AAR report.
-- Required role: admin, evaluator, commander
-- ============================================================
CREATE OR REPLACE FUNCTION generate_aar_findings(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_report_id  uuid;
  v_finding    jsonb;
  v_action_id  uuid;
  v_count      integer := 0;
  v_drill_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'evaluator', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin');
  END IF;

  v_report_id := (payload->>'aar_report_id')::uuid;

  SELECT drill_id INTO v_drill_id FROM aar_reports WHERE id = v_report_id;

  -- Insert each finding as an improvement_action
  FOR v_finding IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'findings', '[]'))
  LOOP
    INSERT INTO improvement_actions (
      aar_report_id, category, description, recommendation,
      priority, responsible_party, created_by
    )
    VALUES (
      v_report_id,
      COALESCE(v_finding->>'category', 'area_for_improvement'),
      COALESCE(v_finding->>'description', ''),
      v_finding->>'recommendation',
      COALESCE(v_finding->>'priority', 'medium'),
      v_finding->>'responsible_party',
      v_uid
    )
    RETURNING id INTO v_action_id;
    v_count := v_count + 1;
  END LOOP;

  -- Also update aar_reports.findings JSONB column
  UPDATE aar_reports SET
    findings   = COALESCE(payload->'findings', findings),
    updated_at = NOW()
  WHERE id = v_report_id;

  PERFORM _log_event('aar_findings_generated',
    v_count || ' improvement actions created from AAR',
    'drill', v_drill_id, 'info');

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('aar_report_id', v_report_id, 'actions_created', v_count)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ============================================================
-- assign_lms_course(payload jsonb)
-- Assigns an LMS course to an improvement action (AAR finding).
-- Required role: admin, evaluator, commander
-- ============================================================
CREATE OR REPLACE FUNCTION assign_lms_course(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_finding_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'evaluator', 'commander') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin');
  END IF;

  v_finding_id := (payload->>'finding_id')::uuid;

  UPDATE improvement_actions SET
    lms_course   = payload->>'lms_course',
    assignee_id  = (payload->>'assignee_id')::uuid,
    due_date     = (payload->>'deadline')::date,
    updated_at   = NOW()
  WHERE id = v_finding_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบ Finding');
  END IF;

  PERFORM _log_event('lms_course_assigned',
    'LMS course ' || COALESCE(payload->>'lms_course', '') || ' assigned',
    'drill', NULL, 'info');

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('finding_id', v_finding_id));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;
-- ============================================================
-- integration_realtime.sql
-- Enable Supabase Realtime for platform tables.
-- Run AFTER integration_patch.sql.
-- Safe to run multiple times — ALTER PUBLICATION ADD TABLE is idempotent
-- when using IF NOT EXISTS workaround (or just ignores duplicates).
-- ============================================================

-- ============================================================
-- CORE PLATFORM EVENTS (already added in 007, kept for reference)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE event_log;
ALTER PUBLICATION supabase_realtime ADD TABLE drills;
ALTER PUBLICATION supabase_realtime ADD TABLE drill_safety_gates;

-- ============================================================
-- NEW TABLES — add to realtime publication
-- ============================================================

-- In-app notification inbox (users subscribe to their own channel)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Resource dispatch assignments (logistics/commander watch)
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_assignments;

-- Facility status updates (medical/logistics watch)
ALTER PUBLICATION supabase_realtime ADD TABLE facility_status;

-- Supply requests queue (logistics watch)
ALTER PUBLICATION supabase_realtime ADD TABLE supply_requests;

-- Simulation clock state (controller + all participants)
ALTER PUBLICATION supabase_realtime ADD TABLE sim_clock_state;

-- Evaluation scores (evaluator + commander)
ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_scores;

-- ============================================================
-- IODP TABLES — add to realtime publication
-- ============================================================

-- IODP patients (medical + field watch patient status)
ALTER PUBLICATION supabase_realtime ADD TABLE iodp_patients;

-- IODP events (everyone in a session watches this)
ALTER PUBLICATION supabase_realtime ADD TABLE iodp_events;

-- MSEL injects queue (field teams watch for incoming injects)
ALTER PUBLICATION supabase_realtime ADD TABLE iodp_injects;

-- Inject deliveries (controller tracks acknowledgements)
ALTER PUBLICATION supabase_realtime ADD TABLE inject_deliveries;

-- Sites (COP map updates — facility load, team positions)
ALTER PUBLICATION supabase_realtime ADD TABLE iodp_sites;

-- Teams (COP map — team status, readiness)
ALTER PUBLICATION supabase_realtime ADD TABLE iodp_teams;

-- ============================================================
-- CHANNEL NAMING CONVENTIONS (for application subscriptions)
-- ============================================================
--
-- Channel              | Table              | Filter
-- ---------------------|--------------------|---------------------------------
-- event_log:drill      | event_log          | drill_id=eq.{drillId}
-- event_log:global     | event_log          | (none — observer page)
-- notifications:user   | notifications      | user_id=eq.{userId}
-- dispatch:drill       | dispatch_assignments| drill_id=eq.{drillId}
-- facility:drill       | facility_status    | drill_id=eq.{drillId}
-- supply:drill         | supply_requests    | drill_id=eq.{drillId}
-- sim_clock:drill      | sim_clock_state    | drill_id=eq.{drillId}
-- evaluation:drill     | evaluation_scores  | drill_id=eq.{drillId}
-- iodp:session         | iodp_*             | session_id=eq.{sessionId}
-- iodp:patients        | iodp_patients      | session_id=eq.{sessionId}
-- iodp:injects         | iodp_injects       | session_id=eq.{sessionId}
-- iodp:deliveries      | inject_deliveries  | inject_id=eq.{injectId}
-- iodp:sites           | iodp_sites         | session_id=eq.{sessionId}
-- iodp:teams           | iodp_teams         | session_id=eq.{sessionId}
--
-- Usage in TypeScript (Supabase client):
--
-- supabase.channel('sim_clock:drill')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'sim_clock_state',
--     filter: `drill_id=eq.${drillId}`,
--   }, (payload) => handleClockUpdate(payload))
--   .subscribe()

-- ─── cop_dispatch_patch: task_forces table ───────────────────────────────────

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

ALTER PUBLICATION supabase_realtime ADD TABLE task_forces;
