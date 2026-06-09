'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type {
  EvaluationScoreRow,
  EvaluatorObservation,
  TeamPerformanceSummary,
  SafetyViolation,
  EvidenceEvent,
  MeasurementRule,
  ComputedMetricScore,
} from '@/contracts/evaluation.contract'

export interface EvaluationDashboardState {
  scores: EvaluationScoreRow[]
  observations: EvaluatorObservation[]
  teamPerformance: TeamPerformanceSummary[]
  violations: SafetyViolation[]
  events: EvidenceEvent[]
  metricScores: ComputedMetricScore[]
  overallPct: number | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function computeMetricScores(
  rules: MeasurementRule[],
  scores: EvaluationScoreRow[],
  violations: SafetyViolation[],
  events: EvidenceEvent[]
): { metricScores: ComputedMetricScore[]; overallPct: number | null } {
  const incidentCreated = [...events].reverse().find(e => e.event_type === 'INCIDENT_CREATED')
  const firstTriaged = events.find(e => e.event_type === 'PATIENT_TRIAGED')
  const iapActivated = events.find(e => e.event_type === 'IAP_ACTIVATED')

  const autoScores: Record<string, { score: number; label: string }> = {}

  for (const rule of rules) {
    if (rule.metric_code === 'P1_FIRST_CONTACT' && incidentCreated && firstTriaged) {
      const elapsed = (new Date(firstTriaged.occurred_at).getTime() - new Date(incidentCreated.occurred_at).getTime()) / 1000
      const target = rule.time_target_seconds ?? 600
      const score = parseFloat((Math.max(0, 1 - elapsed / target) * rule.max_score).toFixed(2))
      autoScores[rule.metric_code] = { score, label: `${Math.round(elapsed / 60)} นาที` }
    }
    if (rule.metric_code === 'IAP_CYCLE_TIME' && incidentCreated && iapActivated) {
      const elapsed = (new Date(iapActivated.occurred_at).getTime() - new Date(incidentCreated.occurred_at).getTime()) / 1000
      const target = rule.time_target_seconds ?? 3600
      const score = parseFloat((Math.max(0, 1 - elapsed / target) * rule.max_score).toFixed(2))
      autoScores[rule.metric_code] = { score, label: `${Math.round(elapsed / 60)} นาที` }
    }
    if (rule.metric_code === 'SAFETY_VIOLATIONS') {
      const count = violations.length
      autoScores[rule.metric_code] = {
        score: Math.max(0, rule.max_score - count),
        label: `${count} รายการ`,
      }
    }
  }

  const metricScores: ComputedMetricScore[] = rules.map(rule => {
    const submitted = scores.find(s => s.metric_id === rule.metric_code)
    const auto = autoScores[rule.metric_code]

    if (submitted) {
      const pct = submitted.max_score > 0 ? Math.round((submitted.score / submitted.max_score) * 100) : 0
      const status: ComputedMetricScore['status'] =
        submitted.score >= rule.pass_threshold ? 'pass'
        : submitted.score >= rule.pass_threshold * 0.6 ? 'gap'
        : 'fail'
      return { rule, score: submitted.score, max_score: submitted.max_score, pct, status, lastUpdated: submitted.evaluated_at, evaluatorName: null, autoComputed: false, autoValue: null }
    }

    if (auto) {
      const pct = rule.max_score > 0 ? Math.round((auto.score / rule.max_score) * 100) : 0
      const status: ComputedMetricScore['status'] =
        auto.score >= rule.pass_threshold ? 'pass'
        : auto.score >= rule.pass_threshold * 0.6 ? 'gap'
        : 'fail'
      return { rule, score: auto.score, max_score: rule.max_score, pct, status, lastUpdated: null, evaluatorName: null, autoComputed: true, autoValue: auto.label }
    }

    return { rule, score: null, max_score: rule.max_score, pct: null, status: 'unscored', lastUpdated: null, evaluatorName: null, autoComputed: false, autoValue: null }
  })

  const scorable = metricScores.filter(m => !m.rule.is_safety_critical && m.score !== null)
  const overallPct = scorable.length > 0
    ? Math.round(scorable.reduce((s, m) => s + (m.pct ?? 0), 0) / scorable.length)
    : null

  return { metricScores, overallPct }
}

export function useEvaluationDashboard(
  scenarioId: string,
  drillId: string,
  rules: MeasurementRule[],
  initialScores: EvaluationScoreRow[],
  initialObservations: EvaluatorObservation[],
  initialTeamPerformance: TeamPerformanceSummary[],
  initialViolations: SafetyViolation[],
  initialEvents: EvidenceEvent[]
): EvaluationDashboardState {
  const [scores, setScores] = useState<EvaluationScoreRow[]>(initialScores)
  const [observations, setObservations] = useState<EvaluatorObservation[]>(initialObservations)
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceSummary[]>(initialTeamPerformance)
  const [violations] = useState<SafetyViolation[]>(initialViolations)
  const [events] = useState<EvidenceEvent[]>(initialEvents)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { metricScores, overallPct } = computeMetricScores(rules, scores, violations, events)

  const fetchLatestScores = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('evaluation_scores')
      .select('*')
      .eq('drill_id', drillId)
      .order('evaluated_at', { ascending: false })
    if (!error && data) setScores(data as EvaluationScoreRow[])
  }, [drillId])

  const fetchLatestTeamPerformance = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('v_team_performance_summary')
      .select('*')
      .eq('drill_id', drillId)
    if (data) setTeamPerformance(data as TeamPerformanceSummary[])
  }, [drillId])

  const fetchLatestObservations = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('evaluator_flags')
      .select('*, profiles(full_name)')
      .eq('scenario_id', scenarioId)
      .order('flagged_at', { ascending: false })
    if (data) {
      setObservations(
        (data as Record<string, unknown>[]).map(r => ({
          id: r.id as string,
          scenario_id: r.scenario_id as string,
          flagged_by: r.flagged_by as string,
          flagged_by_name: ((r.profiles as { full_name?: string } | null)?.full_name) ?? null,
          flagged_at: r.flagged_at as string,
          category: r.category as EvaluatorObservation['category'],
          title: r.title as string,
          description: (r.description as string | null) ?? null,
          severity: r.severity as EvaluatorObservation['severity'],
          elapsed_seconds_at: (r.elapsed_seconds_at as number | null) ?? null,
          is_resolved: (r.is_resolved as boolean) ?? false,
          metric_code: (r.metric_code as string | null) ?? null,
          subject_ref: (r.subject_ref as string | null) ?? null,
          score: (r.score as number | null) ?? null,
          max_score: (r.max_score as number | null) ?? null,
          result: (r.result as EvaluatorObservation['result']) ?? null,
          finding: (r.finding as string | null) ?? null,
          evidence_event_ids: (r.evidence_event_ids as string[]) ?? [],
          recommended_action: (r.recommended_action as string | null) ?? null,
          root_cause: (r.root_cause as string | null) ?? null,
        }))
      )
    }
  }, [scenarioId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([fetchLatestScores(), fetchLatestTeamPerformance(), fetchLatestObservations()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [fetchLatestScores, fetchLatestTeamPerformance, fetchLatestObservations])

  // Realtime: evaluation_scores INSERT → refresh scores + team performance
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`eval-dashboard:${drillId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'evaluation_scores',
        filter: `drill_id=eq.${drillId}`,
      }, () => {
        fetchLatestScores()
        fetchLatestTeamPerformance()
        toast.info('คะแนนใหม่ถูกบันทึก')
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluator_flags',
        filter: `scenario_id=eq.${scenarioId}`,
      }, () => {
        fetchLatestObservations()
        toast.info('การสังเกตใหม่ถูกบันทึก')
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [drillId, scenarioId, fetchLatestScores, fetchLatestTeamPerformance, fetchLatestObservations])

  return {
    scores,
    observations,
    teamPerformance,
    violations,
    events,
    metricScores,
    overallPct,
    loading,
    error,
    refresh,
  }
}
