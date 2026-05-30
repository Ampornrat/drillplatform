-- ============================================================
-- Seed Data for Demo/Testing
-- ============================================================

-- Default Organization
INSERT INTO organizations (id, name, code, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'องค์กรหลัก', 'ORG-MAIN', 'องค์กรหลักสำหรับระบบ Drill Platform'),
  ('00000000-0000-0000-0000-000000000002', 'หน่วยฝึกซ้อม Alpha', 'ORG-ALPHA', 'หน่วยฝึกซ้อมชุดที่ 1'),
  ('00000000-0000-0000-0000-000000000003', 'หน่วยฝึกซ้อม Beta', 'ORG-BETA', 'หน่วยฝึกซ้อมชุดที่ 2');

-- Default Authority Matrix
INSERT INTO authority_matrix (role, resource, action, allowed) VALUES
  -- Admin: full access
  ('admin', '*', '*', true),
  -- Commander
  ('commander', 'drills', 'create', true),
  ('commander', 'drills', 'read', true),
  ('commander', 'drills', 'update', true),
  ('commander', 'master_registry', 'read', true),
  ('commander', 'master_registry', 'write', true),
  ('commander', 'standards_registry', 'read', true),
  ('commander', 'event_log', 'read', true),
  ('commander', 'event_log', 'write', true),
  ('commander', 'aar_reports', 'create', true),
  ('commander', 'aar_reports', 'read', true),
  ('commander', 'announcements', 'create', true),
  ('commander', 'documents', 'create', true),
  -- Observer
  ('observer', 'drills', 'read', true),
  ('observer', 'event_log', 'read', true),
  ('observer', 'event_log', 'write', true),
  ('observer', 'aar_reports', 'create', true),
  ('observer', 'aar_reports', 'read', true),
  ('observer', 'master_registry', 'read', true),
  ('observer', 'standards_registry', 'read', true),
  -- Participant
  ('participant', 'drills', 'read', true),
  ('participant', 'event_log', 'read', true),
  ('participant', 'standards_registry', 'read', true),
  -- Guest (public)
  ('guest', 'announcements', 'read', true),
  ('guest', 'documents', 'read', true);

-- Default Safety Gate Rules
INSERT INTO safety_gate_rules (name, description, condition_type, action, priority, rule_definition) VALUES
  ('ตรวจสอบสถานะพร้อมรบก่อนเริ่ม', 'ต้องมีผู้เข้าร่วมอย่างน้อย 50% ก่อนเริ่ม drill', 'pre_check', 'block', 10,
   '{"min_participant_ratio": 0.5, "check": "participant_count"}'),
  ('แจ้งเตือนเมื่อมีเหตุการณ์วิกฤต', 'แจ้งเตือนทุกฝ่ายเมื่อมีการบันทึกเหตุการณ์ระดับ critical', 'during', 'notify', 5,
   '{"severity": "critical", "notify_roles": ["admin", "commander"]}'),
  ('รายงาน AAR ก่อนปิด session', 'ต้องสร้าง AAR Report ก่อนปิด drill session', 'post_check', 'warn', 8,
   '{"required": "aar_report", "check": "exists"}');

-- Sample Announcements
INSERT INTO announcements (title, content, is_published, pinned, published_at) VALUES
  ('ยินดีต้อนรับสู่ Drill Platform', 'ระบบ Drill Platform พร้อมให้บริการแล้ว สำหรับการจัดการฝึกซ้อมและปฏิบัติการ', true, true, NOW()),
  ('กำหนดการฝึกซ้อมประจำเดือน', 'ขอเชิญบุคลากรทุกท่านเข้าร่วมการฝึกซ้อมประจำเดือน กรุณาลงทะเบียนล่วงหน้า', true, false, NOW()),
  ('คู่มือการใช้งานระบบพร้อมแล้ว', 'คู่มือการใช้งาน Drill Platform เวอร์ชัน 1.0 พร้อมให้ดาวน์โหลดในส่วนเอกสาร', true, false, NOW());

-- Sample Standards Registry
INSERT INTO standards_registry (title, code, category, version, content) VALUES
  ('มาตรฐานการปฏิบัติการฉุกเฉิน', 'STD-001', 'emergency', '1.0',
   'มาตรฐานการปฏิบัติการฉุกเฉินสำหรับทุกหน่วยงาน กำหนดขั้นตอนและความรับผิดชอบในการรับมือเหตุฉุกเฉิน'),
  ('ระเบียบการฝึกซ้อม', 'STD-002', 'drill', '2.1',
   'ระเบียบและขั้นตอนการจัดการฝึกซ้อม ครอบคลุมการวางแผน การดำเนินการ และการประเมินผล'),
  ('มาตรฐานความปลอดภัย', 'STD-003', 'safety', '1.5',
   'มาตรฐานความปลอดภัยที่ต้องปฏิบัติในทุกกิจกรรม ทั้งการปฏิบัติงานจริงและการฝึกซ้อม');

-- Sample Public Documents
INSERT INTO public_documents (title, description, category, is_public, tags) VALUES
  ('คู่มือการใช้งาน Drill Platform v1.0', 'คู่มือการใช้งานระบบ Drill Platform สำหรับผู้ใช้ทุกระดับ', 'manual', true, ARRAY['คู่มือ', 'ระบบ', 'การใช้งาน']),
  ('แบบฟอร์มรายงานการฝึกซ้อม', 'แบบฟอร์มมาตรฐานสำหรับรายงานผลการฝึกซ้อม', 'form', true, ARRAY['แบบฟอร์ม', 'รายงาน', 'ฝึกซ้อม']),
  ('SOP การจัดการเหตุฉุกเฉิน', 'ขั้นตอนปฏิบัติมาตรฐานสำหรับการจัดการเหตุฉุกเฉิน', 'sop', true, ARRAY['SOP', 'ฉุกเฉิน', 'มาตรฐาน']),
  ('แนวทางการประเมินผล AAR', 'แนวทางและเกณฑ์การประเมินผลหลังการฝึกซ้อม (After Action Review)', 'guide', true, ARRAY['AAR', 'ประเมินผล', 'แนวทาง']);
