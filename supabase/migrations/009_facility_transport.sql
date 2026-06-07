-- ============================================================
-- Migration 009: Facility + Transport + Patient Matching
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Extend facility_status with medical capacity fields ────

ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS icu_beds_total    INTEGER DEFAULT 0;
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS icu_beds_available INTEGER DEFAULT 0;
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS or_available       BOOLEAN DEFAULT true;
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS blood_available    BOOLEAN DEFAULT true;
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS oxygen_level       TEXT DEFAULT 'normal'
  CHECK (oxygen_level IN ('normal', 'low', 'critical'));
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS diversion_status   TEXT DEFAULT 'open'
  CHECK (diversion_status IN ('open', 'divert', 'closed', 'overloaded'));
ALTER TABLE facility_status ADD COLUMN IF NOT EXISTS facility_level     TEXT
  CHECK (facility_level IN ('Role1', 'Role2', 'Role3', 'CoE', 'CCP'));

-- ── 2. Link iodp_sessions to drills ──────────────────────────

ALTER TABLE iodp_sessions ADD COLUMN IF NOT EXISTS drill_id UUID REFERENCES drills(id) ON DELETE SET NULL;

-- ── 3. Extend iodp_patients for transport tracking ────────────

ALTER TABLE iodp_patients ADD COLUMN IF NOT EXISTS mist_data   JSONB DEFAULT '{}';
ALTER TABLE iodp_patients ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;
ALTER TABLE iodp_patients ADD COLUMN IF NOT EXISTS transport_object_id UUID;

-- ── 4. Object Registry (transport resources per drill) ────────

CREATE TABLE IF NOT EXISTS object_registry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id            UUID REFERENCES drills(id) ON DELETE CASCADE,
  session_id          UUID REFERENCES iodp_sessions(id) ON DELETE SET NULL,
  object_code         TEXT NOT NULL,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('ambulance', 'boat', 'HEMS', 'UAV', 'ALS_unit', 'BLS_unit', 'other')),
  capability          TEXT[] DEFAULT '{}',
  status              TEXT DEFAULT 'available'
                        CHECK (status IN ('available', 'en_route', 'on_scene', 'standby', 'unavailable')),
  readiness           INTEGER DEFAULT 100 CHECK (readiness BETWEEN 0 AND 100),
  assigned_patient_id UUID REFERENCES iodp_patients(id) ON DELETE SET NULL,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  meta                JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS object_registry_drill_code
  ON object_registry(drill_id, object_code)
  WHERE drill_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_object_registry_updated_at ON object_registry;
CREATE TRIGGER update_object_registry_updated_at
  BEFORE UPDATE ON object_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE object_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "object_registry_auth_read" ON object_registry;
CREATE POLICY "object_registry_auth_read"
  ON object_registry FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "object_registry_manager_write" ON object_registry;
CREATE POLICY "object_registry_manager_write"
  ON object_registry FOR ALL TO authenticated
  USING (is_manager()) WITH CHECK (is_manager());

-- ── 5. Updated v_facility_latest_status view ─────────────────

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
  fs.icu_beds_total,
  fs.icu_beds_available,
  fs.or_available,
  fs.blood_available,
  fs.oxygen_level,
  fs.diversion_status,
  fs.facility_level,
  fs.notes,
  fs.updated_at
FROM (
  SELECT DISTINCT ON (drill_id, site_code) *
  FROM facility_status
  ORDER BY drill_id, site_code, updated_at DESC
) fs

UNION ALL

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
  0                         AS icu_beds_total,
  0                         AS icu_beds_available,
  true                      AS or_available,
  true                      AS blood_available,
  'normal'                  AS oxygen_level,
  'open'                    AS diversion_status,
  (st.meta->>'facility_level')::text AS facility_level,
  st.meta->>'notes'         AS notes,
  st.updated_at
FROM iodp_sites st
WHERE st.type = 'facility';


-- ── 6. patient_tracks view ────────────────────────────────────

CREATE OR REPLACE VIEW patient_tracks AS
SELECT
  p.id,
  p.session_id,
  s.drill_id,
  p.patient_code,
  p.triage_level,
  p.status,
  p.site_id,
  p.destination_id,
  p.transport_mode,
  p.transport_object_id,
  p.mist_data,
  p.march_data,
  p.departed_at,
  p.found_at,
  p.triaged_at,
  p.admitted_at,
  src.name       AS current_location,
  src.site_code  AS current_site_code,
  dst.name       AS destination_name,
  dst.site_code  AS destination_site_code,
  dst.type       AS destination_type,
  p.lat,
  p.lng,
  p.updated_at
FROM iodp_patients p
JOIN iodp_sessions s    ON s.id = p.session_id
LEFT JOIN iodp_sites src ON src.id = p.site_id
LEFT JOIN iodp_sites dst ON dst.id = p.destination_id;


