-- Migration 010: Expand object_registry → global Object Passport + Lifecycle
-- Adds: lifecycle_events, capability_registry, platform_events
-- Extends: object_registry with owner/org/home_location + broader type/status

-- ── Extend object_registry ──────────────────────────────────────
ALTER TABLE object_registry
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner           TEXT,
  ADD COLUMN IF NOT EXISTS home_location   TEXT,
  ADD COLUMN IF NOT EXISTS limitations     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes           TEXT;

-- Drop auto-generated CHECK constraints so we can expand them
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name = 'object_registry'
      AND tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      AND (cc.check_clause ILIKE '%type%' OR cc.check_clause ILIKE '%status%')
  ) LOOP
    EXECUTE format('ALTER TABLE object_registry DROP CONSTRAINT IF EXISTS %I', rec.constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE object_registry
  ADD CONSTRAINT object_registry_type_check CHECK (
    type IN ('ambulance','boat','HEMS','UAV','ALS_unit','BLS_unit',
             'personnel','unit','equipment','vehicle','other')
  ),
  ADD CONSTRAINT object_registry_status_check CHECK (
    status IN ('available','en_route','on_scene','standby',
               'unavailable','maintenance','demobilized')
  );

-- Allow global objects (drill_id NULL without session_id)
-- No change needed — drill_id was already nullable.

-- ── capability_registry ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capability_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE capability_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY capability_read  ON capability_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY capability_admin ON capability_registry FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','commander')));

INSERT INTO capability_registry (code, name, category, description) VALUES
  ('ALS',        'Advanced Life Support',                         'medical', 'ALS paramedic capability'),
  ('BLS',        'Basic Life Support',                            'medical', 'BLS provider capability'),
  ('HEMS',       'Helicopter Emergency Medical Service',           'aerial',  'HEMS crew capability'),
  ('UAV_ISR',    'UAV ISR',                                       'aerial',  'Intelligence, Surveillance & Reconnaissance'),
  ('UAV_MED',    'UAV Medical Delivery',                          'aerial',  'Drone delivery of medical supplies'),
  ('WATER',      'Water Rescue',                                  'rescue',  'Swiftwater / marine rescue'),
  ('HAZMAT',     'Hazardous Materials Response',                  'hazmat',  'HAZMAT level A-C'),
  ('COMMS',      'Communications & Radio',                        'support', 'Tactical radio operations'),
  ('RECON',      'Reconnaissance',                                'support', 'Ground or aerial recon'),
  ('TRANSPORT',  'Patient Transport',                             'medical', 'Ambulatory/supine transport'),
  ('COMMAND',    'Command & Control',                             'command', 'ICS command capability'),
  ('LOGISTICS',  'Logistics Support',                             'support', 'Supply chain & resourcing'),
  ('EXTRICATION','Extrication',                                   'rescue',  'Vehicle / structural entrapment'),
  ('SWIFT_WATER','Swift Water Rescue',                            'rescue',  'Class III+ whitewater rescue')
ON CONFLICT (code) DO NOTHING;

-- ── lifecycle_events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifecycle_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id   UUID        NOT NULL REFERENCES object_registry(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  TEXT,
  notes       TEXT,
  meta        JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lifecycle_events_object_idx ON lifecycle_events(object_id);
CREATE INDEX IF NOT EXISTS lifecycle_events_time_idx   ON lifecycle_events(occurred_at DESC);

ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY lifecycle_read  ON lifecycle_events FOR SELECT TO authenticated USING (true);
CREATE POLICY lifecycle_write ON lifecycle_events FOR INSERT TO authenticated WITH CHECK (true);

-- ── platform_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  source_type TEXT,
  source_id   UUID,
  severity    TEXT        NOT NULL DEFAULT 'info'
                          CHECK (severity IN ('info','warning','critical','drill')),
  title       TEXT        NOT NULL,
  description TEXT,
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  drill_id    UUID        REFERENCES drills(id) ON DELETE SET NULL,
  meta        JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_events_source_idx  ON platform_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS platform_events_drill_idx   ON platform_events(drill_id);
CREATE INDEX IF NOT EXISTS platform_events_time_idx    ON platform_events(occurred_at DESC);

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_events_read  ON platform_events FOR SELECT TO authenticated USING (true);
CREATE POLICY platform_events_write ON platform_events FOR INSERT TO authenticated WITH CHECK (true);
