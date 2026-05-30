-- ============================================================
-- Drill Platform - Initial Database Schema
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  contact_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'commander', 'observer', 'participant', 'guest')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  avatar_url TEXT,
  phone TEXT,
  position TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER REGISTRY (Personnel, Units, Equipment)
-- ============================================================
CREATE TABLE master_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('personnel', 'unit', 'equipment')),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, organization_id)
);

-- ============================================================
-- STANDARDS REGISTRY (SOPs, Regulations, Manuals)
-- ============================================================
CREATE TABLE standards_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  content TEXT,
  file_url TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,
  review_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTHORITY MATRIX (Role-based permissions)
-- ============================================================
CREATE TABLE authority_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'commander', 'observer', 'participant', 'guest')),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN DEFAULT false,
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- ============================================================
-- SAFETY GATE RULES
-- ============================================================
CREATE TABLE safety_gate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('pre_check', 'during', 'post_check')),
  action TEXT NOT NULL CHECK (action IN ('block', 'warn', 'notify')),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  applies_to_modes TEXT[] DEFAULT ARRAY['operation', 'drill'],
  rule_definition JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRILLS (Sessions for both Operation and Drill modes)
-- ============================================================
CREATE TABLE drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('operation', 'drill')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'active', 'paused', 'completed', 'cancelled')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  scenario JSONB DEFAULT '{}',
  objectives TEXT[],
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  location TEXT,
  max_participants INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRILL PARTICIPANTS
-- ============================================================
CREATE TABLE drill_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_drill TEXT,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'active', 'completed', 'absent')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drill_id, user_id)
);

-- ============================================================
-- EVENT LOG (Real-time event tracking)
-- ============================================================
CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('operation', 'drill')),
  session_id TEXT,
  drill_id UUID REFERENCES drills(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  data JSONB,
  location TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AAR REPORTS (After Action Review)
-- ============================================================
CREATE TABLE aar_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  findings JSONB DEFAULT '[]',
  lessons_learned TEXT,
  recommendations TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PUBLIC DOCUMENTS (Manuals, Guides, Forms)
-- ============================================================
CREATE TABLE public_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('manual', 'sop', 'guide', 'form', 'report', 'other')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  is_public BOOLEAN DEFAULT true,
  tags TEXT[],
  download_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANNOUNCEMENTS (News and Announcements)
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_master_registry_updated_at BEFORE UPDATE ON master_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_standards_registry_updated_at BEFORE UPDATE ON standards_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_safety_gate_rules_updated_at BEFORE UPDATE ON safety_gate_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_drills_updated_at BEFORE UPDATE ON drills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_aar_reports_updated_at BEFORE UPDATE ON aar_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_public_documents_updated_at BEFORE UPDATE ON public_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'participant')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
