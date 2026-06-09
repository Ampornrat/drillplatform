'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { createAAR } from '@/services/aar.service'
import { logEvent } from '@/services/event.service'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  generateAarSchema, assignLmsCourseSchema,
  createImprovementActionSchema, proposeSopUpdateSchema, scenarioBankUpdateSchema,
} from '@/contracts/schemas'

// ── Legacy: create AAR report ─────────────────────────────────────────────────

export async function createAARActionV2(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = {
    drill_id: formData.get('drill_id'),
    title: formData.get('title'),
    summary: formData.get('summary') || undefined,
    rating: formData.get('rating') || undefined,
    findings: [],
  }
  const parsed = generateAarSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const result = await createAAR({
    drill_id: d.drill_id,
    title: d.title,
    summary: d.summary ?? null,
    rating: d.rating ?? null,
    findings: [],
    created_by: ctx.data.userId,
  })
  if (!result.ok) return result

  await logEvent({
    eventType: 'aar_created',
    title: `สร้าง AAR Report: ${d.title}`,
    severity: 'info',
    mode: 'drill',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  revalidatePath('/core/aar')
  return ok(result.data)
}

// ── Generate AAR findings from evaluation data (calls generate_aar_findings) ──

export async function generateAARAction(
  drillId: string,
  scenarioId?: string
): Promise<ServiceResult<{ aar_report_id: string; finding_count: number }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_aar_findings', {
    payload: {
      drill_id: drillId,
      ...(scenarioId ? { session_id: scenarioId } : {}),
    },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string; data?: { aar_report_id: string; finding_count: number } } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  revalidatePath(`/drill/aar/${drillId}`)
  return ok(res?.data ?? { aar_report_id: '', finding_count: 0 })
}

// ── Create improvement action ─────────────────────────────────────────────────

export async function createImprovementActionAction(
  payload: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = createImprovementActionSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_improvement_action', {
    payload: {
      aar_report_id:     d.aar_report_id,
      finding_type:      d.finding_type ?? null,
      finding_code:      d.finding_code ?? null,
      category:          d.category,
      description:       d.description,
      recommendation:    d.recommendation ?? null,
      root_cause:        d.root_cause ?? null,
      recommended_track: d.recommended_track ?? null,
      priority:          d.priority,
      severity:          d.severity,
      responsible_party: d.responsible_party ?? null,
      owner_id:          d.owner_id ?? null,
      due_date:          d.due_date ?? null,
      evidence_event_ids: d.evidence_event_ids,
      lms_course:        d.lms_course ?? null,
    },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string; data?: { id: string } } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  // Look up drill_id from aar_report for revalidation
  const { data: aar } = await supabase
    .from('aar_reports')
    .select('drill_id')
    .eq('id', d.aar_report_id)
    .single()

  if (aar?.drill_id) revalidatePath(`/drill/aar/${aar.drill_id}`)
  return ok({ id: res?.data?.id ?? '' })
}

// ── Assign LMS course to a finding ───────────────────────────────────────────

export async function assignLMSCourseAction(
  payload: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role, userId } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = assignLmsCourseSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const d = parsed.data
  const supabase = await createClient()

  // Look up drill_id from finding → aar_report
  const { data: action } = await supabase
    .from('improvement_actions')
    .select('aar_report_id')
    .eq('id', d.finding_id)
    .single()

  let drillId: string | null = null
  if (action?.aar_report_id) {
    const { data: aar } = await supabase
      .from('aar_reports')
      .select('drill_id')
      .eq('id', action.aar_report_id)
      .single()
    drillId = aar?.drill_id ?? null
  }

  const { data: inserted, error } = await supabase
    .from('lms_assignments')
    .insert({
      finding_id:  d.finding_id,
      course_code: d.lms_course,
      assignee_id: d.assignee_id ?? null,
      assigned_by: userId,
      deadline:    d.deadline ?? null,
      notes:       d.notes ?? null,
      drill_id:    drillId,
    })
    .select('id')
    .single()

  if (error || !inserted) return fail('database_error', error?.message ?? 'insert failed')

  if (drillId) revalidatePath(`/drill/aar/${drillId}`)
  return ok({ id: inserted.id })
}

// ── Close / resolve an improvement action ────────────────────────────────────

export async function closeImprovementActionAction(
  actionId: string,
  status: 'resolved' | 'closed' | 'cancelled' = 'resolved'
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('close_improvement_action', {
    payload: { action_id: actionId, status },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  // Lookup drill_id for revalidation
  const { data: action } = await supabase
    .from('improvement_actions')
    .select('aar_report_id')
    .eq('id', actionId)
    .single()

  if (action?.aar_report_id) {
    const { data: aar } = await supabase
      .from('aar_reports')
      .select('drill_id')
      .eq('id', action.aar_report_id)
      .single()
    if (aar?.drill_id) revalidatePath(`/drill/aar/${aar.drill_id}`)
  }

  return ok(true as const)
}

// ── Propose SOP update ────────────────────────────────────────────────────────

export async function proposeSopUpdateAction(
  payload: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = proposeSopUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('propose_sop_update', {
    payload: {
      drill_id:      d.drill_id,
      aar_report_id: d.aar_report_id ?? null,
      finding_id:    d.finding_id ?? null,
      sop_code:      d.sop_code ?? null,
      title:         d.title,
      description:   d.description,
      change_type:   d.change_type,
      priority:      d.priority,
    },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string; data?: { id: string } } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  revalidatePath(`/drill/aar/${d.drill_id}`)
  return ok({ id: res?.data?.id ?? '' })
}

// ── Submit to Scenario Bank ───────────────────────────────────────────────────

export async function submitScenarioBankUpdateAction(
  payload: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const { role, userId } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller'].includes(role)) {
    return fail('forbidden', 'ต้องมีสิทธิ์ Evaluator, Commander หรือ Admin')
  }

  const parsed = scenarioBankUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const d = parsed.data
  const supabase = await createClient()

  const { data: inserted, error } = await supabase
    .from('scenario_bank_updates')
    .insert({
      drill_id:        d.drill_id,
      aar_report_id:   d.aar_report_id ?? null,
      title:           d.title,
      summary:         d.summary ?? null,
      lessons_learned: d.lessons_learned ?? null,
      difficulty_adj:  d.difficulty_adj ?? null,
      finding_codes:   d.finding_codes,
      submitted_by:    userId,
      status:          'submitted',
    })
    .select('id')
    .single()

  if (error || !inserted) return fail('database_error', error?.message ?? 'insert failed')

  revalidatePath(`/drill/aar/${d.drill_id}`)
  return ok({ id: inserted.id })
}

// ── Legacy: assign LMS (old path via iodp_aar_findings) ──────────────────────

export async function assignLmsCourseActionV2(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = assignLmsCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message)
  }

  const d = parsed.data
  const supabase = await createClient()
  const { error } = await supabase
    .from('iodp_aar_findings')
    .update({ lms_course: d.lms_course, lms_deadline: d.deadline ?? null })
    .eq('id', d.finding_id)
  if (error) return fail('database_error', error.message)

  await logEvent({
    eventType: 'lms_course_assigned',
    title: `กำหนดหลักสูตร LMS: ${d.lms_course}`,
    severity: 'info',
    mode: 'drill',
    userId: ctx.data.userId,
  })

  revalidatePath('/core/aar')
  return ok(true as const)
}
