-- Migration 015: Notifications + Realtime Event Bus
-- Adds: action_code, scenario_id to notifications
-- Adds: _notify_all_in_role helper
-- Adds: _auto_notify_on_event trigger on event_log
-- Adds: mark_notification_read, mark_all_notifications_read RPCs
-- Realtime: notifications publication

-- ── Expand notifications ──────────────────────────────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_code TEXT,
  ADD COLUMN IF NOT EXISTS scenario_id UUID;

CREATE INDEX IF NOT EXISTS notifications_action_code_idx
  ON notifications(action_code)
  WHERE action_code IS NOT NULL;

-- ── _notify_all_in_role: fan out to all active users with given roles ─────────

CREATE OR REPLACE FUNCTION _notify_all_in_role(
  p_drill_id   uuid,
  p_roles      text[],
  p_type       text,
  p_title      text,
  p_body       text DEFAULT NULL,
  p_link       text DEFAULT NULL,
  p_action_code text DEFAULT NULL,
  p_scenario_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, drill_id, action_code, scenario_id)
  SELECT
    p.id,
    p_type,
    p_title,
    p_body,
    p_link,
    p_drill_id,
    p_action_code,
    p_scenario_id
  FROM profiles p
  WHERE p.role = ANY(p_roles)
    AND p.is_active = true
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; -- never fail caller
END;
$$;

-- ── _auto_notify_on_event: trigger function for event_log ────────────────────

CREATE OR REPLACE FUNCTION _auto_notify_on_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_roles       text[];
  v_notif_type  text;
  v_link        text;
  v_code        text;
BEGIN
  v_code := UPPER(NEW.event_type);

  -- Build link based on drill_id
  IF NEW.drill_id IS NOT NULL THEN
    v_link := '/drill/' || NEW.drill_id || '/dashboard';
  END IF;

  CASE v_code
    WHEN 'INCIDENT_CREATED' THEN
      v_roles := ARRAY['admin','commander','medical','logistics','controller'];
      v_notif_type := 'warning';
    WHEN 'IAP_CREATED', 'IAP_ACTIVATED', 'IAP_APPROVED' THEN
      v_roles := ARRAY['admin','commander','controller','evaluator'];
      v_notif_type := 'info';
    WHEN 'DISPATCH_ASSIGNED' THEN
      v_roles := ARRAY['commander','medical','logistics'];
      v_notif_type := 'info';
    WHEN 'TEAM_ON_SCENE' THEN
      v_roles := ARRAY['commander','controller','evaluator'];
      v_notif_type := 'info';
    WHEN 'PATIENT_TRIAGED' THEN
      v_roles := ARRAY['medical','commander'];
      v_notif_type := 'info';
    WHEN 'FACILITY_DIVERSION' THEN
      v_roles := ARRAY['medical','commander','logistics'];
      v_notif_type := 'critical';
      v_link := '/drill/' || COALESCE(NEW.drill_id::text, '') || '/dashboard';
    WHEN 'SAFETY_GATE_VIOLATION' THEN
      v_roles := ARRAY['admin','commander','controller','evaluator'];
      v_notif_type := 'critical';
    WHEN 'INJECT_PUSHED' THEN
      v_roles := ARRAY['participant','medical','logistics','commander','controller'];
      v_notif_type := 'warning';
    WHEN 'EXERCISE_PAUSED' THEN
      v_roles := ARRAY['admin','commander','controller','evaluator','medical','logistics','participant'];
      v_notif_type := 'warning';
    WHEN 'EVALUATOR_FLAGGED' THEN
      v_roles := ARRAY['commander','evaluator','controller'];
      v_notif_type := 'warning';
    WHEN 'IMPROVEMENT_ACTION_CREATED' THEN
      v_roles := ARRAY['evaluator','commander'];
      v_notif_type := 'info';
    WHEN 'LMS_ASSIGNMENT_CREATED' THEN
      v_roles := ARRAY['evaluator','commander'];
      v_notif_type := 'info';
    ELSE
      RETURN NEW; -- not an auto-notify event type
  END CASE;

  PERFORM _notify_all_in_role(
    NEW.drill_id,
    v_roles,
    v_notif_type,
    NEW.title,
    NEW.description,
    v_link,
    v_code,
    CASE
      WHEN NEW.session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN NEW.session_id::uuid
      ELSE NULL
    END
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the parent transaction
END;
$$;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_auto_notify_on_event ON event_log;
CREATE TRIGGER trg_auto_notify_on_event
  AFTER INSERT ON event_log
  FOR EACH ROW
  EXECUTE FUNCTION _auto_notify_on_event();

-- ── mark_notification_read RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_notification_read(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized','message','ต้องเข้าสู่ระบบก่อน');
  END IF;

  UPDATE notifications
  SET read = true
  WHERE id = (payload->>'notification_id')::uuid
    AND user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found','message','ไม่พบ Notification');
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error','internal','message',SQLERRM);
END;
$$;

-- ── mark_all_notifications_read RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_all_notifications_read(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_drill   uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized','message','ต้องเข้าสู่ระบบก่อน');
  END IF;

  v_drill := (payload->>'drill_id')::uuid;

  IF v_drill IS NOT NULL THEN
    UPDATE notifications
    SET read = true
    WHERE user_id = v_uid AND read = false AND drill_id = v_drill;
  ELSE
    UPDATE notifications
    SET read = true
    WHERE user_id = v_uid AND read = false;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('updated', v_updated));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error','internal','message',SQLERRM);
END;
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications')
    THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications';
    END IF;
  END IF;
END $$;
