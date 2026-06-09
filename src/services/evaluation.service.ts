import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  MeasurementRule,
  EvaluationScoreRow,
  EvaluatorObservation,
  TeamPerformanceSummary,
  SafetyViolation,
  EvidenceEvent,
  ComputedMetricScore,
  EvaluationDashboardData,
} from '@/contracts/evaluation.contract'

// ── Measurement rules ─────────────────────────────────────────────────────────

export async function getMeasurementRules(): Promise<ServiceResult<MeasurementRule[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('measurement_rules')
    .select('*')
    .order('category')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as MeasurementRule[])
}

// ── Evaluation scores ─────────────────────────────────────────────────────────

export async function getEvaluationScores(
  drillId: string
): Promise<ServiceResult<EvaluationScoreRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluation_scores')
    .select('*')
    .eq('drill_id', drillId)
    .order('evaluated_at', { ascending: false })
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as EvaluationScoreRow[])
}

// ── Evaluator observations (evaluator_flags extended) ─────────────────────────

export async function getEvaluatorObservations(
  scenarioId: string
): Promise<ServiceResult<EvaluatorObservation[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluator_flags')
    .select('*, profiles(full_name)')
    .eq('scenario_id', scenarioId)
    .order('flagged_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
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

  return ok(rows)
}

// ── Team performance ──────────────────────────────────────────────────────────

export async function getTeamPerformance(
  drillId: string
): Promise<ServiceResult<TeamPerformanceSummary[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_team_performance_summary')
    .select('*')
    .eq('drill_id', drillId)
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as TeamPerformanceSummary[])
}

// ── Safety violations ─────────────────────────────────────────────────────────

export async function getSafetyViolations(
  drillId: string
): Promise<ServiceResult<SafetyViolation[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_safety_violations')
    .select('*')
    .eq('drill_id', drillId)
    .order('created_at', { ascending: false })
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as SafetyViolation[])
}

// ── Evidence events ───────────────────────────────────────────────────────────

export async function getEvidenceEvents(
  drillId: string
): Promise<ServiceResult<EvidenceEvent[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_log')
    .select('id, drill_id, event_type, title, description, severity, timestamp, user_id, profiles(full_name)')
    .eq('drill_id', drillId)
    .order('timestamp', { ascending: false })
    .limit(200)
  if (error) return fail('database_error', error.message)

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    drill_id: (r.drill_id as string | null) ?? null,
    event_type: r.event_type as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    severity: r.severity as EvidenceEvent['severity'],
    occurred_at: (r.timestamp as string) ?? (r.occurred_at as string),
    user_id: (r.user_id as string | null) ?? null,
    user_name: ((r.profiles as { full_name?: string } | null)?.full_name) ?? null,
  }))

  return ok(rows)
}

// ── Validate evidence event IDs ───────────────────────────────────────────────

export async function validateEvidenceEvents(
  drillId: string,
  eventIds: string[]
): Promise<ServiceResult<string[]>> {
  if (eventIds.length === 0) return ok([])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_log')
    .select('id')
    .eq('drill_id', drillId)
    .in('id', eventIds)
  if (error) return fail('database_error', error.message)
  const found = (data ?? []).map((r: { id: string }) => r.id)
  const invalid = eventIds.filter(id => !found.includes(id))
  if (invalid.length > 0) {
    return fail('validation_error', `Event IDs ไม่พบในระบบ: ${invalid.slice(0, 3).join(', ')}`)
  }
  return ok(found)
}

// ── Compute metric scores from events ─────────────────────────────────────────

function computeAutoScores(
  rules: MeasurementRule[],
  events: EvidenceEvent[],
  violations: SafetyViolation[]
): Record<string, { score: number; label: string }> {
  const auto: Record<string, { score: number; label: string }> = {}

  const incidentCreated = events.find(e => e.event_type === 'INCIDENT_CREATED')
  const firstTriaged = events.findLast(e => e.event_type === 'PATIENT_TRIAGED')
  const iapActivated = events.findLast(e => e.event_type === 'IAP_ACTIVATED')

  for (const rule of rules) {
    if (rule.metric_code === 'P1_FIRST_CONTACT' && incidentCreated && firstTriaged) {
      const startMs = new Date(incidentCreated.occurred_at).getTime()
      const endMs = new Date(firstTriaged.occurred_at).getTime()
      const elapsedSec = Math.max(0, (endMs - startMs) / 1000)
      const target = rule.time_target_seconds ?? 600
      const ratio = Math.max(0, 1 - elapsedSec / target)
      const score = parseFloat((ratio * rule.max_score).toFixed(2))
      const mins = Math.round(elapsedSec / 60)
      auto[rule.metric_code] = { score, label: `${mins} นาที` }
    }

    if (rule.metric_code === 'IAP_CYCLE_TIME' && incidentCreated && iapActivated) {
      const startMs = new Date(incidentCreated.occurred_at).getTime()
      const endMs = new Date(iapActivated.occurred_at).getTime()
      const elapsedSec = Math.max(0, (endMs - startMs) / 1000)
      const target = rule.time_target_seconds ?? 3600
      const ratio = Math.max(0, 1 - elapsedSec / target)
      const score = parseFloat((ratio * rule.max_score).toFixed(2))
      const mins = Math.round(elapsedSec / 60)
      auto[rule.metric_code] = { score, label: `${mins} นาที` }
    }

    if (rule.metric_code === 'SAFETY_VIOLATIONS') {
      const count = violations.length
      const score = count === 0 ? rule.max_score : Math.max(0, rule.max_score - count)
      auto[rule.metric_code] = { score, label: `${count} รายการ` }
    }
  }

  return auto
}