-- ── 7. RPC: update_facility_status (enhanced) ────────────────

CREATE OR REPLACE FUNCTION update_facility_status(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_role             text;
  v_fs_id            uuid;
  v_drill_id         uuid;
  v_diversion        text;
  v_site_code        text;
  v_site_name        text;
  v_manager_uids     uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical', 'logistics') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ไม่มีสิทธิ์อัปเดตสถานะ Facility');
  END IF;

  v_drill_id    := (payload->>'drill_id')::uuid;
  v_diversion   := COALESCE(payload->>'diversion_status', 'open');
  v_site_code   := COALESCE(payload->>'site_code', 'UNKNOWN');
  v_site_name   := payload->>'site_name';

  INSERT INTO facility_status (
    drill_id, site_code, site_name, status, current_load, capacity,
    icu_beds_total, icu_beds_available, or_available, blood_available,
    oxygen_level, diversion_status, facility_level, notes, updated_by
  )
  VALUES (
    v_drill_id,
    v_site_code,
    v_site_name,
    COALESCE(payload->>'status', 'normal'),
    COALESCE((payload->>'current_load')::integer, 0),
    (payload->>'capacity')::integer,
    COALESCE((payload->>'icu_beds_total')::integer, 0),
    COALESCE((payload->>'icu_beds_available')::integer, 0),
    COALESCE((payload->>'or_available')::boolean, true),
    COALESCE((payload->>'blood_available')::boolean, true),
    COALESCE(payload->>'oxygen_level', 'normal'),
    v_diversion,
    payload->>'facility_level',
    payload->>'notes',
    v_uid
  )
  RETURNING id INTO v_fs_id;

  -- Log base event
  PERFORM _log_event(
    'facility_status_updated',
    'อัปเดตสถานะ ' || v_site_code || ': ' || COALESCE(payload->>'status', 'normal'),
    'operation', v_drill_id,
    CASE v_diversion WHEN 'divert' THEN 'warning' WHEN 'closed' THEN 'critical' WHEN 'overloaded' THEN 'critical' ELSE 'info' END,
    v_site_name
  );

  -- On diversion: log FACILITY_DIVERSION event and notify commanders + medical
  IF v_diversion IN ('divert', 'closed', 'overloaded') THEN
    PERFORM _log_event(
      'FACILITY_DIVERSION',
      'DIVERSION: ' || v_site_code || ' — ' || v_diversion,
      'operation', v_drill_id, 'critical',
      'สถานพยาบาล ' || COALESCE(v_site_name, v_site_code) || ' สถานะ: ' || v_diversion
    );

    -- Notify all commanders and medical staff for this drill
    INSERT INTO notifications (user_id, type, title, body, link, drill_id)
    SELECT
      p.id,
      'critical',
      'Diversion Alert: ' || COALESCE(v_site_name, v_site_code),
      'สถานพยาบาลประกาศ ' || v_diversion || ' — กรุณาเปลี่ยนเส้นทางผู้ป่วย',
      '/operation/' || v_drill_id::text || '/facility',
      v_drill_id
    FROM profiles p
    WHERE p.role IN ('commander', 'medical', 'admin')
      AND p.is_active = true;
  END IF;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'facility_status_id', v_fs_id,
    'diversion', v_diversion
  ));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ── 8. RPC: assign_patient_destination ───────────────────────

CREATE OR REPLACE FUNCTION assign_patient_destination(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_patient    iodp_patients%ROWTYPE;
  v_dst_site   iodp_sites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Medical, Commander หรือ Admin');
  END IF;

  SELECT * INTO v_patient FROM iodp_patients WHERE id = (payload->>'patient_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบข้อมูลผู้ป่วย');
  END IF;

  SELECT * INTO v_dst_site FROM iodp_sites WHERE id = (payload->>'destination_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบสถานพยาบาลปลายทาง');
  END IF;

  UPDATE iodp_patients SET
    destination_id       = v_dst_site.id,
    transport_mode       = COALESCE(payload->>'transport_mode', transport_mode),
    transport_object_id  = (payload->>'transport_object_id')::uuid,
    updated_at           = NOW()
  WHERE id = v_patient.id;

  INSERT INTO iodp_events (session_id, event_code, severity, actor, description, patient_id)
  VALUES (
    v_patient.session_id,
    'PATIENT_DESTINATION_ASSIGNED',
    CASE v_patient.triage_level WHEN 'P1' THEN 'critical' ELSE 'info' END,
    v_uid::text,
    'Patient ' || v_patient.patient_code || ' → ' || COALESCE(v_dst_site.name, v_dst_site.site_code),
    v_patient.id
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'patient_id',    v_patient.id,
    'patient_code',  v_patient.patient_code,
    'destination',   COALESCE(v_dst_site.name, v_dst_site.site_code)
  ));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ── 9. RPC: create_patient_movement ──────────────────────────

