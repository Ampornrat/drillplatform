/**
 * drill.contract.ts — Drill/Scenario planner module view models.
 *
 * Used by: /planner/drills, /planner/drills/[id], /planner/drills/new,
 *          (future) /drill/control/[id], /drill/scenario-builder
 * DB sources: drills, organizations, event_log, drill_participants,
 *             safety_gate_rules, drill_safety_gates
 */
import type { DrillMode, DrillStatus, UserRole, EventLogItem } from './common.contract'
import type { SafetyGateView } from './op.contract'

// ── List row ─────────────────────────────────────────────────────────────────

/** Minimal shape for the drills table/list. */
export interface DrillListItem {
  id: string
  title: string
  description: string | null
  mode: DrillMode
  status: DrillStatus
  location: string | null
  organizationName: string | null
  start_date: string | null
  end_date: string | null
  participantCount: number
  maxParticipants: number | null
}

// ── Detail page ──────────────────────────────────────────────────────────────

/** Full drill view — /planner/drills/[id] */
export interface DrillDetail extends DrillListItem {
  description: string | null
  objectives: string[]
  created_at: string
  recentEvents: Pick<EventLogItem, 'id' | 'title' | 'severity' | 'timestamp' | 'event_type'>[]
  safetyGates: SafetyGateView[]
  /** Role of the currently authenticated user */
  userRole: UserRole
  /** True if user is admin or commander */
  canManage: boolean
}

// ── Scenario (IODP session) ──────────────────────────────────────────────────

/** IODP scenario session summary card. Maps to iodp_sessions. */
export interface ScenarioSummary {
  id: string
  code: string
  title: string
  mode: DrillMode
  status: string
  scenarioType: string | null
  startTime: string | null
  endTime: string | null
}

// ── MSEL inject ──────────────────────────────────────────────────────────────

/** Master Scenario Event List inject. Maps to iodp_injects. */
export interface MSELInject {
  id: string
  session_id: string
  inject_code: string
  title: string
  description: string | null
  type: string
  status: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
  severity: 'info' | 'warning' | 'critical'
  target_team: string | null
  expected_action: string | null
  scheduled_at: string | null
  pushed_at: string | null
}

// ── Sim clock ────────────────────────────────────────────────────────────────

/** In-memory simulation clock state (not persisted to a dedicated table). */
export interface SimClockState {
  drill_id: string
  elapsed_seconds: number
  is_running: boolean
  started_at: string | null
  paused_at: string | null
  speed_multiplier: number
}
