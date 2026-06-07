export type UserRole =
  | 'admin'
  | 'commander'
  | 'medical'
  | 'logistics'
  | 'controller'
  | 'evaluator'
  | 'observer'
  | 'participant'
  | 'guest'

export type SystemMode = 'operation' | 'drill'
export type AppMode = 'operation' | 'drill' | 'field' | 'admin'
export type DrillStatus = 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
export type EventSeverity = 'info' | 'warning' | 'critical'
export type DocumentCategory = 'manual' | 'sop' | 'guide' | 'form' | 'report' | 'other'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  organization_id: string | null
  avatar_url: string | null
  phone: string | null
  position: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  code: string
  description: string | null
  logo_url: string | null
  contact_email: string | null
  is_active: boolean
  created_at: string
}

export interface MasterRegistry {
  id: string
  type: 'personnel' | 'unit' | 'equipment'
  name: string
  code: string
  organization_id: string | null
  data: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StandardsRegistry {
  id: string
  title: string
  code: string
  category: string
  version: string
  content: string | null
  file_url: string | null
  is_active: boolean
  effective_date: string | null
  created_by: string | null
  created_at: string
}

export interface AuthorityMatrix {
  id: string
  role: UserRole
  resource: string
  action: string
  allowed: boolean
  conditions: Record<string, unknown> | null
  created_at: string
}

export interface SafetyGateRule {
  id: string
  name: string
  description: string | null
  condition_type: 'pre_check' | 'during' | 'post_check'
  action: 'block' | 'warn' | 'notify'
  priority: number
  is_active: boolean
  applies_to_modes: SystemMode[]
  created_at: string
}

export interface EventLog {
  id: string
  event_type: string
  mode: SystemMode
  session_id: string | null
  drill_id: string | null
  user_id: string | null
  severity: EventSeverity
  title: string
  description: string | null
  data: Record<string, unknown> | null
  timestamp: string
}

export interface Drill {
  id: string
  title: string
  description: string | null
  mode: SystemMode
  status: DrillStatus
  organization_id: string | null
  scenario: Record<string, unknown> | null
  objectives: string[] | null
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AARReport {
  id: string
  drill_id: string
  title: string
  summary: string | null
  findings: AARFinding[]
  lessons_learned: string | null
  recommendations: string | null
  rating: number | null
  created_by: string | null
  created_at: string
}

export interface AARFinding {
  category: 'strength' | 'improvement' | 'critical'
  description: string
  recommendation?: string
}

export interface PublicDocument {
  id: string
  title: string
  description: string | null
  category: DocumentCategory
  file_url: string | null
  file_size: number | null
  is_public: boolean
  tags: string[] | null
  download_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  is_published: boolean
  pinned: boolean
  published_at: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

/** Serialisable app context passed to client providers and components. */
export interface AppCtx {
  userId: string
  role: UserRole
  userName: string | null
  organizationId: string | null
  canManage: boolean
  isAdmin: boolean
  activeIncidentId: string | null
  activeScenarioId: string | null
  activeIncidentTitle: string | null
  activeIncidentMode: SystemMode | null
  activeScenarioCode: string | null
}
