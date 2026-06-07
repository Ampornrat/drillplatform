import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { DrillListItem, DrillDetail } from '@/contracts/drill.contract'
import type { DrillMode, DrillStatus } from '@/contracts/common.contract'
import { getDrillCOPData } from '@/lib/supabase/queries'

// ── List ─────────────────────────────────────────────────────────────────────

export async function getDrillsList(filters?: {
  mode?: DrillMode
  status?: DrillStatus | DrillStatus[]
  limit?: number
}): Promise<ServiceResult<DrillListItem[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('drills')
    .select('id, title, description, mode, status, location, start_date, end_date, max_participants, organization_id, organizations(name)')
    .order('created_at', { ascending: false })

  if (filters?.mode) q = q.eq('mode', filters.mode)
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    q = q.in('status', statuses)
  }
  if (filters?.limit) q = q.limit(filters.limit)

  const { data, error } = await q
  if (error) return fail('database_error', error.message)

  const items: DrillListItem[] = (data ?? []).map(d => ({
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    mode: d.mode as DrillMode,
    status: d.status as DrillStatus,
    location: d.location,
    organizationName: (d.organizations as { name: string } | null)?.name ?? null,
    start_date: d.start_date,
    end_date: d.end_date,
    participantCount: 0,
    maxParticipants: d.max_participants,
  }))
  return ok(items)
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getDrillDetail(
  drillId: string,
  userId: string,
  userRole: string
): Promise<ServiceResult<DrillDetail>> {
  const copData = await getDrillCOPData(drillId)
  if (!copData) return fail('not_found', 'ไม่พบ Drill')

  const { drill, events, participants, gates } = copData

  const detail: DrillDetail = {
    id: drill.id,
    title: drill.title,
    mode: drill.mode as DrillMode,
    status: drill.status as DrillStatus,
    location: drill.location ?? null,
    organizationName: (drill.organizations as { name: string } | null)?.name ?? null,
    start_date: drill.start_date ?? null,
    end_date: drill.end_date ?? null,
    description: drill.description ?? null,
    objectives: (drill.objectives as string[] | null) ?? [],
    participantCount: participants.length,
    maxParticipants: drill.max_participants ?? null,
    created_at: drill.created_at,
    recentEvents: events.map(e => ({
      id: e.id,
      title: e.title,
      severity: e.severity as 'info' | 'warning' | 'critical',
      timestamp: e.timestamp,
      event_type: e.event_type,
    })),
    safetyGates: gates.map(g => ({
      id: g.id,
      name: g.name,
      description: null,
      condition_type: g.condition_type as 'pre_check' | 'during' | 'post_check',
      action: g.action as 'block' | 'warn' | 'notify',
      priority: g.priority,
      status: g.status,
    })),
    userRole: userRole as import('@/contracts/common.contract').UserRole,
    canManage: userRole === 'admin' || userRole === 'commander',
  }
  return ok(detail)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDrill(params: {
  title: string
  description?: string | null
  mode: DrillMode
  location?: string | null
  start_date?: string | null
  end_date?: string | null
  max_participants?: number | null
  objectives?: string[]
  created_by: string
  organization_id?: string | null
}): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drills')
    .insert({
      title: params.title,
      description: params.description ?? null,
      mode: params.mode,
      status: 'draft',
      location: params.location ?? null,
      start_date: params.start_date ?? null,
      end_date: params.end_date ?? null,
      max_participants: params.max_participants ?? null,
      objectives: params.objectives?.length ? params.objectives : null,
      created_by: params.created_by,
      organization_id: params.organization_id ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')
  return ok({ id: data.id })
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateDrillStatus(
  drillId: string,
  newStatus: DrillStatus
): Promise<ServiceResult<true>> {
  const supabase = await createClient()

  if (newStatus === 'active') {
    const gateBlock = await checkBlockingGates(drillId)
    if (!gateBlock.ok) return gateBlock
  }

  const { error } = await supabase
    .from('drills')
    .update({ status: newStatus })
    .eq('id', drillId)
  if (error) return fail('database_error', error.message)
  return ok(true as const)
}

async function checkBlockingGates(drillId: string): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data: blocking } = await supabase
    .from('safety_gate_rules')
    .select('id, name')
    .eq('is_active', true)
    .eq('action', 'block')
    .eq('condition_type', 'pre_check')

  if (!blocking?.length) return ok(true as const)

  const { data: passed } = await supabase
    .from('drill_safety_gates')
    .select('rule_id')
    .eq('drill_id', drillId)
    .in('status', ['passed', 'waived'])

  const passedIds = new Set((passed ?? []).map(g => g.rule_id))
  const blockers = blocking.filter(r => !passedIds.has(r.id))
  if (blockers.length > 0) {
    return fail(
      'safety_gate_blocked',
      `Safety Gate ยังไม่ผ่าน: ${blockers.map(r => r.name).join(', ')}`
    )
  }
  return ok(true as const)
}
