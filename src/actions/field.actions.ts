'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { updatePatientTriage } from '@/services/patient.service'
import { logEvent } from '@/services/event.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  submitFieldTriageSchema,
  supplyRequestSchema,
  fieldCheckinSchema,
  fieldSupplyRequestSchema,
  evaluatorObservationSchema,
} from '@/contracts/schemas'
import { createClient } from '@/lib/supabase/server'

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
    eventType: 'PATIENT_TRIAGED',
    title: `Triage: ${d.patient_id} → ${d.triage_level}`,
    severity: d.triage_level === 'P1' ? 'critical' : 'info',
    mode: 'operation',
    userId: ctx.data.userId,
  })

  revalidatePath('/field/triage')
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

  const d = parsed.data
  await logEvent({
    eventType: 'SUPPLY_REQUESTED',
    title: `ร้องขออุปกรณ์: ${d.item_code} × ${d.quantity} ${d.unit}`,
    severity: d.priority === 'immediate' ? 'critical' : 'info',
    mode: 'operation',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  return ok(true as const)
}

// ── Field check-in ────────────────────────────────────────────────────────────

export async function submitFieldCheckinAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = fieldCheckinSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const supabase = await createClient()

  const participantStatus =
    d.status === 'completed' ? 'completed' : 'active'

  await supabase
    .from('drill_participants')
    .update({ status: participantStatus, joined_at: new Date().toISOString() })
    .eq('drill_id', d.drill_id)
    .eq('user_id', ctx.data.userId)

  const gpsDesc = d.lat != null && d.lng != null
    ? `GPS: ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}${d.accuracy ? ` ±${Math.round(d.accuracy)}m` : ''}${d.location_name ? ` · ${d.location_name}` : ''}`
    : d.location_name ?? null

  await logEvent({
    eventType: 'TEAM_CHECK_IN',
    title: `Check-in: ${d.status}`,
    description: gpsDesc,
    severity: 'info',
    mode: 'operation',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  revalidatePath('/field')
  return ok(true as const)
}

// ── Field supply request (full form) ─────────────────────────────────────────

export async function submitFieldSupplyRequestAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = fieldSupplyRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const destStr = d.destination ? ` → ${d.destination}` : ''
  const neededStr = d.needed_at ? ` (ต้องการ: ${d.needed_at})` : ''

  await logEvent({
    eventType: 'SUPPLY_REQUESTED',
    title: `ขอสนับสนุน: ${d.item_name} × ${d.quantity} ${d.unit}${destStr}`,
    description: `Priority: ${d.priority}${neededStr}${d.notes ? ` · ${d.notes}` : ''}`,
    severity: d.priority === 'immediate' ? 'critical' : d.priority === 'urgent' ? 'warning' : 'info',
    mode: 'operation',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  revalidatePath('/field/supply-request')
  return ok(true as const)
}

// ── Evaluator observation ─────────────────────────────────────────────────────

export async function submitEvaluatorObservationAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = evaluatorObservationSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const resultEmoji = d.result === 'pass' ? '✓' : d.result === 'gap' ? '△' : '✗'
  const scoreStr = d.score != null ? ` [${d.score}/10]` : ''

  await logEvent({
    eventType: 'EVALUATOR_OBSERVATION',
    title: `${resultEmoji} ${d.metric_code} · ${d.subject_ref}${scoreStr}`,
    description: d.finding,
    severity: d.result === 'fail' ? 'critical' : d.result === 'gap' ? 'warning' : 'info',
    mode: 'drill',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  revalidatePath('/field/evaluator-observation')
  return ok(true as const)
}