CREATE OR REPLACE FUNCTION create_patient_movement(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_patient    iodp_patients%ROWTYPE;
  v_move_id    uuid;
  v_transport_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical', 'logistics') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Medical, Logistics, Commander หรือ Admin');
  END IF;

  SELECT * INTO v_patient FROM iodp_patients WHERE id = (payload->>'patient_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบข้อมูลผู้ป่วย');
  END IF;

  v_transport_id := (payload->>'transport_object_id')::uuid;

  -- Record movement
  INSERT INTO patient_movements (patient_id, from_site_id, to_site_id, transport_mode, moved_by, notes)
  VALUES (
    v_patient.id,
    COALESCE((payload->>'from_site_id')::uuid, v_patient.site_id),
    (payload->>'to_site_id')::uuid,
    COALESCE(payload->>'transport_mode', v_patient.transport_mode),
    v_uid,
    payload->>'notes'
  )
  RETURNING id INTO v_move_id;

  -- Update patient status
  UPDATE iodp_patients SET
    status              = 'en_route',
    departed_at         = NOW(),
    transport_object_id = COALESCE(v_transport_id, transport_object_id),
    updated_at          = NOW()
  WHERE id = v_patient.id;

  -- Mark transport object en_route
  IF v_transport_id IS NOT NULL THEN
    UPDATE object_registry SET
      status              = 'en_route',
      assigned_patient_id = v_patient.id,
      updated_at          = NOW()
    WHERE id = v_transport_id;
  END IF;

  INSERT INTO iodp_events (session_id, event_code, severity, actor, description, patient_id)
  VALUES (
    v_patient.session_id,
    'PATIENT_TRANSPORT_STARTED',
    CASE v_patient.triage_level WHEN 'P1' THEN 'critical' ELSE 'info' END,
    v_uid::text,
    'Transport started: ' || v_patient.patient_code || ' via ' || COALESCE(payload->>'transport_mode', 'unknown'),
    v_patient.id
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'movement_id', v_move_id,
    'patient_id',  v_patient.id
  ));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ── 10. RPC: confirm_patient_handover ────────────────────────

CREATE OR REPLACE FUNCTION confirm_patient_handover(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_role         text;
  v_patient      iodp_patients%ROWTYPE;
  v_transport_id uuid;
  v_dst_site     iodp_sites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'message', 'ต้องเข้าสู่ระบบก่อน');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'commander', 'medical') THEN
    RETURN jsonb_build_object('error', 'forbidden', 'message', 'ต้องมีสิทธิ์ Medical, Commander หรือ Admin');
  END IF;

  SELECT * INTO v_patient FROM iodp_patients WHERE id = (payload->>'patient_id')::uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'ไม่พบข้อมูลผู้ป่วย');
  END IF;

  v_transport_id := COALESCE(v_patient.transport_object_id, (payload->>'transport_object_id')::uuid);

  -- Confirm patient arrival
  UPDATE iodp_patients SET
    status      = 'admitted',
    admitted_at = NOW(),
    site_id     = COALESCE(v_patient.destination_id, v_patient.site_id),
    destination_id = NULL,
    mist_data   = CASE WHEN payload->'mist_data' IS NOT NULL THEN payload->'mist_data' ELSE mist_data END,
    transport_object_id = NULL,
    updated_at  = NOW()
  WHERE id = v_patient.id;

  -- Update transport object back to available
  IF v_transport_id IS NOT NULL THEN
    UPDATE object_registry SET
      status              = 'available',
      assigned_patient_id = NULL,
      updated_at          = NOW()
    WHERE id = v_transport_id;
  END IF;

  -- Increment facility current_load
  IF v_patient.destination_id IS NOT NULL THEN
    UPDATE iodp_sites SET
      current_load = current_load + 1,
      updated_at   = NOW()
    WHERE id = v_patient.destination_id;

    SELECT * INTO v_dst_site FROM iodp_sites WHERE id = v_patient.destination_id;
  END IF;

  INSERT INTO iodp_events (session_id, event_code, severity, actor, description, patient_id)
  VALUES (
    v_patient.session_id,
    'PATIENT_HANDOVER_COMPLETED',
    'info',
    v_uid::text,
    'Handover complete: ' || v_patient.patient_code ||
      CASE WHEN v_dst_site.name IS NOT NULL THEN ' admitted to ' || v_dst_site.name ELSE '' END,
    v_patient.id
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'patient_id', v_patient.id,
    'status',     'admitted'
  ));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'internal', 'message', SQLERRM);
END;
$$;


-- ── 11. Seed: object_registry sample transport for demo ──────
-- Only inserts if no rows exist for that drill (safe re-run via skip)

-- No static seed here — transport objects are drill-specific.
-- Use the UI or ops scripts to seed per drill.
-- Example call pattern documented in docs/facility_transport.md
