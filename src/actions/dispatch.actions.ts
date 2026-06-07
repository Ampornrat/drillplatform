'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'

// Check safety gates for a drill — returns blocked gate titles
export async function checkSafetyGates(
  drillId: string
): Promise<ServiceResult<{ passed: boolean; blockedGates: { id: string; title: string }[] }>> {
  const supabase = await createClient()
  const { data: failed, error } = await supabase
    .from('drill_safety_gates')
    .select('rule_id, safety_gate_rules(name)')
    .eq('drill_id', drillId)
    .eq('status', 'failed')
  if (error) return fail('database_error', error.message)
  const blockedGates = (failed ?? []).map((g: any) => ({
    id: g.rule_id,
    title: (g.safety_gate_rules as any)?.name ?? g.rule_id,
  }))
  return ok({ passed: blockedGates.length === 0, blockedGates })
}

// Dispatch a single resource from master_registry via RPC
export async function dispatchResource(payload: {
  drillId: string
  resourceId: string
  assignedTo: string
  priority: string
  notes?: string
  skipGateCheck?: boolean
}): Promise<ServiceResult<{ dispatch_id: string }>> {
  const supabase = await createClient()

  if (!payload.skipGateCheck) {
    const gateResult = await checkSafetyGates(payload.drillId)
    if (!gateResult.ok) return gateResult
    if (!gateResult.data.passed) {
      return fail(
        'safety_gate_blocked',
        `Safety gate blocked: ${gateResult.data.blockedGates.map(g => g.title).join(', ')}`
      )
    }
  }

  const { data, error } = await supabase.rpc('dispatch_object', {
    payload: {
      drill_id: payload.drillId,
      resource_id: payload.resourceId,
      assigned_to: payload.assignedTo,
      priority: payload.priority,
      notes: payload.notes ?? null,
    },
  })
  if (error) return fail('database_error', error.message)
  if (data?.error) return fail('forbidden', data.message ?? 'Dispatch ไม่สำเร็จ')

  revalidatePath('/', 'layout')
  return ok({ dispatch_id: data.data.dispatch_id as string })
}

// Create task force + dispatch all members
export async function createAndDispatchTaskForce(payload: {
  drillId: string
  name: string
  capability: string
  destination: string
  priority: string
  memberIds: string[]
}): Promise<ServiceResult<{ taskForceId: string; dispatchIds: string[] }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  // Gate check once for the whole TF
  const gateResult = await checkSafetyGates(payload.drillId)
  if (!gateResult.ok) return gateResult
  if (!gateResult.data.passed) {
    return fail(
      'safety_gate_blocked',
      `Safety gate blocked: ${gateResult.data.blockedGates.map(g => g.title).join(', ')}`
    )
  }

  // Create the task force record
  const { data: tf, error: tfErr } = await supabase
    .from('task_forces')
    .insert({
      drill_id: payload.drillId,
      name: payload.name,
      capability: payload.capability,
      destination: payload.destination,
      priority: payload.priority,
      member_ids: payload.memberIds,
      status: 'dispatched',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (tfErr) return fail('database_error', tfErr.message)

  // Dispatch each member individually
  const dispatchIds: string[] = []
  for (const resourceId of payload.memberIds) {
    const { data: rpc, error: rpcErr } = await supabase.rpc('dispatch_object', {
      payload: {
        drill_id: payload.drillId,
        resource_id: resourceId,
        assigned_to: payload.destination,
        priority: payload.priority,
        notes: `Task Force: ${payload.name}`,
      },
    })
    if (!rpcErr && rpc?.success) dispatchIds.push(rpc.data.dispatch_id)
  }

  // Log DISPATCH_ASSIGNED event
  await supabase.rpc('log_platform_event', {
    payload: {
      event_type: 'DISPATCH_ASSIGNED',
      mode: 'operation',
      drill_id: payload.drillId,
      severity: 'info',
      title: `${payload.name} ส่งไปยัง ${payload.destination} · ${payload.memberIds.length} ทรัพยากร`,
    },
  })

  revalidatePath('/', 'layout')
  return ok({ taskForceId: tf.id, dispatchIds })
}

// Update dispatch_assignment status + log lifecycle event
export async function updateAssignmentStatus(
  assignmentId: string,
  drillId: string,
  newStatus: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const update: Record<string, any> = { status: newStatus }
  if (newStatus === 'released') update.released_at = new Date().toISOString()

  const { error } = await supabase
    .from('dispatch_assignments')
    .update(update)
    .eq('id', assignmentId)
  if (error) return fail('database_error', error.message)

  const eventLabels: Record<string, string> = {
    en_route: 'EN_ROUTE',
    on_scene: 'TEAM_ON_SCENE',
    released: 'RESOURCE_RELEASED',
    available: 'RESOURCE_AVAILABLE',
  }
  const evtType = eventLabels[newStatus] ?? 'STATUS_UPDATED'
  await supabase.rpc('log_platform_event', {
    payload: {
      event_type: evtType,
      mode: 'operation',
      drill_id: drillId,
      severity: 'info',
      title: `Assignment ${newStatus.replace('_', ' ')}`,
    },
  })

  revalidatePath('/', 'layout')
  return ok(true as const)
}

// Update task force status
export async function updateTaskForceStatus(
  taskForceId: string,
  drillId: string,
  newStatus: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('task_forces')
    .update({ status: newStatus })
    .eq('id', taskForceId)
  if (error) return fail('database_error', error.message)

  await supabase.rpc('log_platform_event', {
    payload: {
      event_type: 'TASK_FORCE_STATUS',
      mode: 'operation',
      drill_id: drillId,
      severity: 'info',
      title: `Task Force status → ${newStatus}`,
    },
  })

  revalidatePath('/', 'layout')
  return ok(true as const)
}
