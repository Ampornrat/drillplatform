'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveFullContext } from '@/services/context.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  createObjectSchema,
  updateObjectReadinessSchema,
  changeObjectStatusSchema,
  assignObjectCapabilitySchema,
  attachObjectStandardSchema,
  markObjectMaintenanceSchema,
} from '@/contracts/schemas'

const ALLOWED_ROLES = ['admin', 'commander', 'logistics'] as const

async function checkAccess() {
  const ctx = await resolveFullContext()
  if (!ctx.ok) return ctx
  if (!(ALLOWED_ROLES as readonly string[]).includes(ctx.data.role)) {
    return fail('forbidden', 'ต้องมีบทบาท Admin, Commander หรือ Logistics')
  }
  return ctx
}

async function insertLifecycleEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    object_id: string
    event_type: string
    from_value?: string | null
    to_value?: string | null
    actor_id: string
    actor_name: string | null
    notes?: string | null
  }
) {
  await supabase.from('lifecycle_events').insert({
    object_id: payload.object_id,
    event_type: payload.event_type,
    from_value: payload.from_value ?? null,
    to_value: payload.to_value ?? null,
    actor_id: payload.actor_id,
    actor_name: payload.actor_name,
    notes: payload.notes ?? null,
  })
}

async function insertPlatformEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    event_type: string
    source_id: string
    severity?: 'info' | 'warning' | 'critical' | 'drill'
    title: string
    description?: string | null
    actor_id: string
    drill_id?: string | null
  }
) {
  await supabase.from('platform_events').insert({
    event_type: payload.event_type,
    source_type: 'object_registry',
    source_id: payload.source_id,
    severity: payload.severity ?? 'info',
    title: payload.title,
    description: payload.description ?? null,
    actor_id: payload.actor_id,
    drill_id: payload.drill_id ?? null,
  })
}

// ── Create object ─────────────────────────────────────────────────

export async function createObjectAction(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = createObjectSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('object_registry')
    .insert({
      object_code: d.object_code,
      name: d.name,
      type: d.type,
      owner: d.owner ?? null,
      home_location: d.home_location ?? null,
      notes: d.notes ?? null,
      status: 'available',
      readiness: 100,
    })
    .select('id')
    .single()
  if (error) return fail('database_error', error.message)

  await insertLifecycleEvent(supabase, {
    object_id: data.id,
    event_type: 'created',
    to_value: 'available',
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
    notes: `Object ${d.object_code} registered`,
  })

  revalidatePath('/admin/registry')
  return ok({ id: data.id })
}

// ── Update readiness ──────────────────────────────────────────────

export async function updateObjectReadinessAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateObjectReadinessSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  // Get current readiness for lifecycle diff
  const { data: current } = await supabase
    .from('object_registry')
    .select('readiness, drill_id, object_code')
    .eq('id', d.object_id)
    .single()

  const { error } = await supabase
    .from('object_registry')
    .update({ readiness: d.readiness, updated_at: new Date().toISOString() })
    .eq('id', d.object_id)
  if (error) return fail('database_error', error.message)

  await insertLifecycleEvent(supabase, {
    object_id: d.object_id,
    event_type: 'readiness_update',
    from_value: String(current?.readiness ?? '?'),
    to_value: String(d.readiness),
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
    notes: d.notes,
  })

  if (d.readiness < 50 && current?.drill_id) {
    await insertPlatformEvent(supabase, {
      event_type: 'OBJECT_LOW_READINESS',
      source_id: d.object_id,
      severity: 'warning',
      title: `${current?.object_code ?? 'Object'} readiness: ${d.readiness}%`,
      actor_id: ctx.data.userId,
      drill_id: current.drill_id,
    })
  }

  revalidatePath('/admin/registry')
  revalidatePath(`/admin/registry/${d.object_id}`)
  if (current?.drill_id) {
    revalidatePath(`/operation/${current.drill_id}/facility`)
    revalidatePath(`/operation/${current.drill_id}/cop`)
  }
  return ok(true as const)
}

// ── Change status ─────────────────────────────────────────────────

export async function changeObjectStatusAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = changeObjectStatusSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('object_registry')
    .select('status, drill_id, object_code')
    .eq('id', d.object_id)
    .single()

  const { error } = await supabase
    .from('object_registry')
    .update({ status: d.status, updated_at: new Date().toISOString() })
    .eq('id', d.object_id)
  if (error) return fail('database_error', error.message)

  await insertLifecycleEvent(supabase, {
    object_id: d.object_id,
    event_type: 'status_change',
    from_value: current?.status ?? null,
    to_value: d.status,
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
    notes: d.notes,
  })

  await insertPlatformEvent(supabase, {
    event_type: 'OBJECT_STATUS_CHANGED',
    source_id: d.object_id,
    severity: d.status === 'demobilized' ? 'warning' : 'info',
    title: `${current?.object_code ?? 'Object'}: ${current?.status ?? '?'} → ${d.status}`,
    description: d.notes ?? null,
    actor_id: ctx.data.userId,
    drill_id: current?.drill_id ?? null,
  })

  revalidatePath('/admin/registry')
  revalidatePath(`/admin/registry/${d.object_id}`)
  if (current?.drill_id) {
    revalidatePath(`/operation/${current.drill_id}/facility`)
    revalidatePath(`/operation/${current.drill_id}/cop`)
    revalidatePath('/dashboard')
  }
  return ok(true as const)
}

