import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  ScenarioSummary,
  ScenarioTemplate,
  ScenarioInstance,
  ScenarioSiteRow,
  CasualtyArchetype,
  CasualtyInstance,
  MselInjectRow,
  ExerciseTeam,
  ControllerEvaluator,
  DrillDashboardSummary,
} from '@/contracts/drill.contract'
import type { DrillMode } from '@/contracts/common.contract'

export async function getScenarios(
  status?: string
): Promise<ServiceResult<ScenarioSummary[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('iodp_sessions')
    .select('id, code, title_th, mode, status, scenario_type, start_time, end_time')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status as 'planned' | 'active' | 'paused' | 'completed' | 'cancelled')

  const { data, error } = await q
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(s => ({
    id: s.id,
    code: s.code,
    title: s.title_th,
    mode: s.mode as DrillMode,
    status: s.status,
    scenarioType: s.scenario_type,
    startTime: s.start_time,
    endTime: s.end_time,
  })))
}

export async function getScenarioTemplates(): Promise<ServiceResult<ScenarioTemplate[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scenario_templates')
    .select('id, code, title, description, scenario_type, default_duration_minutes, default_objectives, default_sites, archetype_distribution')
    .eq('is_active', true)
    .order('code')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(t => ({
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    scenario_type: t.scenario_type,
    default_duration_minutes: t.default_duration_minutes,
    default_objectives: t.default_objectives ?? [],
    default_sites: (t.default_sites as ScenarioTemplate['default_sites']) ?? [],
    archetype_distribution: (t.archetype_distribution as Record<string, number>) ?? {},
  })))
}

export async function getScenarioInstances(
  drillId: string
): Promise<ServiceResult<ScenarioInstance[]>> {
  const supabase = await createClient()

  const { data: instances, error } = await supabase
    .from('scenario_instances')
    .select('*')
    .eq('drill_id', drillId)
    .order('created_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  if (!instances || instances.length === 0) return ok([])

  const ids = instances.map(i => i.id)
  const [{ data: sites }, { data: injectCounts }, { data: casualtyCounts }] = await Promise.all([
    supabase.from('scenario_sites').select('*').in('scenario_id', ids),
    supabase.from('msel_injects').select('scenario_id').in('scenario_id', ids),
    supabase.from('casualty_instances').select('scenario_id').in('scenario_id', ids),
  ])

  return ok(instances.map(inst => {
    const instSites = (sites ?? []).filter(s => s.scenario_id === inst.id) as ScenarioSiteRow[]
    const inject_count = (injectCounts ?? []).filter(i => i.scenario_id === inst.id).length
    const casualty_count = (casualtyCounts ?? []).filter(c => c.scenario_id === inst.id).length
    return {
      id: inst.id,
      drill_id: inst.drill_id,
      template_id: inst.template_id,
      title: inst.title,
      description: inst.description,
      scenario_type: inst.scenario_type,
      status: inst.status as ScenarioInstance['status'],
      objectives: inst.objectives ?? [],
      objectives_locked: inst.objectives_locked,
      start_offset_minutes: inst.start_offset_minutes,
      duration_minutes: inst.duration_minutes,
      created_by: inst.created_by,
      created_at: inst.created_at,
      sites: instSites,
      inject_count,
      casualty_count,
    }
  }))
}

export async function getScenarioById(
  scenarioId: string
): Promise<ServiceResult<ScenarioInstance>> {
  const supabase = await createClient()

  const { data: inst, error } = await supabase
    .from('scenario_instances')
    .select('*')
    .eq('id', scenarioId)
    .single()
  if (error || !inst) return fail('not_found', 'ไม่พบ Scenario')

  const [{ data: sites }, { data: injects }, { data: casualties }] = await Promise.all([
    supabase.from('scenario_sites').select('*').eq('scenario_id', scenarioId),
    supabase.from('msel_injects').select('id').eq('scenario_id', scenarioId),
    supabase.from('casualty_instances').select('id').eq('scenario_id', scenarioId),
  ])

  return ok({
    id: inst.id,
    drill_id: inst.drill_id,
    template_id: inst.template_id,
    title: inst.title,
    description: inst.description,
    scenario_type: inst.scenario_type,
    status: inst.status as ScenarioInstance['status'],
    objectives: inst.objectives ?? [],
    objectives_locked: inst.objectives_locked,
    start_offset_minutes: inst.start_offset_minutes,
    duration_minutes: inst.duration_minutes,
    created_by: inst.created_by,
    created_at: inst.created_at,
    sites: (sites ?? []) as ScenarioSiteRow[],
    inject_count: (injects ?? []).length,
    casualty_count: (casualties ?? []).length,
  })
}

export async function getCasualtyArchetypes(): Promise<ServiceResult<CasualtyArchetype[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('casualty_archetypes')
    .select('id, code, name, triage_level, mechanism, injuries, expected_treatment, difficulty')
    .eq('is_active', true)
    .order('triage_level')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(a => ({
    id: a.id,
    code: a.code,
    name: a.name,
    triage_level: a.triage_level as CasualtyArchetype['triage_level'],
    mechanism: a.mechanism,
    injuries: a.injuries ?? [],
    expected_treatment: a.expected_treatment,
    difficulty: a.difficulty as CasualtyArchetype['difficulty'],
  })))
}

