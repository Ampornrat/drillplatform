'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveUserContext } from '@/services/context.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  updateFacilityStatusFullSchema,
  assignPatientDestinationSchema,
  createPatientMovementSchema,
  confirmPatientHandoverSchema,
} from '@/contracts/schemas'

// ── Update facility status (full medical capacity) ────────────

export async function updateFacilityStatusAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateFacilityStatusFullSchema.safeParse({
    ...raw,
    or_available: raw.or_available === 'true' || raw.or_available === 'on',
    blood_available: raw.blood_available === 'true' || raw.blood_available === 'on',
  })
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('facility_status').insert({
    drill_id: d.drill_id,
    site_code: d.site_code,
    site_name: d.site_name ?? null,
    status: d.status,
    current_load: d.current_load,
    capacity: d.capacity ?? null,
    icu_beds_total: d.icu_beds_total,
    icu_beds_available: d.icu_beds_available,
    or_available: d.or_available,
    blood_available: d.blood_available,
    oxygen_level: d.oxygen_level,
    diversion_status: d.diversion_status,
    facility_level: d.facility_level ?? null,
    notes: d.notes ?? null,
    updated_by: ctx.data.userId,
  })
  if (error) return fail('database_error', error.message)

  // Log to event_log
  const isDiversion = d.diversion_status !== 'open'
  await supabase.from('event_log').insert({
    event_type: isDiversion ? 'FACILITY_DIVERSION' : 'facility_status_updated',
    title: isDiversion
      ? `DIVERSION: ${d.site_code} — ${d.diversion_status}`
      : `อัปเดตสถานะ ${d.site_code}`,
    description: d.site_name ?? null,
    severity: d.diversion_status === 'closed' || d.diversion_status === 'overloaded'
      ? 'critical'
      : d.diversion_status === 'divert' ? 'warning' : 'info',
    mode: 'operation',
    drill_id: d.drill_id,
    user_id: ctx.data.userId,
    timestamp: new Date().toISOString(),
  })

  // Notify commanders + medical on diversion
  if (isDiversion) {
    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['commander', 'admin'])
      .eq('is_active', true)

    if (managers && managers.length > 0) {
      await supabase.from('notifications').insert(
        managers.map((m) => ({
          user_id: m.id,
          type: 'critical' as const,
          title: `Diversion Alert: ${d.site_name ?? d.site_code}`,
          body: `สถานพยาบาลประกาศ ${d.diversion_status} — กรุณาเปลี่ยนเส้นทางผู้ป่วย`,
          link: `/operation/${d.drill_id}/facility`,
          drill_id: d.drill_id,
        }))
      )
    }
  }

  revalidatePath(`/operation/${d.drill_id}/facility`)
  revalidatePath(`/operation/${d.drill_id}/cop`)
  revalidatePath('/dashboard')
  return ok(true as const)
}

// ── Assign patient destination ────────────────────────────────

export async function assignPatientDestinationAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = assignPatientDestinationSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  // Resolve destination: form may send site_code (non-UUID) or actual UUID
  let destId = d.destination_id
  if (!destId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
    const { data: site } = await supabase
      .from('iodp_sites')
      .select('id')
      .eq('site_code', destId)
      .single()
    if (!site) return fail('not_found', `ไม่พบสถานพยาบาล: ${destId}`)
    destId = site.id
  }

  const { error } = await supabase
    .from('iodp_patients')
    .update({
      destination_id: destId,
      transport_mode: d.transport_mode ?? null,
      transport_object_id: d.transport_object_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.patient_id)
  if (error) return fail('database_error', error.message)

  // Log iodp_event
  const { data: patient } = await supabase
    .from('iodp_patients')
    .select('patient_code, triage_level, session_id')
    .eq('id', d.patient_id)
    .single()

  if (patient) {
    await supabase.from('iodp_events').insert({
      session_id: patient.session_id,
      event_code: 'PATIENT_DESTINATION_ASSIGNED',
      severity: patient.triage_level === 'P1' ? 'critical' : 'info',
      actor: ctx.data.userId,
      description: `Patient ${patient.patient_code} destination assigned`,
      patient_id: d.patient_id,
    })
  }

  const drillId = formData.get('drill_id') as string | null
  if (drillId) {
    revalidatePath(`/operation/${drillId}/facility`)
    revalidatePath(`/operation/${drillId}/cop`)
  }
  return ok(true as const)
}

