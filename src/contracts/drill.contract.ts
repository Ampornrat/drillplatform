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

// ── Scenario templates ────────────────────────────────────────────────────────

export interface ScenarioTemplate {
  id: string
  code: string
  title: string
  description: string | null
  scenario_type: string
  default_duration_minutes: number
  default_objectives: string[]
  default_sites: Array<{ site_code: string; site_name: string; role: string }>
  archetype_distribution: Record<string, number>
}

// ── Scenario instances ────────────────────────────────────────────────────────

export interface ScenarioSiteRow {
  id: string
  scenario_id: string
  site_code: string
  site_name: string
  site_type: string
  role: string | null
  capacity: number | null
}

export interface ScenarioInstance {
  id: string
  drill_id: string
  template_id: string | null
  title: string
  description: string | null
  scenario_type: string
  status: 'draft' | 'ready' | 'active' | 'completed' | 'cancelled'
  objectives: string[]
  objectives_locked: boolean
  start_offset_minutes: number
  duration_minutes: number
  created_by: string | null
  created_at: string
  sites: ScenarioSiteRow[]
  inject_count: number
  casualty_count: number
}

// ── Casualties ────────────────────────────────────────────────────────────────

export interface CasualtyArchetype {
  id: string
  code: string
  name: string
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK'
  mechanism: string | null
  injuries: string[]
  expected_treatment: string | null
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface CasualtyInstance {
  id: string
  scenario_id: string
  archetype_id: string | null
  patient_code: string
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
  name_alias: string | null
  age: number | null
  gender: string | null
  mechanism: string | null
  injuries: string[]
  initial_site_code: string | null
}

// ── MSEL injects (scenario-level) ────────────────────────────────────────────

export interface MselInjectRow {
  id: string
  scenario_id: string
  inject_code: string
  title: string
  description: string | null
  inject_type: string
  severity: 'info' | 'warning' | 'critical'
  target_team: string | null
  expected_action: string | null
  offset_minutes: number
  status: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
  pushed_at: string | null
}

// ── Exercise teams ────────────────────────────────────────────────────────────

export interface ExerciseTeam {
  id: string
  drill_id: string
  team_code: string
  team_name: string
  role: string
  leader_id: string | null
  member_count: number
  organization: string | null
}

// ── Controllers / Evaluators ──────────────────────────────────────────────────

export interface ControllerEvaluator {
  id: string
  drill_id: string
  user_id: string
  user_name: string | null
  assignment_type: 'controller' | 'evaluator' | 'both'
  assigned_team: string | null
  notes: string | null
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export interface DrillDashboardSummary {
  drill_id: string
  drill_title: string
  drill_status: string
  scenario_count: number
  active_scenario_id: string | null
  active_scenario_title: string | null
  total_casualties: number
  p1_count: number
  p2_count: number
  p3_count: number
  black_count: number
  inject_total: number
  inject_pushed: number
  inject_pending: number
  team_count: number
  participant_count: number
}
