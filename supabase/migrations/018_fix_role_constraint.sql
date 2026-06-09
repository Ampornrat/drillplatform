-- Migration 018: Fix profiles.role CHECK constraint to include operational roles
-- Safe to re-run — uses IF NOT EXISTS / DROP IF EXISTS guards.

BEGIN;

-- 1. Drop ALL existing check constraints on profiles.role (try every known name)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_check_role;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS role_check;

-- 2. Add expanded constraint with all 9 roles
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'commander',
    'medical',
    'logistics',
    'controller',
    'evaluator',
    'observer',
    'participant',
    'guest'
  ));

-- 3. Also expand authority_matrix role constraint (needed for seeds)
ALTER TABLE authority_matrix DROP CONSTRAINT IF EXISTS authority_matrix_role_check;
ALTER TABLE authority_matrix
  ADD CONSTRAINT authority_matrix_role_check
  CHECK (role IN (
    'admin', 'commander', 'medical', 'logistics',
    'controller', 'evaluator', 'observer', 'participant', 'guest'
  ));

-- 4. Backfill authority_matrix for new roles (idempotent)
INSERT INTO authority_matrix (role, resource, action, allowed)
VALUES
  ('medical',    'event_log',       'read',  true),
  ('medical',    'event_log',       'write', true),
  ('medical',    'master_registry', 'read',  true),
  ('medical',    'standards',       'read',  true),
  ('logistics',  'event_log',       'read',  true),
  ('logistics',  'event_log',       'write', true),
  ('logistics',  'master_registry', 'read',  true),
  ('controller', 'drills',          'read',  true),
  ('controller', 'drills',          'write', true),
  ('controller', 'safety_gates',    'read',  true),
  ('controller', 'safety_gates',    'write', true),
  ('controller', 'event_log',       'read',  true),
  ('evaluator',  'event_log',       'read',  true),
  ('evaluator',  'aar',             'read',  true),
  ('evaluator',  'aar',             'write', true),
  ('evaluator',  'standards',       'read',  true)
ON CONFLICT DO NOTHING;

-- 5. Update is_manager() helper to include controller
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

COMMIT;
