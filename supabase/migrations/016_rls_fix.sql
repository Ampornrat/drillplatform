-- Migration 016: RLS Audit + Fix
-- Idempotent and fully conditional — every table section is guarded by an
-- EXISTS check so missing tables are silently skipped.

-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION user_has_role(VARIADIC p_roles text[])
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(p_roles))
$$;

-- Keep existing helpers in sync
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION is_commander_or_above()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','commander'))
$$;

-- admin + commander + controller  (sim clock, injects, scenario management)
CREATE OR REPLACE FUNCTION is_control_staff()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','commander','controller'))
$$;

-- Alias kept from migration 008
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','commander','controller'))
$$;

-- ── Per-table RLS (all wrapped in conditional DO blocks) ──────────────────────

DO $$
DECLARE
  t text;
BEGIN

  -- ── EVENT LOG ──────────────────────────────────────────────────────────────
  -- Replace open INSERT-for-any-auth with role-gated INSERT.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='event_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "event_log_authenticated_insert" ON event_log';
    EXECUTE 'DROP POLICY IF EXISTS "event_log_role_insert" ON event_log';
    EXECUTE $p$
      CREATE POLICY "event_log_role_insert" ON event_log
        FOR INSERT TO authenticated
        WITH CHECK (
          current_user_role() IN (
            'admin','commander','controller','evaluator',
            'medical','logistics','participant'
          )
        )
    $p$;
  END IF;

  -- ── PLATFORM EVENTS ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='platform_events') THEN
    EXECUTE 'ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "platform_events_write" ON platform_events';
    EXECUTE 'DROP POLICY IF EXISTS "platform_events_ops_insert" ON platform_events';
    EXECUTE $p$
      CREATE POLICY "platform_events_ops_insert" ON platform_events
        FOR INSERT TO authenticated
        WITH CHECK (
          current_user_role() IN (
            'admin','commander','controller','evaluator','medical','logistics'
          )
        )
    $p$;
  END IF;

  -- ── LIFECYCLE EVENTS ───────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='lifecycle_events') THEN
    EXECUTE 'ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "lifecycle_write" ON lifecycle_events';
    EXECUTE 'DROP POLICY IF EXISTS "lifecycle_ops_insert" ON lifecycle_events';
    EXECUTE $p$
      CREATE POLICY "lifecycle_ops_insert" ON lifecycle_events
        FOR INSERT TO authenticated
        WITH CHECK (
          current_user_role() IN ('admin','commander','controller')
        )
    $p$;
  END IF;

  -- ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_own_read"   ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_own_update" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_own_delete" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_insert"     ON notifications';
    EXECUTE $p$
      CREATE POLICY "notifications_own_read" ON notifications
        FOR SELECT TO authenticated
        USING (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "notifications_own_update" ON notifications
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "notifications_own_delete" ON notifications
        FOR DELETE TO authenticated
        USING (user_id = auth.uid())
    $p$;
    -- No INSERT policy = direct client INSERT blocked for all roles.
    -- Triggers and RPCs are SECURITY DEFINER so they bypass RLS.
  END IF;

  -- ── IMPROVEMENT ACTIONS ────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='improvement_actions') THEN
    EXECUTE 'ALTER TABLE improvement_actions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "improvement_actions_read"   ON improvement_actions';
    EXECUTE 'DROP POLICY IF EXISTS "improvement_actions_write"  ON improvement_actions';
    EXECUTE 'DROP POLICY IF EXISTS "improvement_actions_update" ON improvement_actions';
    EXECUTE 'DROP POLICY IF EXISTS "improvement_actions_delete" ON improvement_actions';
    EXECUTE $p$
      CREATE POLICY "improvement_actions_read" ON improvement_actions
        FOR SELECT TO authenticated
        USING (current_user_role() IN ('admin','commander','controller','evaluator','observer'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "improvement_actions_write" ON improvement_actions
        FOR INSERT TO authenticated
        WITH CHECK (current_user_role() IN ('admin','commander','evaluator'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "improvement_actions_update" ON improvement_actions
        FOR UPDATE TO authenticated
        USING  (current_user_role() IN ('admin','commander','evaluator'))
        WITH CHECK (current_user_role() IN ('admin','commander','evaluator'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "improvement_actions_delete" ON improvement_actions
        FOR DELETE TO authenticated
        USING (is_admin())
    $p$;
  END IF;

  -- ── EVALUATION SCORES ──────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='evaluation_scores') THEN
    EXECUTE 'ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "evaluation_scores_read"   ON evaluation_scores';
    EXECUTE 'DROP POLICY IF EXISTS "evaluation_scores_write"  ON evaluation_scores';
    EXECUTE 'DROP POLICY IF EXISTS "evaluation_scores_update" ON evaluation_scores';
    EXECUTE 'DROP POLICY IF EXISTS "evaluation_scores_delete" ON evaluation_scores';
    EXECUTE $p$
      CREATE POLICY "evaluation_scores_read" ON evaluation_scores
        FOR SELECT TO authenticated
        USING (current_user_role() IN ('admin','commander','controller','evaluator','observer'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "evaluation_scores_write" ON evaluation_scores
        FOR INSERT TO authenticated
        WITH CHECK (current_user_role() IN ('admin','evaluator','controller'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "evaluation_scores_update" ON evaluation_scores
        FOR UPDATE TO authenticated
        USING  (current_user_role() IN ('admin','evaluator','controller'))
        WITH CHECK (current_user_role() IN ('admin','evaluator','controller'))
    $p$;
    EXECUTE $p$
      CREATE POLICY "evaluation_scores_delete" ON evaluation_scores
        FOR DELETE TO authenticated
        USING (is_admin())
    $p$;
  END IF;

  -- ── FACILITY STATUS ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='facility_status') THEN
    EXECUTE 'ALTER TABLE facility_status ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "facility_status_read"  ON facility_status';
    EXECUTE 'DROP POLICY IF EXISTS "facility_status_write" ON facility_status';
    EXECUTE $p$
      CREATE POLICY "facility_status_read" ON facility_status
        FOR SELECT TO authenticated
        USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY "facility_status_write" ON facility_status
        FOR ALL TO authenticated
        USING  (current_user_role() IN ('admin','commander','medical','logistics'))
        WITH CHECK (current_user_role() IN ('admin','commander','medical','logistics'))
    $p$;
  END IF;

  -- ── SIM CLOCK STATE ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='sim_clock_state') THEN
    EXECUTE 'ALTER TABLE sim_clock_state ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage sim_clock_state" ON sim_clock_state';
    EXECUTE $p$
      CREATE POLICY "manage sim_clock_state" ON sim_clock_state
        FOR ALL TO authenticated
        USING (is_control_staff())
        WITH CHECK (is_control_staff())
    $p$;
  END IF;

  -- ── INJECT DELIVERIES ──────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='inject_deliveries') THEN
    EXECUTE 'ALTER TABLE inject_deliveries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage inject_deliveries" ON inject_deliveries';
    EXECUTE $p$
      CREATE POLICY "manage inject_deliveries" ON inject_deliveries
        FOR ALL TO authenticated
        USING (is_control_staff())
        WITH CHECK (is_control_staff())
    $p$;
  END IF;

  -- ── MSEL INJECTS ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='msel_injects') THEN
    EXECUTE 'ALTER TABLE msel_injects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage msel_injects" ON msel_injects';
    EXECUTE $p$
      CREATE POLICY "manage msel_injects" ON msel_injects
        FOR ALL TO authenticated
        USING (is_control_staff())
        WITH CHECK (is_control_staff())
    $p$;
  END IF;

  -- ── SCENARIO INSTANCES ─────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='scenario_instances') THEN
    EXECUTE 'ALTER TABLE scenario_instances ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage scenario_instances" ON scenario_instances';
    EXECUTE $p$
      CREATE POLICY "manage scenario_instances" ON scenario_instances
        FOR ALL TO authenticated
        USING (is_control_staff())
        WITH CHECK (is_control_staff())
    $p$;
  END IF;

  -- ── SCENARIO SITES ─────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='scenario_sites') THEN
    EXECUTE 'ALTER TABLE scenario_sites ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage scenario_sites" ON scenario_sites';
    EXECUTE $p$
      CREATE POLICY "manage scenario_sites" ON scenario_sites
        FOR ALL TO authenticated
        USING (is_control_staff())
        WITH CHECK (is_control_staff())
    $p$;
  END IF;

  -- ── CASUALTY INSTANCES ─────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='casualty_instances') THEN
    EXECUTE 'ALTER TABLE casualty_instances ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "manage casualty_instances" ON casualty_instances';
    EXECUTE $p$
      CREATE POLICY "manage casualty_instances" ON casualty_instances
        FOR ALL TO authenticated
        USING (current_user_role() IN ('admin','commander','controller','evaluator'))
        WITH CHECK (current_user_role() IN ('admin','commander','controller','evaluator'))
    $p$;
  END IF;

  -- ── OBJECT REGISTRY ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='object_registry') THEN
    EXECUTE 'ALTER TABLE object_registry ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "object_registry_manager_write" ON object_registry';
    EXECUTE $p$
      CREATE POLICY "object_registry_manager_write" ON object_registry
        FOR ALL TO authenticated
        USING (is_manager())
        WITH CHECK (is_manager())
    $p$;
  END IF;

  -- ── EVALUATOR FLAGS ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='evaluator_flags') THEN
    EXECUTE 'ALTER TABLE evaluator_flags ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "evaluator_flags_write"        ON evaluator_flags';
    EXECUTE 'DROP POLICY IF EXISTS "manage evaluator_flags"       ON evaluator_flags';
    EXECUTE 'DROP POLICY IF EXISTS "evaluator_flags_write_proper" ON evaluator_flags';
    EXECUTE $p$
      CREATE POLICY "evaluator_flags_write" ON evaluator_flags
        FOR ALL TO authenticated
        USING (current_user_role() IN ('admin','commander','controller','evaluator'))
        WITH CHECK (current_user_role() IN ('admin','commander','controller','evaluator'))
    $p$;
  END IF;

  -- ── IAP PLANS ──────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='iap_plans') THEN
    EXECUTE 'ALTER TABLE iap_plans ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "iap_plans_read"  ON iap_plans';
    EXECUTE 'DROP POLICY IF EXISTS "iap_plans_write" ON iap_plans';
    EXECUTE $p$
      CREATE POLICY "iap_plans_read" ON iap_plans
        FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY "iap_plans_write" ON iap_plans
        FOR ALL TO authenticated
        USING (current_user_role() IN ('admin','commander','controller'))
        WITH CHECK (current_user_role() IN ('admin','commander','controller'))
    $p$;
  END IF;

  -- ── DISPATCH ASSIGNMENTS ───────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='dispatch_assignments') THEN
    EXECUTE 'ALTER TABLE dispatch_assignments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "dispatch_assignments_read"  ON dispatch_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "dispatch_assignments_write" ON dispatch_assignments';
    EXECUTE $p$
      CREATE POLICY "dispatch_assignments_read" ON dispatch_assignments
        FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY "dispatch_assignments_write" ON dispatch_assignments
        FOR ALL TO authenticated
        USING (current_user_role() IN ('admin','commander','logistics','controller'))
        WITH CHECK (current_user_role() IN ('admin','commander','logistics','controller'))
    $p$;
  END IF;

  -- ── AAR FINDINGS ───────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='aar_findings') THEN
    EXECUTE 'ALTER TABLE aar_findings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "aar_findings_read"  ON aar_findings';
    EXECUTE 'DROP POLICY IF EXISTS "aar_findings_write" ON aar_findings';
    EXECUTE $p$
      CREATE POLICY "aar_findings_read" ON aar_findings
        FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY "aar_findings_write" ON aar_findings
        FOR ALL TO authenticated
        USING (current_user_role() IN ('admin','commander','evaluator'))
        WITH CHECK (current_user_role() IN ('admin','commander','evaluator'))
    $p$;
  END IF;

END $$;
