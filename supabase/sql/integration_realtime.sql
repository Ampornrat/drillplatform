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
