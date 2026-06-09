-- Migration 017: Performance indexes + dashboard view
-- Covers all hot query paths identified in review.

-- ────────────────────────────────────────────────────────────────────────────
-- event_log — most frequently scanned table
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_log_drill_time
  ON event_log (drill_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_user_time
  ON event_log (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_severity
  ON event_log (severity, drill_id, timestamp DESC)
  WHERE severity IN ('warning', 'critical');

-- ────────────────────────────────────────────────────────────────────────────
-- notifications — per-user read/unread queries
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_drill
  ON notifications (drill_id, created_at DESC)
  WHERE drill_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- drills — dashboard listing
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_drills_status_mode
  ON drills (status, mode, organization_id);

CREATE INDEX IF NOT EXISTS idx_drills_org_created
  ON drills (organization_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- iodp_patients / iodp_events / iodp_teams
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iodp_patients') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iodp_patients_session_triage
               ON iodp_patients (session_id, triage_level)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iodp_patients_status
               ON iodp_patients (session_id, status)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iodp_events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iodp_events_session_time
               ON iodp_events (session_id, occurred_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iodp_events_severity
               ON iodp_events (session_id, severity)
               WHERE severity IN (''warning'', ''critical'')';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iodp_teams') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iodp_teams_session_status
               ON iodp_teams (session_id, status)';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- dispatch_assignments / evaluation_scores / aar_reports
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dispatch_assignments') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dispatch_drill_status
               ON dispatch_assignments (drill_id, status)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evaluation_scores') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eval_scores_drill
               ON evaluation_scores (drill_id, created_at DESC)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aar_reports') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aar_drill_status
               ON aar_reports (drill_id, status)';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- v_drill_summary — materialised view for dashboard cards
-- Avoids repeated joins on every dashboard load.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_drill_summary AS
SELECT
  d.id,
  d.title,
  d.mode,
  d.status,
  d.organization_id,
  o.name AS organization_name,
  d.start_date,
  d.end_date,
  d.created_at,
  d.updated_at,
  -- event counts
  (SELECT COUNT(*) FROM event_log el WHERE el.drill_id = d.id)                              AS event_count,
  (SELECT COUNT(*) FROM event_log el WHERE el.drill_id = d.id AND el.severity = 'critical') AS critical_event_count,
  -- participant count
  (SELECT COUNT(*) FROM drill_participants dp WHERE dp.drill_id = d.id)                     AS participant_count,
  -- safety gates
  (SELECT COUNT(*) FROM drill_safety_gates sg WHERE sg.drill_id = d.id AND sg.status = 'passed')  AS gates_passed,
  (SELECT COUNT(*) FROM drill_safety_gates sg WHERE sg.drill_id = d.id AND sg.status = 'failed')  AS gates_failed,
  (SELECT COUNT(*) FROM drill_safety_gates sg WHERE sg.drill_id = d.id)                            AS gates_total
FROM drills d
LEFT JOIN organizations o ON o.id = d.organization_id;

COMMENT ON VIEW v_drill_summary IS 'Denormalised drill overview for dashboard — avoids N+1 queries.';