// ── Assign capability ─────────────────────────────────────────────

export async function assignObjectCapabilityAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = assignObjectCapabilitySchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('object_registry')
    .select('capability, object_code')
    .eq('id', d.object_id)
    .single()
  if (!current) return fail('not_found', 'ไม่พบ Object')

  const caps = current.capability ?? []
  const newCaps = d.action === 'add'
    ? Array.from(new Set([...caps, d.capability_code]))
    : caps.filter((c: string) => c !== d.capability_code)

  const { error } = await supabase
    .from('object_registry')
    .update({ capability: newCaps, updated_at: new Date().toISOString() })
    .eq('id', d.object_id)
  if (error) return fail('database_error', error.message)

  await insertLifecycleEvent(supabase, {
    object_id: d.object_id,
    event_type: d.action === 'add' ? 'capability_assigned' : 'capability_removed',
    to_value: d.capability_code,
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
  })

  revalidatePath(`/admin/registry/${d.object_id}`)
  return ok(true as const)
}

// ── Attach standard ───────────────────────────────────────────────

export async function attachObjectStandardAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = attachObjectStandardSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  // Store standard IDs in meta.standards array
  const { data: current } = await supabase
    .from('object_registry')
    .select('meta, object_code')
    .eq('id', d.object_id)
    .single()
  if (!current) return fail('not_found', 'ไม่พบ Object')

  const meta = (current.meta as Record<string, unknown>) ?? {}
  const standards = Array.isArray(meta.standards) ? meta.standards as string[] : []
  if (!standards.includes(d.standard_id)) standards.push(d.standard_id)

  const { error } = await supabase
    .from('object_registry')
    .update({ meta: { ...meta, standards }, updated_at: new Date().toISOString() })
    .eq('id', d.object_id)
  if (error) return fail('database_error', error.message)

  const { data: std } = await supabase
    .from('standards_registry')
    .select('code, title')
    .eq('id', d.standard_id)
    .single()

  await insertLifecycleEvent(supabase, {
    object_id: d.object_id,
    event_type: 'standard_attached',
    to_value: std ? `${std.code} — ${std.title}` : d.standard_id,
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
  })

  revalidatePath(`/admin/registry/${d.object_id}`)
  return ok(true as const)
}

// ── Mark maintenance ──────────────────────────────────────────────

export async function markObjectMaintenanceAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = markObjectMaintenanceSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('object_registry')
    .select('status, drill_id, object_code, meta')
    .eq('id', d.object_id)
    .single()
  if (!current) return fail('not_found', 'ไม่พบ Object')

  const meta = (current.meta as Record<string, unknown>) ?? {}
  const { error } = await supabase
    .from('object_registry')
    .update({
      status: 'maintenance',
      updated_at: new Date().toISOString(),
      meta: {
        ...meta,
        maintenance_started_at: new Date().toISOString(),
        maintenance_expected_return: d.expected_return ?? null,
        maintenance_notes: d.notes ?? null,
      },
    })
    .eq('id', d.object_id)
  if (error) return fail('database_error', error.message)

  await insertLifecycleEvent(supabase, {
    object_id: d.object_id,
    event_type: 'maintenance_started',
    from_value: current.status,
    to_value: 'maintenance',
    actor_id: ctx.data.userId,
    actor_name: ctx.data.profile?.full_name ?? null,
    notes: d.notes,
  })

  await insertPlatformEvent(supabase, {
    event_type: 'OBJECT_MAINTENANCE',
    source_id: d.object_id,
    severity: 'warning',
    title: `${current.object_code ?? 'Object'} เข้าซ่อมบำรุง`,
    description: d.notes ?? null,
    actor_id: ctx.data.userId,
    drill_id: current.drill_id ?? null,
  })

  revalidatePath('/admin/registry')
  revalidatePath(`/admin/registry/${d.object_id}`)
  if (current.drill_id) {
    revalidatePath(`/operation/${current.drill_id}/facility`)
    revalidatePath(`/operation/${current.drill_id}/cop`)
    revalidatePath('/dashboard')
  }
  return ok(true as const)
}
