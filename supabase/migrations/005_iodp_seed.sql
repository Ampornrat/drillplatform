-- ============================================================
-- IODP Seed Data — Bangkok Flood + MCI Scenario
-- Real Bangkok coordinates (Taling Chan district)
-- ============================================================

-- Active session
INSERT INTO iodp_sessions (id, code, title_th, title_en, mode, status, scenario_type, op_period,
  center_lat, center_lng, zoom_level)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'INC-2026-0847',
  'น้ำท่วม + MCI ตลิ่งชัน',
  'Taling Chan Flood + Mass Casualty Incident',
  'operation', 'active', 'Flood + MCI', 'OP-2 · T+02:00–T+05:00',
  13.7775, 100.4582, 14
);

INSERT INTO iodp_sessions (id, code, title_th, title_en, mode, status, scenario_type, op_period,
  center_lat, center_lng, zoom_level)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  'DRL-2026-FLOOD-MCI-001',
  'ซ้อมรบน้ำท่วม + MCI กรุงเทพฯ ปี 2569',
  'Bangkok Flood + MCI Hybrid Full-Scale Drill 2026',
  'drill', 'active', 'Hybrid Full-Scale', 'OP-2 · T+02:00–T+05:00',
  13.7775, 100.4582, 14
);

-- ============================================================
-- SITES — Real Bangkok coordinates
-- ============================================================

-- Siriraj Hospital (ศิริราช) — Role 2 facility, currently on divert
INSERT INTO iodp_sites (session_id, site_code, name, type, status, lat, lng, capacity, current_load)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'HOSP-A', 'ศิริราช (Role 2)', 'facility', 'divert',
   13.7573, 100.4897, 120, 120),

-- Ramathibodi Hospital (รามาธิบดี) — Role 3, accepting
  ('10000000-0000-0000-0000-000000000001', 'HOSP-B', 'รามาธิบดี (Role 3)', 'facility', 'accept',
   13.7680, 100.5224, 200, 87),

-- Vajira Hospital (วชิรพยาบาล) — Role 2, on call
  ('10000000-0000-0000-0000-000000000001', 'HOSP-C', 'วชิร (Role 2)', 'facility', 'call',
   13.7731, 100.5093, 80, 62),

-- Incident SITE-B (primary flood scene, Taling Chan)
  ('10000000-0000-0000-0000-000000000001', 'SITE-B', 'โรงเรียนวัดไก่เตี้ย (ศูนย์ผู้ประสบภัย)', 'incident', 'active',
   13.7692, 100.4441, NULL, NULL),

-- CCP-1 (Casualty Collection Point)
  ('10000000-0000-0000-0000-000000000001', 'CCP-1', 'จุด CCP-1 ตลิ่งชัน', 'ccp', 'active',
   13.7714, 100.4463, 40, 28),

-- LZ-1 (Helicopter Landing Zone)
  ('10000000-0000-0000-0000-000000000001', 'LZ-1', 'LZ-1 สนามกีฬาตลิ่งชัน', 'lz', 'active',
   13.7751, 100.4481, NULL, NULL),

-- UAV-01 (Drone base)
  ('10000000-0000-0000-0000-000000000001', 'UAV-01', 'ฐาน UAV-01', 'uav', 'active',
   13.7730, 100.4510, NULL, NULL),

-- MED-ALPHA team position
  ('10000000-0000-0000-0000-000000000001', 'MED-ALPHA-POS', 'MED-ALPHA ที่ตั้ง', 'team', 'on_scene',
   13.7700, 100.4450, NULL, NULL),

-- BOAT-02 position (water rescue)
  ('10000000-0000-0000-0000-000000000001', 'BOAT-02-POS', 'BOAT-02 ที่ตั้ง', 'team', 'en_route',
   13.7680, 100.4430, NULL, NULL),

-- Command Post
  ('10000000-0000-0000-0000-000000000001', 'CMD-POST', 'ศูนย์บัญชาการ ตลิ่งชัน', 'team', 'active',
   13.7720, 100.4500, NULL, NULL);

-- Mirror sites for drill session
INSERT INTO iodp_sites (session_id, site_code, name, type, status, lat, lng, capacity, current_load)
SELECT '10000000-0000-0000-0000-000000000002', site_code, name, type, status, lat, lng, capacity, current_load
FROM iodp_sites WHERE session_id = '10000000-0000-0000-0000-000000000001';

