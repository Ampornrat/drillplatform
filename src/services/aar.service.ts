import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  AARSummary, AARReportView, AARFindingItem,
  AARDetailData, AARFinding, LMSCourse, LMSAssignment, SOPUpdate, ScenarioBankUpdate, AAREventItem,
} from '@/contracts/aar.contract'
import type { DrillMode } from '@/contracts/common.contract'

// ── Legacy list/detail for /core/aar ─────────────────────────────────────────

export async function getAARList(): Promise<ServiceResult<AARSummary[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .select('id, drill_id, title, status, rating, findings, created_at, drills(title)')
    .order('created_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(r => ({
    id: r.id,
    drill_id: r.drill_id,
    drillTitle: (r.drills as unknown as { title: string } | null)?.title ?? r.drill_id,
    title: r.title,
    status: r.status as AARSummary['status'],
    rating: r.rating,
    findingCount: Array.isArray(r.findings) ? r.findings.length : 0,
    created_at: r.created_at,
  })))
}

export async function getAARById(id: string): Promise<ServiceResult<AARReportView>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .select('*, drills(title, mode)')
    .eq('id', id)
    .single()
  if (error || !data) return fail('not_found', 'ไม่พบ AAR Report')

  const drill = data.drills as unknown as { title: string; mode: string } | null

  return ok({
    id: data.id,
    drill_id: data.drill_id,
    drillTitle: drill?.title ?? data.drill_id,
    drillMode: (drill?.mode ?? 'drill') as DrillMode,
    title: data.title,
    summary: data.summary,
    status: data.status as AARReportView['status'],
    rating: data.rating,
    findings: (Array.isArray(data.findings) ? data.findings : []) as unknown as AARFindingItem[],
    created_by: data.created_by ?? '',
    created_at: data.created_at,
  })
}

export async function createAAR(params: {
  drill_id: string
  title: string
  summary?: string | null
  rating?: number | null
  findings?: AARFindingItem[]
  created_by: string
}): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .insert({
      drill_id: params.drill_id,
      title: params.title,
      summary: params.summary ?? null,
      rating: params.rating ?? null,
      findings: (params.findings ?? []) as unknown as import('@/types/database.types').Json,
      status: 'draft',
      created_by: params.created_by,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')
  return ok({ id: data.id })
}

// ── LMS Courses lookup ────────────────────────────────────────────────────────

export async function getLMSCourses(): Promise<ServiceResult<LMSCourse[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lms_courses')
    .select('*')
    .eq('is_active', true)
    .order('course_code')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(c => ({
    id: c.id,
    course_code: c.course_code,
    course_name: c.course_name,
    course_name_th: c.course_name_th,
    finding_type: c.finding_type,
    description: c.description,
    duration_hours: c.duration_hours,
    provider: c.provider,
    is_active: c.is_active,
  })))
}

// ── Full AAR Detail for /drill/aar/[drillId] ──────────────────────────────────

