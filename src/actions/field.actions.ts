'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { updatePatientTriage } from '@/services/patient.service'
import { logEvent } from '@/services/event.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import { submitFieldTriageSchema, supplyRequestSchema } from '@/contracts/schemas'

export async function submitTriageActionV2(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = submitFieldTriageSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const result = await updatePatientTriage({
    patientId: d.patient_id,
    triage_level: d.triage_level,
    status: d.status,
    site_id: d.site_id ?? null,
    march_data: d.march_data,
  })
  if (!result.ok) return result

  await logEvent({
    eventType: 'triage_submitted',
    title: `Triage อัปเดต: ${d.patient_id} → ${d.triage_level}`,
    severity: d.triage_level === 'P1' ? 'critical' : 'info',
    mode: 'operation',
    userId: ctx.data.userId,
  })

  revalidatePath('/participant')
  return ok(true as const)
}

export async function submitSupplyRequestActionV2(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = supplyRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  // TODO: insert to supply_requests table once created
  const d = parsed.data
  await logEvent({
    eventType: 'supply_requested',
    title: `ร้องขออุปกรณ์: ${d.item_code} × ${d.quantity} ${d.unit}`,
    severity: d.priority === 'immediate' ? 'critical' : 'info',
    mode: 'operation',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  return ok(true as const)
}