// ── Start transport (create movement) ────────────────────────

export async function createPatientMovementAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = createPatientMovementSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('iodp_patients')
    .select('patient_code, triage_level, site_id, session_id, transport_mode, transport_object_id')
    .eq('id', d.patient_id)
    .single()
  if (!patient) return fail('not_found', 'ไม่พบข้อมูลผู้ป่วย')

  const { error: moveError } = await supabase.from('patient_movements').insert({
    patient_id: d.patient_id,
    from_site_id: d.from_site_id ?? patient.site_id ?? null,
    to_site_id: d.to_site_id,
    transport_mode: d.transport_mode ?? patient.transport_mode ?? null,
    moved_by: ctx.data.userId,
    notes: d.notes ?? null,
  })
  if (moveError) return fail('database_error', moveError.message)

  const { error: patientError } = await supabase
    .from('iodp_patients')
    .update({
      status: 'en_route',
      departed_at: new Date().toISOString(),
      transport_object_id: d.transport_object_id ?? patient.transport_object_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.patient_id)
  if (patientError) return fail('database_error', patientError.message)

  if (d.transport_object_id) {
    await supabase
      .from('object_registry')
      .update({ status: 'en_route', assigned_patient_id: d.patient_id, updated_at: new Date().toISOString() })
      .eq('id', d.transport_object_id)
  }

  await supabase.from('iodp_events').insert({
    session_id: patient.session_id,
    event_code: 'PATIENT_TRANSPORT_STARTED',
    severity: patient.triage_level === 'P1' ? 'critical' : 'info',
    actor: ctx.data.userId,
    description: `Transport started: ${patient.patient_code}`,
    patient_id: d.patient_id,
  })

  const drillId = formData.get('drill_id') as string | null
  if (drillId) {
    revalidatePath(`/operation/${drillId}/facility`)
    revalidatePath(`/operation/${drillId}/cop`)
  }
  return ok(true as const)
}

// ── Confirm patient handover ──────────────────────────────────

export async function confirmPatientHandoverAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  let mistData: Record<string, string> | undefined
  try {
    const mistRaw = formData.get('mist_data') as string | null
    if (mistRaw) mistData = JSON.parse(mistRaw)
  } catch { /* ignore parse errors */ }

  const parsed = confirmPatientHandoverSchema.safeParse({
    patient_id: raw.patient_id,
    transport_object_id: raw.transport_object_id || undefined,
    mist_data: mistData,
    notes: raw.notes || undefined,
  })
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('iodp_patients')
    .select('patient_code, triage_level, session_id, destination_id, transport_object_id')
    .eq('id', d.patient_id)
    .single()
  if (!patient) return fail('not_found', 'ไม่พบข้อมูลผู้ป่วย')

  const transportId = d.transport_object_id ?? patient.transport_object_id

  const { error: admitError } = await supabase
    .from('iodp_patients')
    .update({
      status: 'admitted',
      admitted_at: new Date().toISOString(),
      site_id: patient.destination_id ?? null,
      destination_id: null,
      mist_data: (d.mist_data as unknown as import('@/types/database.types').Json) ?? {},
      transport_object_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.patient_id)
  if (admitError) return fail('database_error', admitError.message)

  if (transportId) {
    await supabase
      .from('object_registry')
      .update({ status: 'available', assigned_patient_id: null, updated_at: new Date().toISOString() })
      .eq('id', transportId)
  }

  // Increment facility current_load
  if (patient.destination_id) {
    const { data: site } = await supabase
      .from('iodp_sites')
      .select('current_load')
      .eq('id', patient.destination_id)
      .single()
    if (site) {
      await supabase
        .from('iodp_sites')
        .update({ current_load: site.current_load + 1, updated_at: new Date().toISOString() })
        .eq('id', patient.destination_id)
    }
  }

  await supabase.from('iodp_events').insert({
    session_id: patient.session_id,
    event_code: 'PATIENT_HANDOVER_COMPLETED',
    severity: 'info',
    actor: ctx.data.userId,
    description: `Handover complete: ${patient.patient_code}`,
    patient_id: d.patient_id,
  })

  const drillId = formData.get('drill_id') as string | null
  if (drillId) {
    revalidatePath(`/operation/${drillId}/facility`)
    revalidatePath(`/operation/${drillId}/cop`)
  }
  return ok(true as const)
}
