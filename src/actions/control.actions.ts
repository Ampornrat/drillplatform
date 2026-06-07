'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveFullContext } from '@/services/context.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  updateSimClockSchema,
  pushScenarioInjectSchema,
  acknowledgeInjectSchema,
  changeResourceStateSchema,
  pauseExerciseSchema,
  createEvaluatorFlagSchema,
} from '@/contracts/schemas'

const CONTROLLER_ROLES = ['admin', 'commander', 'controller'] as const

async function checkControllerAccess() {
  const ctx = await resolveFullContext()
  if (!ctx.ok) return ctx
  if (!(CONTROLLER_ROLES as readonly string[]).includes(ctx.data.role)) {
    return fail('forbidden', 'ต้องมีบทบาท Controller, Commander หรือ Admin')
  }
  return ctx
}

async function logPlatformEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    event_type: string
    source_id: string
    severity: 'info' | 'warning' | 'critical' | 'drill'
    title: string
    description?: string | null
    actor_id: string
    drill_id: string
  }
) {
  await supabase.from('platform_events').insert({
    event_type: payload.event_type,
    source_type: 'scenario_instances',
    source_id: payload.source_id,
    severity: payload.severity,
    title: payload.title,
    description: payload.description ?? null,
    actor_id: payload.actor_id,
    drill_id: payload.drill_id,
  })
}

// ── Update sim clock ──────────────────────────────────────────────────────────

