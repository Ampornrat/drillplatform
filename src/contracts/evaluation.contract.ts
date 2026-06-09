/**
 * evaluation.contract.ts — Evaluation Dashboard module view models.
 *
 * Used by: /drill/evaluation/[scenarioId]
 * DB sources: measurement_rules, evaluation_scores, evaluator_flags,
 *             event_log, exercise_teams, v_team_performance_summary,
 *             v_safety_violations
 */
import type { EventSeverity } from './common.contract'

// ── Measurement rules ─────────────────────────────────────────────────────────

export interface MeasurementRule {
  id: string
  metric_code: string
  metric_name: string
  metric_name_th: string | null
  category: string
  description: string | null
  max_score: number
  pass_threshold: number
  is_safety_critical: boolean
  start_event_type: string | null
  end_event_type: string | null
  time_target_seconds: number | null
}

// ── Evaluation scores ─────────────────────────────────────────────────────────

export interface EvaluationScoreRow {
  id: string
  drill_id: string
  session_id: string | null
  evaluator_id: string | null
  metric_id: string
  metric_name: string
  category: string
  score: number
  max_score: number
  notes: string | null
  evaluated_at: string
}

// ── Evaluator observations (evaluator_flags extended) ─────────────────────────

export interface EvaluatorObservation {
  id: string
  scenario_id: string
  flagged_by: string
  flagged_by_name: string | null
  flagged_at: string
  category: 'observation' | 'strength' | 'weakness' | 'safety_concern' | 'critical_incident'
  title: string
  description: string | null
  severity: EventSeverity
  elapsed_seconds_at: number | null
  is_resolved: boolean
  // Scoring extension fields
  metric_code: string | null
  subject_ref: string | null
  score: number | null
  max_score: number | null
  result: 'pass' | 'gap' | 'fail' | null
  finding: string | null
  evidence_event_ids: string[]
  recommended_action: string | null
  root_cause: string | null
}

// ── Team performance (v_team_performance_summary) ─────────────────────────────

export interface TeamPerformanceSummary {
  drill_id: string
  drill_title: string
  category: string
  avg_score: number
  avg_max_score: number
  avg_pct: number
  metric_count: number
  evaluator_count: number
  min_pct: number | null
  max_pct: number | null
}

// ── Safety violations (v_safety_violations) ───────────────────────────────────

export interface SafetyViolation {
  id: string
  drill_id: string
  rule_id: string
  rule_code: string
  title: string
  description: string | null
  category: string | null
  severity: string
  status: string
  violation_notes: string | null
  passed_at: string | null
  created_at: string
}

// ── Evidence events (event_log rows usable as evidence) ───────────────────────

export interface EvidenceEvent {
  id: string
  drill_id: string | null
  event_type: string
  title: string
  description: string | null
  severity: EventSeverity
  occurred_at: string
  user_id: string | null
  user_name: string | null
}

// ── Computed metric scores (6 core metrics) ───────────────────────────────────

export interface ComputedMetricScore {
  rule: MeasurementRule
  score: number | null
  max_score: number
  pct: number | null
  status: 'pass' | 'fail' | 'gap' | 'unscored'
  lastUpdated: string | null
  evaluatorName: string | null
  autoComputed: boolean
  autoValue: string | null
}

// ── Full evaluation dashboard payload ────────────────────────────────────────

export interface EvaluationDashboardData {
  scenarioId: string
  drillId: string
  drillTitle: string
  rules: MeasurementRule[]
  scores: EvaluationScoreRow[]
  observations: EvaluatorObservation[]
  teamPerformance: TeamPerformanceSummary[]
  violations: SafetyViolation[]
  events: EvidenceEvent[]
  // Computed
  metricScores: ComputedMetricScore[]
  overallPct: number | null
}

// ── Observer event list (kept for backward compat) ───────────────────────────

export interface ObserverNote {
  id: string
  drill_id: string
  observer_id: string
  observerName: string | null
  content: string
  category: string
  timestamp: string
  severity: EventSeverity
}
