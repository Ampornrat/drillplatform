-- Migration 011: Scenario Builder + Drill Dashboard
-- Tables: scenario_templates, scenario_instances, scenario_sites, msel_injects,
--         casualty_archetypes, casualty_instances, exercise_teams, controllers_evaluators
-- View:   v_drill_dashboard_summary

-- ── scenario_templates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_templates (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     TEXT        UNIQUE NOT NULL,
  title                    TEXT        NOT NULL,
  description              TEXT,
  scenario_type            TEXT        NOT NULL DEFAULT 'MCI',
  default_duration_minutes INT         NOT NULL DEFAULT 60,
  default_objectives       TEXT[]      DEFAULT '{}',
  default_sites            JSONB       DEFAULT '[]',
  archetype_distribution   JSONB       DEFAULT '{}',
  meta                     JSONB       DEFAULT '{}',
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── scenario_instances ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_instances (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id              UUID        NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  template_id           UUID        REFERENCES scenario_templates(id) ON DELETE SET NULL,
  title                 TEXT        NOT NULL,
  description           TEXT,
  scenario_type         TEXT        NOT NULL DEFAULT 'MCI',
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','active','completed','cancelled')),
  objectives            TEXT[]      DEFAULT '{}',
  objectives_locked     BOOLEAN     NOT NULL DEFAULT FALSE,
  start_offset_minutes  INT         NOT NULL DEFAULT 0,
  duration_minutes      INT         NOT NULL DEFAULT 60,
  created_by            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── scenario_sites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_sites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID        NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
  site_code   TEXT        NOT NULL,
  site_name   TEXT        NOT NULL,
  site_type   TEXT        NOT NULL DEFAULT 'CCP',
  role        TEXT,
  capacity    INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── msel_injects ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS msel_injects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID        NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
  inject_code     TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  inject_type     TEXT        NOT NULL DEFAULT 'event',
  severity        TEXT        NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  target_team     TEXT,
  expected_action TEXT,
  offset_minutes  INT         NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','pushed','acknowledged','completed','skipped')),
  pushed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── casualty_archetypes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS casualty_archetypes (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT        UNIQUE NOT NULL,
  name               TEXT        NOT NULL,
  triage_level       TEXT        NOT NULL CHECK (triage_level IN ('P1','P2','P3','BLACK')),
  mechanism          TEXT,
  injuries           TEXT[]      DEFAULT '{}',
  expected_treatment TEXT,
  difficulty         TEXT        NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── casualty_instances ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS casualty_instances (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       UUID        NOT NULL REFERENCES scenario_instances(id) ON DELETE CASCADE,
  archetype_id      UUID        REFERENCES casualty_archetypes(id) ON DELETE SET NULL,
  patient_code      TEXT        NOT NULL,
  triage_level      TEXT        CHECK (triage_level IN ('P1','P2','P3','BLACK')),
  name_alias        TEXT,
  age               INT,
  gender            TEXT,
  mechanism         TEXT,
  injuries          TEXT[]      DEFAULT '{}',
  initial_site_code TEXT,
  meta              JSONB       DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── exercise_teams ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_teams (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id     UUID        NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  team_code    TEXT        NOT NULL,
  team_name    TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'response',
  leader_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  member_count INT         NOT NULL DEFAULT 0,
  organization TEXT,
  meta         JSONB       DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drill_id, team_code)
);

-- ── controllers_evaluators ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controllers_evaluators (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID        NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_type TEXT        NOT NULL DEFAULT 'controller'
    CHECK (assignment_type IN ('controller','evaluator','both')),
  assigned_team   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drill_id, user_id)
);

-- ── v_drill_dashboard_summary ──────────────────────────────────────
CREATE OR REPLACE VIEW v_drill_dashboard_summary AS
SELECT
  d.id                            AS drill_id,
  d.title                         AS drill_title,
  d.status                        AS drill_status,
  COUNT(DISTINCT si.id)           AS scenario_count,
  (SELECT si2.id    FROM scenario_instances si2
   WHERE si2.drill_id = d.id AND si2.status = 'active' LIMIT 1) AS active_scenario_id,
  (SELECT si2.title FROM scenario_instances si2
   WHERE si2.drill_id = d.id AND si2.status = 'active' LIMIT 1) AS active_scenario_title,
  COUNT(DISTINCT ci.id)           AS total_casualties,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.triage_level = 'P1')    AS p1_count,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.triage_level = 'P2')    AS p2_count,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.triage_level = 'P3')    AS p3_count,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.triage_level = 'BLACK') AS black_count,
  COUNT(DISTINCT mi.id)           AS inject_total,
  COUNT(DISTINCT mi.id) FILTER (WHERE mi.status IN ('pushed','acknowledged','completed')) AS inject_pushed,
  COUNT(DISTINCT mi.id) FILTER (WHERE mi.status = 'queued')       AS inject_pending,
  COUNT(DISTINCT et.id)           AS team_count,
  (SELECT COUNT(*) FROM drill_participants dp WHERE dp.drill_id = d.id)::INT AS participant_count
