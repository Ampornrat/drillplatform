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
