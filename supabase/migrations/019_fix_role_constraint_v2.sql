-- Migration 019: Fix profiles.role constraint (no explicit transaction — Supabase-safe)

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop every check constraint on profiles (catches any auto-generated name)
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
  ) LOOP
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;

  -- Add expanded constraint with all 9 roles
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
      'admin', 'commander', 'medical', 'logistics',
      'controller', 'evaluator', 'observer', 'participant', 'guest'
    ));

  RAISE NOTICE 'New profiles_role_check created OK';
END $$;

-- Fix authority_matrix constraint too
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'authority_matrix'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  ) LOOP
    EXECUTE 'ALTER TABLE authority_matrix DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  ALTER TABLE authority_matrix
    ADD CONSTRAINT authority_matrix_role_check
    CHECK (role IN (
      'admin', 'commander', 'medical', 'logistics',
      'controller', 'evaluator', 'observer', 'participant', 'guest'
    ));
END $$;

-- Backfill authority_matrix for new roles
INSERT INTO authority_matrix (role, resource, action, allowed)
VALUES
  ('medical',    'event_log',       'read',  true),
  ('medical',    'event_log',       'write', true),
  ('medical',    'master_registry', 'read',  true),
  ('logistics',  'event_log',       'read',  true),
  ('logistics',  'event_log',       'write', true),
  ('logistics',  'master_registry', 'read',  true),
  ('controller', 'drills',          'read',  true),
  ('controller', 'drills',          'write', true),
  ('controller', 'event_log',       'read',  true),
  ('evaluator',  'event_log',       'read',  true),
  ('evaluator',  'aar',             'read',  true),
  ('evaluator',  'aar',             'write', true)
ON CONFLICT DO NOTHING;

-- Update is_manager() to include controller
CREATE OR REPLACE FUNCTION is_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','commander','controller')
  )
$$;
