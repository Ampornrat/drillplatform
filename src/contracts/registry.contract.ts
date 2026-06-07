/**
 * registry.contract.ts — Master Registry, Standards, Safety Gates, Authority Matrix.
 *
 * Used by: /core/master-registry, /core/standards, /core/safety-gates,
 *          /core/authority-matrix, /admin/users, /admin/organizations
 * DB sources: master_registry, standards_registry, safety_gate_rules,
 *             authority_matrix, profiles, organizations
 */
import type { UserRole, DrillMode, GateStatus } from './common.contract'

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