export async function updateSimClockAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkControllerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateSimClockSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('sim_clock_state')
    .select('status, elapsed_seconds')
    .eq('scenario_id', d.scenario_id)
    .single()

  // Get drill_id from scenario
  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id, title')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: d.status,
    updated_at: now,
    last_tick_at: now,
  }

  if (d.elapsed_seconds !== undefined) updates.elapsed_seconds = d.elapsed_seconds
  if (d.speed_multiplier !== undefined) updates.speed_multiplier = d.speed_multiplier
  if (d.notes !== undefined) updates.notes = d.notes

  if (d.status === 'live' && current?.status !== 'live') {
    updates.started_at = updates.started_at ?? now
    updates.paused_at = null
    // Update scenario status to active
    await supabase.from('scenario_instances').update({ status: 'active' }).eq('id', d.scenario_id)
  }
  if (d.status === 'paused' || d.status === 'safety_pause') {
    updates.paused_at = now
    if (d.elapsed_seconds !== undefined) updates.elapsed_seconds = d.elapsed_seconds
  }
  if (d.status === 'completed') {
    updates.paused_at = null
    await supabase.from('scenario_instances').update({ status: 'completed' }).eq('id', d.scenario_id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('sim_clock_state').update(updates as any).eq('scenario_id', d.scenario_id)
  if (error) return fail('database_error', error.message)

  const eventTypeMap: Record<string, string> = {
    live: 'SIM_CLOCK_STARTED',
    paused: 'EXERCISE_PAUSED',
    safety_pause: 'SAFETY_PAUSE',
    completed: 'SIM_CLOCK_COMPLETED',
    standby: 'SIM_CLOCK_RESET',
  }
  const severityMap: Record<string, 'info' | 'warning' | 'critical'> = {
    live: 'info',
    paused: 'warning',
    safety_pause: 'critical',
    completed: 'info',
    standby: 'info',
  }

  await logPlatformEvent(supabase, {
    event_type: eventTypeMap[d.status] ?? 'SIM_CLOCK_UPDATED',
    source_id: d.scenario_id,
    severity: severityMap[d.status] ?? 'info',
    title: `${d.status === 'live' ? '▶' : d.status === 'safety_pause' ? '🔴' : d.status === 'completed' ? '✓' : '⏸'} ${scenario.title}: ${d.status.toUpperCase()}`,
    description: d.notes ?? null,
    actor_id: ctx.data.userId,
    drill_id: scenario.drill_id,
  })

  revalidatePath(`/drill/control/${d.scenario_id}`)
  revalidatePath(`/drill/${scenario.drill_id}/dashboard`)
  return ok(true as const)
}

// ── Push inject ───────────────────────────────────────────────────────────────

export async function pushMselInjectAction(
  formData: FormData
): Promise<ServiceResult<{ delivery_id: string }>> {
  const ctx = await checkControllerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = pushScenarioInjectSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  // Fetch inject + scenario
  const { data: inject } = await supabase
    .from('msel_injects')
    .select('id, inject_code, title, severity, target_team, scenario_id')
    .eq('id', d.inject_id)
    .single()
  if (!inject) return fail('not_found', 'ไม่พบ Inject')

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  // Create delivery record
  const { data: delivery, error: delivErr } = await supabase
    .from('inject_deliveries')
    .insert({
      inject_id: d.inject_id,
      scenario_id: d.scenario_id,
      delivered_to_role: inject.target_team ?? null,
      delivered_to_team: inject.target_team ?? null,
      notes: d.notes ?? null,
    })
    .select('id')
    .single()
  if (delivErr || !delivery) return fail('database_error', delivErr?.message ?? 'delivery insert failed')

  // Update inject status to pushed
  await supabase
    .from('msel_injects')
    .update({ status: 'pushed', pushed_at: new Date().toISOString() })
    .eq('id', d.inject_id)

  // Create notification in notifications table for target team
  if (inject.target_team) {
    // Find users with matching team/role — simplified: create a broadcast notification
    await supabase.from('platform_events').insert({
      event_type: 'INJECT_PUSHED',
      source_type: 'inject_deliveries',
      source_id: delivery.id,
      severity: inject.severity as 'info' | 'warning' | 'critical' | 'drill',
      title: `[INJECT] ${inject.inject_code}: ${inject.title}`,
      description: `Target: ${inject.target_team}`,
      actor_id: ctx.data.userId,
      drill_id: scenario.drill_id,
    })
  }

  await logPlatformEvent(supabase, {
    event_type: 'INJECT_PUSHED',
    source_id: d.inject_id,
    severity: 'info',
    title: `Inject pushed: ${inject.inject_code} — ${inject.title}`,
    actor_id: ctx.data.userId,
    drill_id: scenario.drill_id,
  })

  revalidatePath(`/drill/control/${d.scenario_id}`)
  return ok({ delivery_id: delivery.id })
}

// ── Acknowledge inject ────────────────────────────────────────────────────────

export async function acknowledgeInjectAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveFullContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = acknowledgeInjectSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: delivery } = await supabase
    .from('inject_deliveries')
    .select('inject_id, scenario_id')
    .eq('id', d.delivery_id)
    .single()
  if (!delivery) return fail('not_found', 'ไม่พบ Delivery')

  const { error } = await supabase
    .from('inject_deliveries')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: ctx.data.userId,
      notes: d.notes ?? null,
    })
    .eq('id', d.delivery_id)
  if (error) return fail('database_error', error.message)

  // Also update inject status
  await supabase
    .from('msel_injects')
    .update({ status: 'acknowledged' })
    .eq('id', delivery.inject_id)
    .eq('status', 'pushed')

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id')
    .eq('id', delivery.scenario_id)
    .single()

  if (scenario) {
    await logPlatformEvent(supabase, {
      event_type: 'INJECT_ACKNOWLEDGED',
      source_id: d.delivery_id,
      severity: 'info',
      title: `Inject acknowledged`,
      actor_id: ctx.data.userId,
      drill_id: scenario.drill_id,
    })
  }

  revalidatePath(`/drill/control/${delivery.scenario_id}`)
  return ok(true as const)
}

// ── Change resource state ─────────────────────────────────────────────────────

