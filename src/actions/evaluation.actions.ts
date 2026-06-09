'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { validateEvidenceEvents } from '@/services/evaluation.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import { submitMetricScoreSchema, submitObservationFullSchema } from '@/contracts/schemas'
import { createClient } from '@/lib/supabase/server'

// ── Submit aggregate metric score (calls submit_evaluation_score RPC) ─────────

export async function submitMetricScoreAction(
  payload: Record<string, string | number | undefined>
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = submitMetricScoreSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('submit_evaluation_score', {
    payload: {
      drill_id:    d.drill_id,
      session_id:  d.session_id ?? null,
      metric_id:   d.metric_id,
      metric_name: d.metric_name,
      category:    d.category,
      score:       d.score,
      max_score:   d.max_score,
      notes:       d.notes ?? null,
    },
  })

  if (error) return fail('database_error', error.message)

  const res = data as { error?: string; message?: string } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  revalidatePath(`/drill/evaluation`)
  return ok(true as const)
}

// ── Submit evaluator observation (inserts into evaluator_flags) ───────────────

export async function submitObservationAction(
  payload: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role, userId } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = submitObservationFullSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data

  // Validate evidence events exist in the drill
  if (d.evidence_event_ids.length > 0) {
    const supabase = await createClient()
    const { data: scenario } = await supabase
      .from('scenario_instances')
      .select('drill_id')
      .eq('id', d.scenario_id)
      .single()

    if (scenario) {
      const validation = await validateEvidenceEvents(scenario.drill_id, d.evidence_event_ids)
      if (!validation.ok) return validation
    }
  }

  const supabase = await createClient()

  // Permission check: evaluator can only submit for assigned scenarios
  if (role === 'evaluator') {
    const { data: scenario } = await supabase
      .from('scenario_instances')
      .select('drill_id')
      .eq('id', d.scenario_id)
      .single()

    if (scenario) {
      const { data: assignment } = await supabase
        .from('controllers_evaluators')
        .select('id')
        .eq('drill_id', scenario.drill_id)
        .eq('user_id', userId)
        .in('assignment_type', ['evaluator', 'both'])
        .single()

      if (!assignment) {
        return fail('forbidden', 'คุณไม่ได้รับมอบหมายให้ประเมิน Drill นี้')
      }
    }
  }

  const title = `${d.result === 'pass' ? '✓' : d.result === 'gap' ? '△' : '✗'} ${d.metric_code} · ${d.subject_ref}`

  const { data: inserted, error } = await supabase
    .from('evaluator_flags')
    .insert({
      scenario_id:         d.scenario_id,
      flagged_by:          userId,
      category:            'observation',
      title,
      description:         d.finding,
      severity:            d.severity,
      metric_code:         d.metric_code,
      subject_ref:         d.subject_ref,
      score:               d.score ?? null,
      max_score:           5,
      result:              d.result,
      finding:             d.finding,
      evidence_event_ids:  d.evidence_event_ids,
      recommended_action:  d.recommended_action ?? null,
      root_cause:          d.root_cause ?? null,
    })
    .select('id')
    .single()

  if (error || !inserted) return fail('database_error', error?.message ?? 'insert failed')

  revalidatePath(`/drill/evaluation`)
  return ok({ id: inserted.id })
}

// ── Calculate and auto-submit metric scores from event log ────────────────────

export async function autoCalculateMetricsAction(
  drillId: string,
  scenarioId: string
): Promise<ServiceResult<{ computed: number }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role, userId } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const supabase = await createClient()

  type EventRow = { id: string; event_type: string; timestamp: string; severity: string }
  type ViolRow = { id: string }
  type RuleRow = { metric_code: string; metric_name: string; category: string; max_score: number; time_target_seconds: number | null }

  // Fetch events for time-based metrics
  const { data: eventsRaw } = await supabase
    .from('event_log')
    .select('id, event_type, timestamp, severity')
    .eq('drill_id', drillId)
    .order('timestamp', { ascending: true })

  const evts = (eventsRaw ?? []) as EventRow[]
  const incidentCreated = evts.find(e => e.event_type === 'INCIDENT_CREATED')
  const firstTriaged = evts.find(e => e.event_type === 'PATIENT_TRIAGED')
  const iapActivated = evts.find(e => e.event_type === 'IAP_ACTIVATED')

  const violRaw = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: ViolRow[] | null }> } } })
    .from('v_safety_violations')
    .select('id')
    .eq('drill_id', drillId)
  const violations = violRaw.data ?? []

  const rulesRaw = await (supabase as unknown as { from: (t: string) => { select: (s: string) => Promise<{ data: RuleRow[] | null }> } })
    .from('measurement_rules')
    .select('metric_code, metric_name, category, max_score, time_target_seconds')
  const rules = (rulesRaw.data ?? []) as RuleRow[]

  let computed = 0

  for (const rule of rules) {
    let score: number | null = null
    let notes = ''

    if (rule.metric_code === 'P1_FIRST_CONTACT' && incidentCreated && firstTriaged) {
      const elapsed = (new Date(firstTriaged.timestamp).getTime() - new Date(incidentCreated.timestamp).getTime()) / 1000
      const target = rule.time_target_seconds ?? 600
      score = parseFloat((Math.max(0, 1 - elapsed / target) * rule.max_score).toFixed(2))
      notes = `${Math.round(elapsed / 60)} นาที (เป้าหมาย ${Math.round(target / 60)} นาที)`
    }

    if (rule.metric_code === 'IAP_CYCLE_TIME' && incidentCreated && iapActivated) {
      const elapsed = (new Date(iapActivated.timestamp).getTime() - new Date(incidentCreated.timestamp).getTime()) / 1000
      const target = rule.time_target_seconds ?? 3600
      score = parseFloat((Math.max(0, 1 - elapsed / target) * rule.max_score).toFixed(2))
      notes = `${Math.round(elapsed / 60)} นาที (เป้าหมาย ${Math.round(target / 60)} นาที)`
    }

    if (rule.metric_code === 'SAFETY_VIOLATIONS') {
      const count = violations.length
      score = Math.max(0, rule.max_score - count)
      notes = `${count} violations`
    }

    if (score === null) continue

    await supabase.rpc('submit_evaluation_score', {
      payload: {
        drill_id:    drillId,
        session_id:  scenarioId,
        metric_id:   rule.metric_code,
        metric_name: rule.metric_name,
        category:    rule.category,
        score,
        max_score:   rule.max_score,
        notes,
      },
    })
    computed++
  }

  void userId // used in permission check above

  revalidatePath(`/drill/evaluation`)
  return ok({ computed })
}
