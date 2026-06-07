import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  SimClockRow,
  SimClockStatus,
  InjectDelivery,
  EvaluatorFlag,
  EvaluatorFlagCategory,
  ControlRoomData,
  MselInjectRow,
  ScenarioInstance,
  ScenarioSiteRow,
} from '@/contracts/drill.contract'

// ── Sim clock ─────────────────────────────────────────────────────────────────

export async function getSimClockState(
  scenarioId: string
): Promise<ServiceResult<SimClockRow>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sim_clock_state')
    .select('*')
    .eq('scenario_id', scenarioId)
    .single()

  if (error || !data) {
    // Auto-create on first access
    const { data: created, error: createErr } = await supabase
      .from('sim_clock_state')
      .insert({ scenario_id: scenarioId })
      .select('*')
      .single()
    if (createErr || !created) return fail('database_error', createErr?.message ?? 'clock init failed')
    return ok(mapClock(created))
  }
  return ok(mapClock(data))
}

function mapClock(row: Record<string, unknown>): SimClockRow {
  return {
    id: row.id as string,
    scenario_id: row.scenario_id as string,
    status: row.status as SimClockStatus,
    elapsed_seconds: (row.elapsed_seconds as number) ?? 0,
    speed_multiplier: Number(row.speed_multiplier ?? 1),
    started_at: (row.started_at as string | null) ?? null,
    paused_at: (row.paused_at as string | null) ?? null,
    last_tick_at: (row.last_tick_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    updated_at: row.updated_at as string,
  }
}

// ── Inject deliveries ─────────────────────────────────────────────────────────

export async function getInjectDeliveries(
  scenarioId: string
): Promise<ServiceResult<InjectDelivery[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inject_deliveries')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('delivered_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  if (!data || data.length === 0) return ok([])

  const injectIds = [...new Set(data.map(d => d.inject_id))]
  const { data: injects } = await supabase
    .from('msel_injects')
    .select('id, inject_code, title, severity')
    .in('id', injectIds)

  const injectMap: Record<string, { code: string; title: string; severity: string }> = {}
  ;(injects ?? []).forEach(i => {
    injectMap[i.id] = { code: i.inject_code, title: i.title, severity: i.severity }
  })

  return ok(data.map(d => ({
    id: d.id,
    inject_id: d.inject_id,
    scenario_id: d.scenario_id,
    delivered_to_role: d.delivered_to_role,
    delivered_to_team: d.delivered_to_team,
    delivered_to_user: d.delivered_to_user,
    delivered_at: d.delivered_at,
    acknowledged_at: d.acknowledged_at,
    acknowledged_by: d.acknowledged_by,
    notes: d.notes,
    inject_code: injectMap[d.inject_id]?.code ?? '',
    inject_title: injectMap[d.inject_id]?.title ?? '',
    inject_severity: (injectMap[d.inject_id]?.severity ?? 'info') as InjectDelivery['inject_severity'],
  })))
}

// ── Evaluator flags ───────────────────────────────────────────────────────────

export async function getEvaluatorFlags(
  scenarioId: string
): Promise<ServiceResult<EvaluatorFlag[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluator_flags')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('flagged_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  if (!data || data.length === 0) return ok([])

  const userIds = [...new Set(data.map(d => d.flagged_by))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
  const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))

  return ok(data.map(d => ({
    id: d.id,
    scenario_id: d.scenario_id,
    flagged_by: d.flagged_by,
    flagged_by_name: nameMap[d.flagged_by] ?? null,
    flagged_at: d.flagged_at,
    category: d.category as EvaluatorFlagCategory,
    title: d.title,
    description: d.description,
    severity: d.severity as EvaluatorFlag['severity'],
    elapsed_seconds_at: d.elapsed_seconds_at,
    is_resolved: d.is_resolved,
    resolved_at: d.resolved_at,
  })))
}

// ── Platform events (control room feed) ──────────────────────────────────────

export async function getControlRoomEvents(
  drillId: string,
  limit = 30
): Promise<ServiceResult<ControlRoomData['recentEvents']>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('platform_events')
    .select('id, event_type, title, severity, occurred_at')
    .eq('drill_id', drillId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) return fail('database_error', error.message)
  return ok(data ?? [])
}

// ── Full control room data ────────────────────────────────────────────────────

export async function getControlRoomData(
  scenarioId: string
): Promise<ServiceResult<ControlRoomData>> {
  const supabase = await createClient()

  const { data: scenarioRow, error: scenErr } = await supabase
    .from('scenario_instances')
    .select('*')
    .eq('id', scenarioId)
    .single()
  if (scenErr || !scenarioRow) return fail('not_found', 'ไม่พบ Scenario')

  const drillId = scenarioRow.drill_id

  const [clockResult, injectsResult, deliveriesResult, flagsResult, eventsResult, sitesResult] =
    await Promise.all([
      getSimClockState(scenarioId),
      supabase.from('msel_injects').select('*').eq('scenario_id', scenarioId).order('offset_minutes'),
      getInjectDeliveries(scenarioId),
      getEvaluatorFlags(scenarioId),
      getControlRoomEvents(drillId),
      supabase.from('scenario_sites').select('*').eq('scenario_id', scenarioId),
    ])

  if (!clockResult.ok) return clockResult

  const injects: MselInjectRow[] = (injectsResult.data ?? []).map(m => ({
    id: m.id,
    scenario_id: m.scenario_id,
    inject_code: m.inject_code,
    title: m.title,
    description: m.description,
    inject_type: m.inject_type,
    severity: m.severity as MselInjectRow['severity'],
    target_team: m.target_team,
    expected_action: m.expected_action,
    offset_minutes: m.offset_minutes,
    status: m.status as MselInjectRow['status'],
    pushed_at: m.pushed_at,
  }))

  const sites = (sitesResult.data ?? []) as ScenarioSiteRow[]

  const scenario: ScenarioInstance = {
    id: scenarioRow.id,
    drill_id: scenarioRow.drill_id,
    template_id: scenarioRow.template_id,
    title: scenarioRow.title,
    description: scenarioRow.description,
    scenario_type: scenarioRow.scenario_type,
    status: scenarioRow.status as ScenarioInstance['status'],
    objectives: scenarioRow.objectives ?? [],
    objectives_locked: scenarioRow.objectives_locked,
    start_offset_minutes: scenarioRow.start_offset_minutes,
    duration_minutes: scenarioRow.duration_minutes,
    created_by: scenarioRow.created_by,
    created_at: scenarioRow.created_at,
    sites,
    inject_count: injects.length,
    casualty_count: 0,
  }

  return ok({
    scenario,
    clock: clockResult.data,
    injects,
    deliveries: deliveriesResult.ok ? deliveriesResult.data : [],
    flags: flagsResult.ok ? flagsResult.data : [],
    recentEvents: eventsResult.ok ? eventsResult.data : [],
  })
}

// ── Object resources ──────────────────────────────────────────────────────────

export async function getObjectsForDrill(drillId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('object_registry')
    .select('id, object_code, name, type, status, readiness, owner')
    .or(`drill_id.eq.${drillId},drill_id.is.null`)
    .order('object_code')
  if (error) return fail('database_error', error.message)
  return ok(data ?? [])
}