// ── Full dashboard data ───────────────────────────────────────────────────────

export async function getEvaluationDashboard(
  scenarioId: string
): Promise<ServiceResult<EvaluationDashboardData>> {
  const supabase = await createClient()

  // Load scenario
  const { data: scenario, error: scenarioErr } = await supabase
    .from('scenario_instances')
    .select('id, drill_id, title, drills(title)')
    .eq('id', scenarioId)
    .single()

  if (scenarioErr || !scenario) {
    return fail('not_found', 'ไม่พบ Scenario')
  }

  const drillId = scenario.drill_id
  const drillTitle = (scenario.drills as { title?: string } | null)?.title ?? scenario.title

  // Parallel fetch
  const [rulesResult, scoresResult, obsResult, teamResult, violResult, eventsResult] =
    await Promise.all([
      getMeasurementRules(),
      getEvaluationScores(drillId),
      getEvaluatorObservations(scenarioId),
      getTeamPerformance(drillId),
      getSafetyViolations(drillId),
      getEvidenceEvents(drillId),
    ])

  const rules = rulesResult.ok ? rulesResult.data : []
  const scores = scoresResult.ok ? scoresResult.data : []
  const observations = obsResult.ok ? obsResult.data : []
  const teamPerformance = teamResult.ok ? teamResult.data : []
  const violations = violResult.ok ? violResult.data : []
  const events = eventsResult.ok ? eventsResult.data : []

  // Build evaluator name map from scores
  const evaluatorIds = [...new Set(scores.map(s => s.evaluator_id).filter(Boolean) as string[])]
  let evaluatorMap: Record<string, string> = {}
  if (evaluatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', evaluatorIds)
    evaluatorMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? p.id])
    )
  }

  // Auto-compute time-based metrics
  const autoScores = computeAutoScores(rules, events, violations)

  // Build computed metric scores
  const metricScores: ComputedMetricScore[] = rules.map(rule => {
    const submitted = scores.find(s => s.metric_id === rule.metric_code)
    const auto = autoScores[rule.metric_code]

    if (submitted) {
      const pct = submitted.max_score > 0 ? (submitted.score / submitted.max_score) * 100 : 0
      const status: ComputedMetricScore['status'] =
        submitted.score >= rule.pass_threshold ? 'pass'
        : submitted.score >= rule.pass_threshold * 0.6 ? 'gap'
        : 'fail'
      return {
        rule,
        score: submitted.score,
        max_score: submitted.max_score,
        pct: Math.round(pct),
        status,
        lastUpdated: submitted.evaluated_at,
        evaluatorName: submitted.evaluator_id ? (evaluatorMap[submitted.evaluator_id] ?? null) : null,
        autoComputed: false,
        autoValue: null,
      }
    }

    if (auto) {
      const pct = rule.max_score > 0 ? (auto.score / rule.max_score) * 100 : 0
      const status: ComputedMetricScore['status'] =
        auto.score >= rule.pass_threshold ? 'pass'
        : auto.score >= rule.pass_threshold * 0.6 ? 'gap'
        : 'fail'
      return {
        rule,
        score: auto.score,
        max_score: rule.max_score,
        pct: Math.round(pct),
        status,
        lastUpdated: null,
        evaluatorName: null,
        autoComputed: true,
        autoValue: auto.label,
      }
    }

    return {
      rule,
      score: null,
      max_score: rule.max_score,
      pct: null,
      status: 'unscored',
      lastUpdated: null,
      evaluatorName: null,
      autoComputed: false,
      autoValue: null,
    }
  })

  // Overall pct excludes safety_critical
  const scorable = metricScores.filter(m => !m.rule.is_safety_critical && m.score !== null)
  const overallPct = scorable.length > 0
    ? Math.round(scorable.reduce((s, m) => s + (m.pct ?? 0), 0) / scorable.length)
    : null

  return ok({
    scenarioId,
    drillId,
    drillTitle,
    rules,
    scores,
    observations,
    teamPerformance,
    violations,
    events,
    metricScores,
    overallPct,
  })
}