FROM drills d
LEFT JOIN scenario_instances si ON si.drill_id = d.id
LEFT JOIN casualty_instances  ci ON ci.scenario_id = si.id
LEFT JOIN msel_injects        mi ON mi.scenario_id = si.id
LEFT JOIN exercise_teams      et ON et.drill_id    = d.id
GROUP BY d.id, d.title, d.status;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE scenario_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_instances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_sites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE msel_injects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE casualty_archetypes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE casualty_instances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE controllers_evaluators  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read scenario_templates"     ON scenario_templates     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read scenario_instances"     ON scenario_instances     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read scenario_sites"         ON scenario_sites         FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read msel_injects"           ON msel_injects           FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read casualty_archetypes"    ON casualty_archetypes    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read casualty_instances"     ON casualty_instances     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read exercise_teams"         ON exercise_teams         FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read controllers_evaluators" ON controllers_evaluators FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "manage scenario_templates"     ON scenario_templates     FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "manage scenario_instances"     ON scenario_instances     FOR ALL TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());
CREATE POLICY "manage scenario_sites"         ON scenario_sites         FOR ALL TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());
CREATE POLICY "manage msel_injects"           ON msel_injects           FOR ALL TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());
CREATE POLICY "manage casualty_archetypes"    ON casualty_archetypes    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "manage casualty_instances"     ON casualty_instances     FOR ALL TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());
CREATE POLICY "manage exercise_teams"         ON exercise_teams         FOR ALL TO authenticated USING (is_commander_or_above()) WITH CHECK (is_commander_or_above());
CREATE POLICY "manage controllers_evaluators" ON controllers_evaluators FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Seed: scenario_templates ───────────────────────────────────────
INSERT INTO scenario_templates (code, title, description, scenario_type, default_duration_minutes, default_objectives, default_sites, archetype_distribution) VALUES
('MCI_ROAD', 'อุบัติเหตุจราจรหมู่', 'อุบัติเหตุรถชนกันหลายคัน ผู้บาดเจ็บ 20–50 ราย', 'MCI', 90,
  ARRAY['ทดสอบระบบ triage ณ จุดเกิดเหตุ','ประเมินการประสานงานส่งต่อผู้ป่วย','วัดเวลาตอบสนองของทีม'],
  '[{"site_code":"CCP01","site_name":"จุดรวมพล A","role":"CCP"},{"site_code":"RVP01","site_name":"จุดนัดพบพยาบาล","role":"RVP"},{"site_code":"HOSP01","site_name":"โรงพยาบาลรับส่ง","role":"Hospital"}]'::jsonb,
  '{"P1":20,"P2":35,"P3":35,"BLACK":10}'::jsonb),

('HAZMAT_CHEM', 'สารเคมีรั่วไหล', 'สารเคมีอุตสาหกรรมรั่วไหล ต้องการกระบวนการ decon', 'HAZMAT', 120,
  ARRAY['ประเมินการตั้ง hot/warm/cold zone','ทดสอบกระบวนการ decontamination','ประเมินการสื่อสารกับประชาชน'],
  '[{"site_code":"HOT01","site_name":"Hot Zone","role":"Exclusion"},{"site_code":"DECON01","site_name":"Decon Station","role":"Decon"},{"site_code":"CCP01","site_name":"CCP","role":"CCP"}]'::jsonb,
  '{"P1":30,"P2":40,"P3":25,"BLACK":5}'::jsonb),

('FLOOD_SAR', 'ค้นหาและกู้ภัยน้ำท่วม', 'น้ำท่วมขังในพื้นที่ชุมชน ต้องอพยพประชาชน', 'SAR', 180,
  ARRAY['ทดสอบการค้นหาและกู้ภัยทางน้ำ','ประเมินการจัดการพื้นที่พักพิง','วัดประสิทธิภาพการอพยพ'],
  '[{"site_code":"SAR01","site_name":"ฐานปฏิบัติการ SAR","role":"Base"},{"site_code":"SHELTER01","site_name":"ศูนย์พักพิง A","role":"Shelter"},{"site_code":"MEDEVAC01","site_name":"จุด MEDEVAC","role":"MEDEVAC"}]'::jsonb,
  '{"P1":15,"P2":25,"P3":50,"BLACK":10}'::jsonb),

