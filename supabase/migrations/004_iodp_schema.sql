-- ============================================================
-- IODP Schema — Integrated Operation + Drill Platform
-- Bangkok Flood/MCI scenario tables with real geolocation
-- ============================================================

-- ============================================================
-- IODP SESSIONS (Incidents / Drill sessions)
-- ============================================================
CREATE TABLE iodp_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  title_th      TEXT NOT NULL,
  title_en      TEXT,
  mode          TEXT NOT NULL DEFAULT 'operation' CHECK (mode IN ('operation', 'drill')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  scenario_type TEXT,
  op_period     TEXT,
  start_time    TIMESTAMPTZ DEFAULT NOW(),
  end_time      TIMESTAMPTZ,
  center_lat    DOUBLE PRECISION NOT NULL DEFAULT 13.7775,
  center_lng    DOUBLE PRECISION NOT NULL DEFAULT 100.4582,
  zoom_level    INTEGER DEFAULT 14,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  meta          JSONB DEFAULT '{}',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- IODP SITES (Map locations — hospitals, CCP, LZ, teams)
-- ============================================================
CREATE TABLE iodp_sites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  site_code     TEXT NOT NULL,
  name          TEXT,
  type          TEXT NOT NULL CHECK (type IN ('facility', 'incident', 'ccp', 'lz', 'uav', 'team')),
  status        TEXT DEFAULT 'active',
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  capacity      INTEGER,
  current_load  INTEGER DEFAULT 0,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, site_code)
);

-- ============================================================
-- IODP TEAMS (Response teams)
-- ============================================================
CREATE TABLE iodp_teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  team_code     TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT,
  status        TEXT DEFAULT 'active',
  site_id       UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  personnel     INTEGER DEFAULT 0,
  readiness     INTEGER DEFAULT 100 CHECK (readiness BETWEEN 0 AND 100),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, team_code)
);

-- ============================================================
-- IODP PATIENTS (Patient registry per session)
-- ============================================================
CREATE TABLE iodp_patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  patient_code  TEXT NOT NULL,
  triage_level  TEXT CHECK (triage_level IN ('P1', 'P2', 'P3', 'BLACK')),
  status        TEXT DEFAULT 'triaged'
                  CHECK (status IN ('found', 'triaged', 'en_route', 'admitted', 'deceased')),
  site_id       UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  destination_id UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  march_data    JSONB DEFAULT '{}',
  transport_mode TEXT,
  found_at      TIMESTAMPTZ DEFAULT NOW(),
  triaged_at    TIMESTAMPTZ,
  admitted_at   TIMESTAMPTZ,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, patient_code)
);

-- ============================================================
-- IODP EVENTS (Real-time event log)
-- ============================================================
CREATE TABLE iodp_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  event_code    TEXT NOT NULL,
  severity      TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'drill')),
  actor         TEXT,
  target        TEXT,
  description   TEXT,
  flagged       BOOLEAN DEFAULT false,
  site_id       UUID REFERENCES iodp_sites(id) ON DELETE SET NULL,
  team_id       UUID REFERENCES iodp_teams(id) ON DELETE SET NULL,
  patient_id    UUID REFERENCES iodp_patients(id) ON DELETE SET NULL,
  meta          JSONB DEFAULT '{}',
  occurred_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- IODP SAFETY GATES (Gate status per session)
-- ============================================================
CREATE TABLE iodp_safety_gates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  gate_code     TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending'
                  CHECK (status IN ('passed', 'pending', 'failed', 'waived', 'critical')),
  checked_by    TEXT,
  checked_at    TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, gate_code)
);

-- ============================================================
-- IODP INJECTS (MSEL drill inject queue)
-- ============================================================
CREATE TABLE iodp_injects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  inject_code   TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT DEFAULT 'scenario',
  status        TEXT DEFAULT 'queued'
                  CHECK (status IN ('queued', 'pushed', 'acknowledged', 'completed', 'skipped')),
  scheduled_at  TIMESTAMPTZ,
  pushed_at     TIMESTAMPTZ,
  target_team   TEXT,
  severity      TEXT DEFAULT 'info',
  expected_action TEXT,
  actual_action TEXT,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, inject_code)
);

-- ============================================================
-- IODP AAR FINDINGS
-- ============================================================
CREATE TABLE iodp_aar_findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES iodp_sessions(id) ON DELETE CASCADE,
  finding_code  TEXT NOT NULL,
  severity      TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  lms_course    TEXT,
  lms_deadline  TEXT,
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, finding_code)
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_iodp_sessions_updated_at  BEFORE UPDATE ON iodp_sessions  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_iodp_sites_updated_at      BEFORE UPDATE ON iodp_sites      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_iodp_teams_updated_at      BEFORE UPDATE ON iodp_teams      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_iodp_patients_updated_at   BEFORE UPDATE ON iodp_patients   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_iodp_safety_gates_updated_at BEFORE UPDATE ON iodp_safety_gates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_iodp_injects_updated_at    BEFORE UPDATE ON iodp_injects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS — public read for active sessions, write requires auth
-- ============================================================
ALTER TABLE iodp_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_sites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_patients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_safety_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_injects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE iodp_aar_findings ENABLE ROW LEVEL SECURITY;

-- Read: anyone (anon) can read active session data (display-only)
CREATE POLICY "iodp_sessions_read"     ON iodp_sessions     FOR SELECT USING (true);
CREATE POLICY "iodp_sites_read"        ON iodp_sites        FOR SELECT USING (true);
CREATE POLICY "iodp_teams_read"        ON iodp_teams        FOR SELECT USING (true);
CREATE POLICY "iodp_patients_read"     ON iodp_patients     FOR SELECT USING (true);
CREATE POLICY "iodp_events_read"       ON iodp_events       FOR SELECT USING (true);
CREATE POLICY "iodp_safety_gates_read" ON iodp_safety_gates FOR SELECT USING (true);
CREATE POLICY "iodp_injects_read"      ON iodp_injects      FOR SELECT USING (true);
CREATE POLICY "iodp_aar_findings_read" ON iodp_aar_findings FOR SELECT USING (true);

-- Write: authenticated users only
CREATE POLICY "iodp_sessions_write"     ON iodp_sessions     FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_sites_write"        ON iodp_sites        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_teams_write"        ON iodp_teams        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_patients_write"     ON iodp_patients     FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_events_write"       ON iodp_events       FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_safety_gates_write" ON iodp_safety_gates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_injects_write"      ON iodp_injects      FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "iodp_aar_findings_write" ON iodp_aar_findings FOR ALL USING (auth.uid() IS NOT NULL);
