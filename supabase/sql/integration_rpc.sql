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