('MCI_BOMB', 'ระเบิดในพื้นที่สาธารณะ', 'เหตุระเบิดในสถานที่สาธารณะ ผู้บาดเจ็บจำนวนมาก', 'MCI', 120,
  ARRAY['ทดสอบระบบ mass casualty management','ประเมินการประสานงานหน่วยงานหลายหน่วย','ทดสอบ surge capacity ของโรงพยาบาล'],
  '[{"site_code":"CCP01","site_name":"CCP หลัก","role":"CCP"},{"site_code":"HOSP01","site_name":"โรงพยาบาล A","role":"Hospital"},{"site_code":"HOSP02","site_name":"โรงพยาบาล B","role":"Hospital"}]'::jsonb,
  '{"P1":35,"P2":40,"P3":20,"BLACK":5}'::jsonb),

('USAR_EQ', 'แผ่นดินไหว USAR', 'แผ่นดินไหวทำให้โครงสร้างพังทลาย ต้องการทีม USAR', 'USAR', 240,
  ARRAY['ทดสอบทีม Urban Search and Rescue','ประเมินการแบ่งโซนการค้นหา','ทดสอบการดูแลผู้ประสบภัยใต้ซาก'],
  '[{"site_code":"USAR01","site_name":"พื้นที่ค้นหา A","role":"Search"},{"site_code":"MED01","site_name":"จุดรักษาพยาบาล","role":"Medical"},{"site_code":"STAGING01","site_name":"Staging Area","role":"Staging"}]'::jsonb,
  '{"P1":25,"P2":30,"P3":35,"BLACK":10}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ── Seed: casualty_archetypes ──────────────────────────────────────
INSERT INTO casualty_archetypes (code, name, triage_level, mechanism, injuries, expected_treatment, difficulty) VALUES
('P1_BLAST',       'Blast Injury (P1)',           'P1', 'Blast/Explosion',      ARRAY['penetrating chest wound','tension pneumothorax','blast TBI'],           'Needle decompression, airway, immediate evac',        'hard'),
('P1_CRUSH',       'Crush Syndrome (P1)',          'P1', 'Structural collapse',  ARRAY['crush injury lower limbs','rhabdomyolysis','hypovolemic shock'],         'Fluid resuscitation, tourniquet, IV, rapid evac',     'hard'),
('P1_HAEMO',       'Haemorrhagic Shock (P1)',      'P1', 'Blunt/penetrating',    ARRAY['massive external haemorrhage','haemodynamic instability'],               'Tourniquet, wound packing, IV, blood products',       'medium'),
('P2_FRACTURE',    'Multiple Fractures (P2)',      'P2', 'Road traffic accident',ARRAY['femur fracture','radius fracture','soft tissue injuries'],               'Splinting, analgesia, monitoring, transport',         'medium'),
('P2_BURN',        'Burns 20-40% BSA (P2)',        'P2', 'Fire/chemical',        ARRAY['partial thickness burns 20-40% BSA','inhalation injury suspected'],      'Fluid resuscitation, wound covering, airway monitor', 'medium'),
('P2_SPINAL',      'Suspected Spinal (P2)',        'P2', 'Fall from height',     ARRAY['suspected cervical spine injury','neurological deficit'],                'Spinal immobilisation, careful extrication, CT',      'hard'),
('P3_LACERATION',  'Lacerations (P3)',             'P3', 'Road traffic accident',ARRAY['multiple lacerations','minor contusions'],                               'Wound cleaning, suture, tetanus prophylaxis',         'easy'),
('P3_PSYCH',       'Psychological Trauma (P3)',    'P3', 'Witnessing event',     ARRAY['acute stress reaction','hyperventilation'],                              'Psychological first aid, remove from scene',          'easy'),
('P3_MINOR',       'Minor Injuries (P3)',          'P3', 'Various',              ARRAY['sprains','minor lacerations','bruising'],                                'Basic first aid, analgesia, non-urgent follow-up',    'easy'),
('BLACK_DOA',      'Dead on Arrival',              'BLACK', 'Traumatic arrest',  ARRAY['unsurvivable injuries','confirmed death'],                               'Body management, documentation, family notification', 'easy'),
('BLACK_EXPECT',   'Expectant',                    'BLACK', 'Severe trauma',     ARRAY['unsurvivable CNS injury','major vessel disruption'],                    'Palliative only if resources permit',                 'hard')
ON CONFLICT (code) DO NOTHING;