-- ============================================================
-- TEAMS
-- ============================================================
INSERT INTO iodp_teams (session_id, team_code, name, type, status, personnel, readiness)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'MED-ALPHA-001', 'Medical Alpha', 'medical', 'on_scene', 6, 95),
  ('10000000-0000-0000-0000-000000000001', 'MED-BRAVO-002', 'Medical Bravo', 'medical', 'en_route', 5, 80),
  ('10000000-0000-0000-0000-000000000001', 'BOAT-01', 'เรือพยาบาล 1', 'water_rescue', 'on_scene', 4, 100),
  ('10000000-0000-0000-0000-000000000001', 'BOAT-02', 'เรือพยาบาล 2', 'water_rescue', 'en_route', 4, 100),
  ('10000000-0000-0000-0000-000000000001', 'UAV-TEAM-01', 'ทีม UAV', 'uav', 'active', 3, 90),
  ('10000000-0000-0000-0000-000000000001', 'EOD-01', 'ทีม EOD', 'eod', 'standby', 4, 100),
  ('10000000-0000-0000-0000-000000000001', 'LOG-01', 'ทีม Logistics', 'logistics', 'active', 8, 75),
  ('10000000-0000-0000-0000-000000000001', 'HAZMAT-01', 'ทีม HAZMAT', 'hazmat', 'standby', 5, 85),
  ('10000000-0000-0000-0000-000000000001', 'COMM-01', 'ทีมสื่อสาร', 'comms', 'active', 3, 100);

-- ============================================================
-- PATIENTS (sample — 12 markers matching DEMO_DATA)
-- ============================================================
INSERT INTO iodp_patients (session_id, patient_code, triage_level, status, lat, lng)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-001', 'P1', 'triaged', 13.7698, 100.4439),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-002', 'P1', 'en_route', 13.7705, 100.4455),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-003', 'P2', 'triaged', 13.7688, 100.4448),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-004', 'P2', 'triaged', 13.7695, 100.4462),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-005', 'P3', 'triaged', 13.7710, 100.4435),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-006', 'P3', 'triaged', 13.7682, 100.4470),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-007', 'P1', 'triaged', 13.7715, 100.4444),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-008', 'BLACK', 'deceased', 13.7690, 100.4432),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-009', 'P2', 'triaged', 13.7703, 100.4478),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-010', 'P1', 'admitted', 13.7708, 100.4460),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-011', 'P3', 'triaged', 13.7685, 100.4442),
  ('10000000-0000-0000-0000-000000000001', 'PAT-2026-0847-012', 'P2', 'triaged', 13.7712, 100.4468);

-- ============================================================
-- EVENTS
-- ============================================================
INSERT INTO iodp_events (session_id, event_code, severity, actor, target, description, flagged)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'PATIENT_TRIAGED',   'info',     'MED-ALPHA-001', 'PAT-2026-0847-001', 'คัดแยก P1 สำเร็จ · ส่งต่อ CCP-1', false),
  ('10000000-0000-0000-0000-000000000001', 'TEAM_DEPLOYED',     'info',     'CMD',           'MED-BRAVO-002',     'MED-BRAVO ออกเดินทางจาก HOSP-A', false),
  ('10000000-0000-0000-0000-000000000001', 'GATE_VIOLATION',    'critical', 'MED-BRAVO-002', 'EOD_GATE',          'ทีมเข้า HOT_ZONE ก่อนผ่าน EOD gate', true),
  ('10000000-0000-0000-0000-000000000001', 'FACILITY_DIVERT',   'warning',  'HOSP-A',        'ALL_TEAMS',         'ศิริราช ICU เต็ม เบี่ยงผู้ป่วย P1 ไป HOSP-B', false),
  ('10000000-0000-0000-0000-000000000001', 'UAV_DISPATCH',      'info',     'UAV-TEAM-01',   'CCP-1',             'UAV ส่งเลือด O-neg 12 ยูนิต ETA 14 นาที', false),
  ('10000000-0000-0000-0000-000000000001', 'TEAM_CHECK_IN',     'info',     'BOAT-02',       'SITE-B',            'BOAT-02 ถึงที่เกิดเหตุ สถานะ on_scene', false),
  ('10000000-0000-0000-0000-000000000001', 'BRIDGE_CLOSED',     'warning',  'CMD',           'ALL',               'สะพานสิรินธรปิด เบี่ยงเส้นทางผ่านเรือ', false),
  ('10000000-0000-0000-0000-000000000001', 'IAP_APPROVED',      'info',     'พ.อ. อานันต์', 'IAP-v2.1',          'อนุมัติแผน IAP v2.1 · T+03:58', false),
  ('10000000-0000-0000-0000-000000000001', 'SUPPLY_REQUEST',    'info',     'MED-ALPHA-001', 'LOG-01',            'ขอเลือด O-neg 12 ยูนิต ด่วนมาก', false),
  ('10000000-0000-0000-0000-000000000001', 'SITREP_SENT',       'info',     'CMD',           'EOC-BKK',           'ส่ง SITREP ครั้งที่ 2 ไปยัง EOC กรุงเทพฯ', false);