export async function changeResourceStateAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkControllerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = changeResourceStateSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  if (d.resource_type === 'object') {
    const { data: obj } = await supabase
      .from('object_registry')
      .select('object_code, status')
      .eq('id', d.resource_id)
      .single()

    const { error } = await supabase
      .from('object_registry')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: d.status as any, updated_at: new Date().toISOString() })
      .eq('id', d.resource_id)
    if (error) return fail('database_error', error.message)

    await logPlatformEvent(supabase, {
      event_type: 'RESOURCE_STATE_CHANGED',
      source_id: d.resource_id,
      severity: ['unavailable', 'broken', 'weather_hold'].includes(d.status) ? 'warning' : 'info',
      title: `${obj?.object_code ?? 'Resource'}: ${obj?.status ?? '?'} → ${d.status}`,
      description: d.notes ?? null,
      actor_id: ctx.data.userId,
      drill_id: scenario.drill_id,
    })
  } else {
    // facility: update facility_status table
    const { error } = await supabase
      .from('facility_status')
      .update({ status: d.status as 'normal' | 'surge' | 'critical' | 'closed', updated_at: new Date().toISOString() })
      .eq('id', d.resource_id)
    if (error) return fail('database_error', error.message)

    await logPlatformEvent(supabase, {
      event_type: 'RESOURCE_STATE_CHANGED',
      source_id: d.resource_id,
      severity: 'warning',
      title: `Facility → ${d.status}`,
      description: d.notes ?? null,
      actor_id: ctx.data.userId,
      drill_id: scenario.drill_id,
    })
  }

  revalidatePath(`/drill/control/${d.scenario_id}`)
  revalidatePath(`/drill/${scenario.drill_id}/dashboard`)
  return ok(true as const)
}

// ── Pause exercise ────────────────────────────────────────────────────────────

export async function pauseExerciseAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkControllerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = pauseExerciseSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id, title')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  const now = new Date().toISOString()
  const newStatus = d.pause_type === 'safety_pause' ? 'safety_pause' : 'paused'

  const { error } = await supabase
    .from('sim_clock_state')
    .update({
      status: newStatus,
      paused_at: now,
      elapsed_seconds: d.elapsed_seconds,
      notes: d.reason ?? null,
      updated_at: now,
    })
    .eq('scenario_id', d.scenario_id)
  if (error) return fail('database_error', error.message)

  await logPlatformEvent(supabase, {
    event_type: d.pause_type === 'safety_pause' ? 'SAFETY_PAUSE' : 'EXERCISE_PAUSED',
    source_id: d.scenario_id,
    severity: d.pause_type === 'safety_pause' ? 'critical' : 'warning',
    title: d.pause_type === 'safety_pause'
      ? `🔴 SAFETY PAUSE — ${scenario.title}`
      : `⏸ Exercise Paused — ${scenario.title}`,
    description: d.reason ?? null,
    actor_id: ctx.data.userId,
    drill_id: scenario.drill_id,
  })

  revalidatePath(`/drill/control/${d.scenario_id}`)
  revalidatePath(`/operation/${scenario.drill_id}/cop`)
  return ok(true as const)
}

// ── Create evaluator flag ─────────────────────────────────────────────────────

export async function createEvaluatorFlagAction(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveFullContext()
  if (!ctx.ok) return ctx
  if (!['admin', 'commander', 'controller', 'evaluator'].includes(ctx.data.role)) {
    return fail('forbidden', 'ต้องมีบทบาท Evaluator หรือสูงกว่า')
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = createEvaluatorFlagSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: flag, error } = await supabase
    .from('evaluator_flags')
    .insert({
      scenario_id: d.scenario_id,
      flagged_by: ctx.data.userId,
      category: d.category,
      title: d.title,
      description: d.description ?? null,
      severity: d.severity,
      elapsed_seconds_at: d.elapsed_seconds_at ?? null,
    })
    .select('id')
    .single()
  if (error || !flag) return fail('database_error', error?.message ?? 'insert failed')

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id')
    .eq('id', d.scenario_id)
    .single()

  if (scenario) {
    await logPlatformEvent(supabase, {
      event_type: 'EVALUATOR_FLAGGED',
      source_id: flag.id,
      severity: d.severity,
      title: `[${d.category.toUpperCase()}] ${d.title}`,
      description: d.description ?? null,
      actor_id: ctx.data.userId,
      drill_id: scenario.drill_id,
    })
  }

  revalidatePath(`/drill/control/${d.scenario_id}`)
  return ok({ id: flag.id })
}