export async function getAARDetail(drillId: string): Promise<ServiceResult<AARDetailData>> {
  const supabase = await createClient()

  // Fetch drill info + aar_report in parallel
  const [drillRes, aarRes, eventsRes, coursesRes] = await Promise.all([
    supabase.from('drills').select('id, title').eq('id', drillId).single(),
    supabase
      .from('aar_reports')
      .select('id, status, rating, created_at')
      .eq('drill_id', drillId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_log')
      .select('id, event_type, title, description, severity, timestamp')
      .eq('drill_id', drillId)
      .order('timestamp', { ascending: true }),
    supabase.from('lms_courses').select('*').eq('is_active', true).order('course_code'),
  ])

  if (drillRes.error || !drillRes.data) return fail('not_found', 'ไม่พบ Drill')

  const aarReport = aarRes.data
  const aarReportId = aarReport?.id ?? null

  // Fetch improvement_actions, lms_assignments, sop_updates, scenario_bank_updates in parallel
  const [actionsRes, assignmentsRes, sopRes, bankRes] = await Promise.all([
    aarReportId
      ? supabase
          .from('improvement_actions')
          .select('*, profiles!improvement_actions_owner_id_fkey(full_name)')
          .eq('aar_report_id', aarReportId)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('lms_assignments')
      .select('*, profiles!lms_assignments_assignee_id_fkey(full_name), lms_courses(course_name)')
      .eq('drill_id', drillId)
      .order('assigned_at', { ascending: false }),
    supabase
      .from('sop_updates')
      .select('*, profiles!sop_updates_proposed_by_fkey(full_name)')
      .eq('drill_id', drillId)
      .order('proposed_at', { ascending: false }),
    supabase
      .from('scenario_bank_updates')
      .select('*, profiles!scenario_bank_updates_submitted_by_fkey(full_name)')
      .eq('drill_id', drillId)
      .order('submitted_at', { ascending: false }),
  ])

  // Build assignee map for fast lookup
  const assignmentsRaw = (assignmentsRes.data ?? []) as Array<Record<string, unknown>>
  const allAssignments: LMSAssignment[] = assignmentsRaw.map(a => ({
    id: a.id as string,
    finding_id: (a.finding_id as string) ?? null,
    course_code: a.course_code as string,
    course_name: ((a.lms_courses as { course_name: string } | null)?.course_name) ?? null,
    assignee_id: (a.assignee_id as string) ?? null,
    assignee_name: ((a.profiles as { full_name: string } | null)?.full_name) ?? null,
    assigned_by: (a.assigned_by as string) ?? null,
    assigned_at: a.assigned_at as string,
    deadline: (a.deadline as string) ?? null,
    status: a.status as LMSAssignment['status'],
    completed_at: (a.completed_at as string) ?? null,
    notes: (a.notes as string) ?? null,
    drill_id: (a.drill_id as string) ?? null,
  }))

  // Build findings with assignments
  const actionsRaw = (actionsRes.data ?? []) as Array<Record<string, unknown>>
  const findings: AARFinding[] = actionsRaw.map(a => ({
    id: a.id as string,
    aar_report_id: (a.aar_report_id as string) ?? null,
    finding_type: (a.finding_type as string) ?? null,
    finding_code: (a.finding_code as string) ?? null,
    category: a.category as AARFinding['category'],
    description: a.description as string,
    recommendation: (a.recommendation as string) ?? null,
    root_cause: (a.root_cause as string) ?? null,
    recommended_track: (a.recommended_track as string) ?? null,
    priority: a.priority as AARFinding['priority'],
    severity: (a.severity as AARFinding['severity']) ?? 'warning',
    status: a.status as AARFinding['status'],
    responsible_party: (a.responsible_party as string) ?? null,
    owner_id: (a.owner_id as string) ?? null,
    owner_name: ((a.profiles as { full_name: string } | null)?.full_name) ?? null,
    due_date: (a.due_date as string) ?? null,
    completed_at: (a.completed_at as string) ?? null,
    lms_course: (a.lms_course as string) ?? null,
    evidence_event_ids: (a.evidence_event_ids as string[]) ?? [],
    created_at: a.created_at as string,
    updated_at: a.updated_at as string,
    assignments: allAssignments.filter(asn => asn.finding_id === (a.id as string)),
  }))

  // SOP updates
  const sopRaw = (sopRes.data ?? []) as Array<Record<string, unknown>>
  const sopUpdates: SOPUpdate[] = sopRaw.map(s => ({
    id: s.id as string,
    drill_id: (s.drill_id as string) ?? null,
    aar_report_id: (s.aar_report_id as string) ?? null,
    finding_id: (s.finding_id as string) ?? null,
    sop_code: (s.sop_code as string) ?? null,
    title: s.title as string,
    description: s.description as string,
    change_type: s.change_type as SOPUpdate['change_type'],
    priority: s.priority as SOPUpdate['priority'],
    status: s.status as SOPUpdate['status'],
    proposed_by: (s.proposed_by as string) ?? null,
    proposer_name: ((s.profiles as { full_name: string } | null)?.full_name) ?? null,
    proposed_at: s.proposed_at as string,
    approved_by: (s.approved_by as string) ?? null,
    approved_at: (s.approved_at as string) ?? null,
    notes: (s.notes as string) ?? null,
  }))

  // Scenario bank updates
  const bankRaw = (bankRes.data ?? []) as Array<Record<string, unknown>>
  const scenarioBankUpdates: ScenarioBankUpdate[] = bankRaw.map(b => ({
    id: b.id as string,
    drill_id: (b.drill_id as string) ?? null,
    aar_report_id: (b.aar_report_id as string) ?? null,
    title: b.title as string,
    summary: (b.summary as string) ?? null,
    lessons_learned: (b.lessons_learned as string) ?? null,
    difficulty_adj: (b.difficulty_adj as ScenarioBankUpdate['difficulty_adj']) ?? null,
    finding_codes: (b.finding_codes as string[]) ?? [],
    submitted_by: (b.submitted_by as string) ?? null,
    submitter_name: ((b.profiles as { full_name: string } | null)?.full_name) ?? null,
    submitted_at: b.submitted_at as string,
    status: b.status as ScenarioBankUpdate['status'],
  }))

  // Events for evidence display
  type EventRow = { id: string; event_type: string; title: string; description: string | null; severity: string; timestamp: string }
  const eventsRaw = (eventsRes.data ?? []) as EventRow[]
  const events: AAREventItem[] = eventsRaw.map(e => ({
    id: e.id,
    event_type: e.event_type,
    title: e.title,
    description: e.description,
    severity: e.severity as AAREventItem['severity'],
    occurred_at: e.timestamp,
  }))

  // LMS courses
  const coursesRaw = (coursesRes.data ?? []) as Array<Record<string, unknown>>
  const lmsCourses: LMSCourse[] = coursesRaw.map(c => ({
    id: c.id as string,
    course_code: c.course_code as string,
    course_name: c.course_name as string,
    course_name_th: (c.course_name_th as string) ?? null,
    finding_type: (c.finding_type as string) ?? null,
    description: (c.description as string) ?? null,
    duration_hours: c.duration_hours as number,
    provider: c.provider as string,
    is_active: c.is_active as boolean,
  }))

  return ok({
    drillId,
    drillTitle: drillRes.data.title,
    aarReportId,
    aarStatus: aarReport?.status ?? null,
    aarRating: aarReport?.rating ?? null,
    findings,
    lmsCourses,
    allAssignments,
    sopUpdates,
    scenarioBankUpdates,
    events,
    generatedAt: aarReport?.created_at ?? null,
  })
}
