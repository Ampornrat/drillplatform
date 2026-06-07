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
