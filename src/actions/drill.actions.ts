'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { resolveUserContext, assertCanManage } from '@/services/context.service'
import { createDrill, updateDrillStatus } from '@/services/drill.service'
import { logEvent } from '@/services/event.service'
import { createClient } from '@/lib/supabase/server'
import { fail, type ServiceResult } from '@/lib/result'
import { createDrillSchema, updateDrillStatusSchema, upsertGateSchema } from '@/contracts/schemas'
import type { DrillMode, DrillStatus } from '@/contracts/common.contract'

// ── Create drill ──────────────────────────────────────────────────────────────

export async function createDrillActionV2(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const guard = assertCanManage(ctx.data)
  if (!guard.ok) return guard

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    mode: formData.get('mode') ?? 'drill',
    location: formData.get('location'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    max_participants: formData.get('max_participants'),
    objectives: formData.get('objectives'),
  }
  const parsed = createDrillSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const result = await createDrill({
    title: d.title,
    description: d.description ?? null,
    mode: d.mode as DrillMode,
    location: d.location ?? null,
    start_date: d.start_date ?? null,
    end_date: d.end_date ?? null,
    max_participants: d.max_participants ?? null,
    objectives: d.objectives ? d.objectives.split('\n').filter(Boolean) : [],
    created_by: ctx.data.userId,
    organization_id: ctx.data.organizationId,
  })
  if (!result.ok) return result

  await logEvent({
    eventType: 'drill_created',
    title: `สร้าง Drill: ${d.title}`,
    severity: 'info',
    mode: d.mode as DrillMode,
    drillId: result.data.id,
    userId: ctx.data.userId,
  })

  revalidatePath('/planner/drills')
  revalidatePath('/dashboard')
  redirect('/planner/drills')
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateDrillStatusActionV2(
  drillId: string,
  newStatus: string
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const guard = assertCanManage(ctx.data)
  if (!guard.ok) return guard

  const parsed = updateDrillStatusSchema.safeParse({ drill_id: drillId, status: newStatus })
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const result = await updateDrillStatus(drillId, newStatus as DrillStatus)
  if (!result.ok) return result

  const supabase = await createClient()
  const { data: drill } = await supabase
    .from('drills').select('mode').eq('id', drillId).single()

  await logEvent({
    eventType: 'drill_status_changed',
    title: `สถานะ Drill เปลี่ยนเป็น: ${newStatus}`,
    severity: newStatus === 'cancelled' ? 'warning' : 'info',
    mode: (drill?.mode ?? 'drill') as DrillMode,
    drillId,
    userId: ctx.data.userId,
  })

  revalidatePath('/planner/drills')
  revalidatePath('/dashboard')
  revalidatePath(`/planner/drills/${drillId}`)
  revalidatePath(`/operation/${drillId}/cop`)
  return { ok: true, data: true as const }
}

// ── Upsert safety gate ────────────────────────────────────────────────────────

export async function upsertDrillGateActionV2(
  drillId: string,
  ruleId: string,
  status: string,
  notes?: string
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const guard = assertCanManage(ctx.data)
  if (!guard.ok) return guard

  const parsed = upsertGateSchema.safeParse({ drill_id: drillId, rule_id: ruleId, status, notes })
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('upsert_drill_safety_gate', {
    p_drill_id: drillId,
    p_rule_id: ruleId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) return fail('database_error', error.message)

  await logEvent({
    eventType: 'safety_gate_updated',
    title: `Safety Gate อัปเดตสถานะ: ${status}`,
    severity: status === 'failed' ? 'warning' : 'info',
    mode: 'drill',
    drillId,
    userId: ctx.data.userId,
  })

  revalidatePath(`/planner/drills/${drillId}`)
  revalidatePath(`/operation/${drillId}/cop`)
  return { ok: true, data: true as const }
}