export async function getCasualtyInstances(
  scenarioId: string
): Promise<ServiceResult<CasualtyInstance[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('casualty_instances')
    .select('id, scenario_id, archetype_id, patient_code, triage_level, name_alias, age, gender, mechanism, injuries, initial_site_code')
    .eq('scenario_id', scenarioId)
    .order('patient_code')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(c => ({
    id: c.id,
    scenario_id: c.scenario_id,
    archetype_id: c.archetype_id,
    patient_code: c.patient_code,
    triage_level: c.triage_level as CasualtyInstance['triage_level'],
    name_alias: c.name_alias,
    age: c.age,
    gender: c.gender,
    mechanism: c.mechanism,
    injuries: c.injuries ?? [],
    initial_site_code: c.initial_site_code,
  })))
}

export async function getMselInjects(
  scenarioId: string
): Promise<ServiceResult<MselInjectRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('msel_injects')
    .select('id, scenario_id, inject_code, title, description, inject_type, severity, target_team, expected_action, offset_minutes, status, pushed_at')
    .eq('scenario_id', scenarioId)
    .order('offset_minutes')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(m => ({
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
  })))
}

export async function getExerciseTeams(
  drillId: string
): Promise<ServiceResult<ExerciseTeam[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exercise_teams')
    .select('id, drill_id, team_code, team_name, role, leader_id, member_count, organization')
    .eq('drill_id', drillId)
    .order('team_code')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(t => ({
    id: t.id,
    drill_id: t.drill_id,
    team_code: t.team_code,
    team_name: t.team_name,
    role: t.role,
    leader_id: t.leader_id,
    member_count: t.member_count,
    organization: t.organization,
  })))
}

export async function getControllersEvaluators(
  drillId: string
): Promise<ServiceResult<ControllerEvaluator[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('controllers_evaluators')
    .select('id, drill_id, user_id, assignment_type, assigned_team, notes')
    .eq('drill_id', drillId)
  if (error) return fail('database_error', error.message)

  const userIds = (data ?? []).map(r => r.user_id)
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }

  const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))

  return ok((data ?? []).map(r => ({
    id: r.id,
    drill_id: r.drill_id,
    user_id: r.user_id,
    user_name: nameMap[r.user_id] ?? null,
    assignment_type: r.assignment_type as ControllerEvaluator['assignment_type'],
    assigned_team: r.assigned_team,
    notes: r.notes,
  })))
}

export async function getDrillDashboardSummary(
  drillId: string
): Promise<ServiceResult<DrillDashboardSummary>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_drill_dashboard_summary')
    .select('*')
    .eq('drill_id', drillId)
    .single()
  if (error || !data) return fail('not_found', 'ไม่พบข้อมูล Dashboard')

  return ok({
    drill_id: data.drill_id,
    drill_title: data.drill_title,
    drill_status: data.drill_status,
    scenario_count: data.scenario_count ?? 0,
    active_scenario_id: data.active_scenario_id,
    active_scenario_title: data.active_scenario_title,
    total_casualties: data.total_casualties ?? 0,
    p1_count: data.p1_count ?? 0,
    p2_count: data.p2_count ?? 0,
    p3_count: data.p3_count ?? 0,
    black_count: data.black_count ?? 0,
    inject_total: data.inject_total ?? 0,
    inject_pushed: data.inject_pushed ?? 0,
    inject_pending: data.inject_pending ?? 0,
    team_count: data.team_count ?? 0,
    participant_count: data.participant_count ?? 0,
  })
}