-- ============================================================
-- SAFETY GATES
-- ============================================================
INSERT INTO iodp_safety_gates (session_id, gate_code, name, status, checked_by)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'EOD_GATE',       'EOD Clearance',          'passed',   'EOD-01'),
  ('10000000-0000-0000-0000-000000000001', 'HAZMAT_GATE',    'HAZMAT Assessment',       'passed',   'HAZMAT-01'),
  ('10000000-0000-0000-0000-000000000001', 'LZ_GATE',        'LZ Survey & Clearance',   'pending',  NULL),
  ('10000000-0000-0000-0000-000000000001', 'HOSPITAL_GATE',  'Receiving Hospital Ready', 'critical', 'HOSP-A'),
  ('10000000-0000-0000-0000-000000000001', 'AUTHORITY_GATE', 'Authority Coordination',  'passed',   'CMD'),
  ('10000000-0000-0000-0000-000000000001', 'ROUTE_GATE',     'Route Safety Check',      'failed',   'CMD');

-- Mirror gates for drill session
INSERT INTO iodp_safety_gates (session_id, gate_code, name, status, checked_by)
SELECT '10000000-0000-0000-0000-000000000002', gate_code, name, status, checked_by
FROM iodp_safety_gates WHERE session_id = '10000000-0000-0000-0000-000000000001';

-- ============================================================
-- INJECTS (MSEL for drill session)
-- ============================================================
INSERT INTO iodp_injects (session_id, inject_code, title, type, status, severity, expected_action)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'INJ-001', 'METHANE รายงานเบื้องต้น', 'scenario', 'pushed',     'info',     'ผู้บัญชาการรับทราบและออกคำสั่ง'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-002', 'สะพานสิรินธร ปิดกะทันหัน', 'complication', 'pushed', 'warning',  'เปิดเส้นทางสำรองผ่านเรือ'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-003', 'ผู้บาดเจ็บ P1 เพิ่ม 5 ราย', 'patient_surge', 'pushed', 'warning', 'เปิดระบบ Surge CCP-1'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-004', 'HAZMAT รั่วไหลจากโกดังใกล้เคียง', 'hazard', 'queued', 'critical', 'อพยพ 200 เมตร · เรียก HAZMAT'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-005', 'Media มาถึงสถานที่', 'media', 'queued', 'info',     'ผู้โฆษกออกแถลงการณ์'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-006', 'EOC ขอ SITREP ด่วน', 'comms', 'queued', 'warning',  'ส่ง SITREP ภายใน 10 นาที'),
  ('10000000-0000-0000-0000-000000000002', 'INJ-007', 'ผู้ป่วย P1 surge 12 ราย SITE-B', 'patient_surge', 'queued', 'critical', 'เปิดระบบ Surge · เรียกกำลังสำรอง');

-- ============================================================
-- AAR FINDINGS
-- ============================================================
INSERT INTO iodp_aar_findings (session_id, finding_code, severity, title, description, category, lms_course, lms_deadline)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'FND-001', 'critical', 'Safety Gate: เข้า HOT_ZONE โดยไม่ผ่าน EOD', 'MED-BRAVO เข้า HOT_ZONE โดยไม่รอ EOD clearance T+01:48', 'safety_gate_violation', 'INC-SAFETY-201', 'T+30 วัน'),
  ('10000000-0000-0000-0000-000000000002', 'FND-002', 'high',     'ส่งผู้ป่วย P1 ไป Role 2 ที่เกินรับ', 'ส่งผู้ป่วยหนัก 3 รายไป ศิริราช ทั้งที่อยู่ใน divert', 'hospital_mismatch', 'MED-TRIAGE-105', 'T+14 วัน'),
  ('10000000-0000-0000-0000-000000000002', 'FND-003', 'medium',   'ความแม่นยำ COP ต่ำกว่าเป้า', 'ข้อมูลทีมภาคสนามใน COP ล่าช้าเฉลี่ย 4 นาที', 'triage_accuracy_low', 'OPS-COP-303', 'T+30 วัน'),
  ('10000000-0000-0000-0000-000000000002', 'FND-004', 'high',     'ขาดแคลนเลือด O-neg ในสต็อก รพ.', 'ศิริราชมีเลือด O-neg เหลือ 3 ยูนิต แต่ไม่ได้แจ้ง LogBoss', 'logistics_stockout', 'LOG-SUPPLY-204', 'T+7 วัน');
