/**
 * evaluation.contract.ts — Observer / Evaluation module view models.
 *
 * Used by: /observer, IODP EvaluationDashboard view
 * DB sources: event_log, drill_participants, iodp_events, iodp_teams
 */
import type { EventSeverity } from './common.contract'

// ── Observer event list ───────────────────────────────────────────────────────

/** Single annotated observation. Maps to event_log row (event_type = 'observation'). */
export interface ObserverNote {
  id: string
  drill_id: string
  observer_id: string
  observerName: string | null
  content: string
  /** event_type value from event_log */
  category: string
  timestamp: string
  severity: EventSeverity
}

// ── Evaluation scoring ────────────────────────────────────────────────────────

/** One scored metric. No dedicated table yet — stored in iodp_events or future evaluation table. */
export interface EvaluationMetric {
  id: string
  drill_id: string
  metric_name: string
  category: string
  target_value: number | null
  actual_value: number | null
  score: number | null
  max_score: number
  evaluator_id: string | null
  evaluated_at: string | null
  notes: string | null
}

/** Aggregated score for one category. */
export interface ScoreEntry {
  category: string
  score: number
  max_score: number
  /** 0–100 */
  percentage: number
  notes: string | null
}

/** Full evaluation result for one drill / session. */
export interface EvaluationResult {
  drill_id: string
  drillTitle: string
  overall_score: number
  max_score: number
  percentage: number
  categories: ScoreEntry[]
  metrics: EvaluationMetric[]
  evaluator_id: string | null
  evaluated_at: string | null
}
