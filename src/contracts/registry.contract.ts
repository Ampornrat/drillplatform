/**
 * registry.contract.ts — Master Registry, Standards, Safety Gates, Authority Matrix,
 *                         Object Registry (Passport), Lifecycle, Capabilities.
 *
 * Used by: /core/master-registry, /core/standards, /core/safety-gates,
 *          /core/authority-matrix, /admin/users, /admin/organizations,
 *          /admin/registry, /admin/registry/[objectId]
 * DB sources: master_registry, standards_registry, safety_gate_rules,
 *             authority_matrix, profiles, organizations,
 *             object_registry, lifecycle_events, capability_registry, platform_events
 */
import type { UserRole, DrillMode, GateStatus } from './common.contract'

// ── Object Registry ──────────────────────────────────────────────────────────

export type ObjectType =
  | 'ambulance' | 'boat' | 'HEMS' | 'UAV'
  | 'ALS_unit' | 'BLS_unit'
  | 'personnel' | 'unit' | 'equipment' | 'vehicle' | 'other'

export type ObjectStatus =
  | 'available' | 'en_route' | 'on_scene' | 'standby'
  | 'unavailable' | 'maintenance' | 'demobilized'

/** Full object_registry row — global Object Passport. */
export interface ObjectRegistryItem {
  id: string
  object_code: string
  name: string
  type: ObjectType
  status: ObjectStatus
  readiness: number
  capability: string[]
  limitations: string[]
  owner: string | null
  organization_id: string | null
  home_location: string | null
  drill_id: string | null
  session_id: string | null
  assigned_patient_id: string | null
  lat: number | null
  lng: number | null
  notes: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Paginated list result from the registry. */
export interface ObjectRegistryPage {
  items: ObjectRegistryItem[]
  total: number
  page: number
  pageSize: number
}

/** Filter parameters for the registry list. */
export interface ObjectListFilters {
  search?: string
  type?: ObjectType | ''
  status?: ObjectStatus | ''
  minReadiness?: number
  capability?: string
  page?: number
  pageSize?: number
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export type LifecycleEventType =
  | 'created' | 'status_change' | 'readiness_update'
  | 'capability_assigned' | 'capability_removed'
  | 'standard_attached' | 'maintenance_started' | 'maintenance_ended'
  | 'demobilized' | 'deployed' | 'returned' | 'note_added'

export interface LifecycleEvent {
  id: string
  object_id: string
  event_type: LifecycleEventType | string
  from_value: string | null
  to_value: string | null
  actor_id: string | null
  actor_name: string | null
  notes: string | null
  meta: Record<string, unknown>
  occurred_at: string
}

// ── Capability Registry ──────────────────────────────────────────────────────

export interface CapabilityItem {
  id: string
  code: string
  name: string
  category: string | null
  description: string | null
  is_active: boolean
}

// ── Platform Events ──────────────────────────────────────────────────────────

export interface PlatformEvent {
  id: string
  event_type: string
  source_type: string | null
  source_id: string | null
  severity: 'info' | 'warning' | 'critical' | 'drill'
  title: string
  description: string | null
  actor_id: string | null
  drill_id: string | null
  occurred_at: string
}

// ── Master Registry ──────────────────────────────────────────────────────────

/** Object Passport — master_registry row joined with organization name. */
export interface ObjectPassport {
  id: string
  code: string
  name: string
  type: 'personnel' | 'unit' | 'equipment'
  organizationId: string | null
  organizationName: string | null
  data: Record<string, unknown>
  is_active: boolean
  created_at: string
}

// ── Standards ────────────────────────────────────────────────────────────────

/** standards_registry row (direct mapping — no computed fields needed). */
export interface StandardEntry {
  id: string
  code: string
  title: string
  category: string
  version: string
  effective_date: string | null
  is_active: boolean
  content: string | null
  file_url: string | null
  created_at: string
}

// ── Safety Gates ─────────────────────────────────────────────────────────────

/**
 * Platform-level safety gate rule (safety_gate_rules).
 * Use SafetyGateView from op.contract for per-drill status overlay.
 */
export interface SafetyGateRule {
  id: string
  name: string
  description: string | null
  condition_type: 'pre_check' | 'during' | 'post_check'
  action: 'block' | 'warn' | 'notify'
  priority: number
  is_active: boolean
  applies_to_modes: DrillMode[]
}

/** Per-drill gate row — drill_safety_gates. */
export interface DrillGateRecord {
  id: string
  drill_id: string
  rule_id: string
  status: GateStatus
  checked_by: string | null
  checked_at: string | null
  notes: string | null
}

// ── Authority Matrix ─────────────────────────────────────────────────────────

export interface AuthorityMatrixRow {
  id: string
  role: UserRole
  resource: string
  action: string
  allowed: boolean
  conditions: Record<string, unknown> | null
}

// ── User / Org admin views ───────────────────────────────────────────────────

export interface UserListItem {
  id: string
  full_name: string | null
  role: UserRole
  organizationId: string | null
  organizationName: string | null
  position: string | null
  phone: string | null
  created_at: string
}

export interface OrganizationListItem {
  id: string
  name: string
  code: string
  description: string | null
  contact_email: string | null
  is_active: boolean
  memberCount: number
}
