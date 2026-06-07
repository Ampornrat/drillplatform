'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { resolveUserContext, assertCanManage } from '@/services/context.service'
import { createDrill } from '@/services/drill.service'
import { updateIAP } from '@/services/iap.service'
import { logEvent } from '@/services/event.service'
import { fail, type ServiceResult } from '@/lib/result'
import { createIncidentFromMethaneSchema, updateIapSchema } from '@/contracts/schemas'

// ── Create incident from METHANE report ───────────────────────────────────────

export async function createIncidentFromMethaneAction(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const guard = assertCanManage(ctx.data)
  if (!guard.ok) return guard

  const raw = Object.fromEntries(formData.entries())
  const parsed = createIncidentFromMethaneSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const title = `[${d.type}] ${d.exact_location}`
  const result = await createDrill({
    title,
    description: [
      `Mechanism: ${d.mechanism}`,
      `Hazards: ${d.hazards}`,
      `Access: ${d.access}`,
      `Casualties: ${d.number_of_casualties}`,
      `Emergency services: ${d.emergency_services}`,
    ].join('\n'),
    mode: 'operation',
    location: d.exact_location,
    created_by: ctx.data.userId,
    organization_id: d.organization_id ?? ctx.data.organizationId,
  })
  if (!result.ok) return result

  await logEvent({
    eventType: 'incident_created',
    title: `เหตุการณ์ใหม่: ${title}`,
    severity: 'critical',
    mode: 'operation',
    drillId: result.data.id,
    userId: ctx.data.userId,
  })

  revalidatePath('/planner/drills')
  revalidatePath('/dashboard')
  redirect(`/planner/drills/${result.data.id}`)
}

// ── Update IAP ────────────────────────────────────────────────────────────────

export async function updateIAPAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const guard = assertCanManage(ctx.data)
  if (!guard.ok) return guard

  const raw = {
    drill_id: formData.get('drill_id'),
    objectives: JSON.parse((formData.get('objectives') as string) || '[]'),
    period_start: formData.get('period_start') || undefined,
    period_end: formData.get('period_end') || undefined,
    notes: formData.get('notes') || undefined,
  }
  const parsed = updateIapSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const result = await updateIAP({
    drillId: parsed.data.drill_id,
    objectives: parsed.data.objectives,
    period_start: parsed.data.period_start ?? null,
    period_end: parsed.data.period_end ?? null,
  })
  if (!result.ok) return result

  await logEvent({
    eventType: 'iap_updated',
    title: 'อัปเดต IAP',
    severity: 'info',
    mode: 'operation',
    drillId: parsed.data.drill_id,
    userId: ctx.data.userId,
  })

  revalidatePath(`/planner/drills/${parsed.data.drill_id}`)
  revalidatePath(`/operation/${parsed.data.drill_id}/cop`)
  return { ok: true, data: true as const }
}
