-- Migration 008: Expand profiles.role to support new operational roles
-- New roles: medical, logistics, controller, evaluator
-- Existing roles unchanged: admin, commander, observer, participant, guest

-- Drop old check constraint (may vary by Supabase version — try both forms)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;

-- Add expanded constraint
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

-- Update RLS helper function to recognise new management roles
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

-- Update authority_matrix with permissions for new roles
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
