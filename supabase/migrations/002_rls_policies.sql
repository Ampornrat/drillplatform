-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_gate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE aar_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: is commander or above
CREATE OR REPLACE FUNCTION is_commander_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'commander'))
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE POLICY "organizations_public_read" ON organizations FOR SELECT USING (is_active = true);
CREATE POLICY "organizations_admin_all" ON organizations FOR ALL USING (is_admin());

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_own_read" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin_read_all" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (is_admin());

-- ============================================================
-- MASTER REGISTRY
-- ============================================================
CREATE POLICY "master_registry_authenticated_read" ON master_registry
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "master_registry_commander_write" ON master_registry
  FOR INSERT WITH CHECK (is_commander_or_above());
CREATE POLICY "master_registry_commander_update" ON master_registry
  FOR UPDATE USING (is_commander_or_above());
CREATE POLICY "master_registry_admin_delete" ON master_registry
  FOR DELETE USING (is_admin());

-- ============================================================
-- STANDARDS REGISTRY
-- ============================================================
CREATE POLICY "standards_authenticated_read" ON standards_registry
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "standards_commander_write" ON standards_registry
  FOR INSERT WITH CHECK (is_commander_or_above());
CREATE POLICY "standards_commander_update" ON standards_registry
  FOR UPDATE USING (is_commander_or_above());
CREATE POLICY "standards_admin_delete" ON standards_registry
  FOR DELETE USING (is_admin());

-- ============================================================
-- AUTHORITY MATRIX (read-only for all authenticated, admin manages)
-- ============================================================
CREATE POLICY "authority_matrix_authenticated_read" ON authority_matrix
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authority_matrix_admin_all" ON authority_matrix
  FOR ALL USING (is_admin());

-- ============================================================
-- SAFETY GATE RULES
-- ============================================================
CREATE POLICY "safety_gates_authenticated_read" ON safety_gate_rules
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "safety_gates_admin_all" ON safety_gate_rules
  FOR ALL USING (is_admin());

-- ============================================================
-- DRILLS
-- ============================================================
CREATE POLICY "drills_authenticated_read" ON drills
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drills_commander_create" ON drills
  FOR INSERT WITH CHECK (is_commander_or_above());
CREATE POLICY "drills_commander_update" ON drills
  FOR UPDATE USING (is_commander_or_above() AND created_by = auth.uid() OR is_admin());
CREATE POLICY "drills_admin_delete" ON drills
  FOR DELETE USING (is_admin());

-- ============================================================
-- DRILL PARTICIPANTS
-- ============================================================
CREATE POLICY "drill_participants_read" ON drill_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drill_participants_commander_manage" ON drill_participants
  FOR ALL USING (is_commander_or_above());
CREATE POLICY "drill_participants_own_status" ON drill_participants
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- EVENT LOG
-- ============================================================
CREATE POLICY "event_log_authenticated_read" ON event_log
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "event_log_authenticated_insert" ON event_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "event_log_admin_delete" ON event_log
  FOR DELETE USING (is_admin());

-- ============================================================
-- AAR REPORTS
-- ============================================================
CREATE POLICY "aar_authenticated_read" ON aar_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "aar_observer_create" ON aar_reports
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'commander', 'observer'));
CREATE POLICY "aar_author_update" ON aar_reports
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());
CREATE POLICY "aar_admin_delete" ON aar_reports
  FOR DELETE USING (is_admin());

-- ============================================================
-- PUBLIC DOCUMENTS (anyone can read public docs)
-- ============================================================
CREATE POLICY "documents_public_read" ON public_documents
  FOR SELECT USING (is_public = true);
CREATE POLICY "documents_authenticated_read_all" ON public_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "documents_commander_create" ON public_documents
  FOR INSERT WITH CHECK (is_commander_or_above());
CREATE POLICY "documents_commander_update" ON public_documents
  FOR UPDATE USING (is_commander_or_above());
CREATE POLICY "documents_admin_delete" ON public_documents
  FOR DELETE USING (is_admin());

-- ============================================================
-- ANNOUNCEMENTS (published ones are public)
-- ============================================================
CREATE POLICY "announcements_public_read" ON announcements
  FOR SELECT USING (is_published = true);
CREATE POLICY "announcements_authenticated_read_all" ON announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "announcements_commander_create" ON announcements
  FOR INSERT WITH CHECK (is_commander_or_above());
CREATE POLICY "announcements_commander_update" ON announcements
  FOR UPDATE USING (is_commander_or_above());
CREATE POLICY "announcements_admin_delete" ON announcements
  FOR DELETE USING (is_admin());
