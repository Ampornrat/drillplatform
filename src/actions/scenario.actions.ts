'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveFullContext } from '@/services/context.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import {
  createScenarioFromTemplateSchema,
  updateScenarioScopeSchema,
  generateCasualtiesSchema,
  createMselInjectSchema,
  lockObjectivesSchema,
  assignControllerSchema,
} from '@/contracts/schemas'

const PLANNER_ROLES = ['admin', 'commander'] as const

async function checkPlannerAccess() {
  const ctx = await resolveFullContext()
  if (!ctx.ok) return ctx
  if (!(PLANNER_ROLES as readonly string[]).includes(ctx.data.role)) {
    return fail('forbidden', 'ต้องมีบทบาท Admin หรือ Commander')
  }
  return ctx
}

// ── Create scenario from template ────────────────────────────────────────────

export async function createScenarioFromTemplateAction(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = createScenarioFromTemplateSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  // Fetch template for defaults
  const { data: tmpl } = await supabase
    .from('scenario_templates')
    .select('default_objectives, default_sites, scenario_type')
    .eq('id', d.template_id)
    .single()

  const objectives = d.objectives
    ? d.objectives.split('\n').map(s => s.trim()).filter(Boolean)
    : ((tmpl?.default_objectives as string[]) ?? [])

  const { data: inst, error: instErr } = await supabase
    .from('scenario_instances')
    .insert({
      drill_id: d.drill_id,
      template_id: d.template_id,
      title: d.title,
      description: d.description ?? null,
      scenario_type: tmpl?.scenario_type ?? 'MCI',
      objectives,
      start_offset_minutes: d.start_offset_minutes,
      duration_minutes: d.duration_minutes,
      created_by: ctx.data.userId,
    })
    .select('id')
    .single()
  if (instErr || !inst) return fail('database_error', instErr?.message ?? 'Insert failed')

  // Insert default sites from template
  const defaultSites = (tmpl?.default_sites as Array<{ site_code: string; site_name: string; role: string }>) ?? []
  if (defaultSites.length > 0) {
    await supabase.from('scenario_sites').insert(
      defaultSites.map(s => ({
        scenario_id: inst.id,
        site_code: s.site_code,
        site_name: s.site_name,
        site_type: s.role ?? 'CCP',
        role: s.role ?? null,
      }))
    )
  }

  // Platform event
  await supabase.from('platform_events').insert({
    event_type: 'SCENARIO_CREATED',
    source_type: 'scenario_instances',
    source_id: inst.id,
    severity: 'info',
    title: `Scenario สร้างแล้ว: ${d.title}`,
    actor_id: ctx.data.userId,
    drill_id: d.drill_id,
  })

  revalidatePath(`/drill/${d.drill_id}/dashboard`)
  revalidatePath(`/planner/drills/${d.drill_id}`)
  return ok({ id: inst.id })
}

// ── Update scenario scope ─────────────────────────────────────────────────────

export async function updateScenarioScopeAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = updateScenarioScopeSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('scenario_instances')
    .select('objectives_locked, drill_id')
    .eq('id', d.scenario_id)
    .single()
  if (!current) return fail('not_found', 'ไม่พบ Scenario')
  if (current.objectives_locked) return fail('forbidden', 'Objectives ถูกล็อคแล้ว ไม่สามารถแก้ไขได้')

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (d.title) updates.title = d.title
  if (d.description !== undefined) updates.description = d.description
  if (d.duration_minutes !== undefined) updates.duration_minutes = d.duration_minutes
  if (d.objectives !== undefined) {
    updates.objectives = d.objectives.split('\n').map(s => s.trim()).filter(Boolean)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('scenario_instances').update(updates as any).eq('id', d.scenario_id)
  if (error) return fail('database_error', error.message)

  revalidatePath(`/drill/${current.drill_id}/dashboard`)
  return ok(true as const)
}

// ── Generate casualties ───────────────────────────────────────────────────────

export async function generateCasualtiesAction(
  formData: FormData
): Promise<ServiceResult<{ count: number }>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = generateCasualtiesSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id, scenario_type')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  // Load archetypes by triage level
  const { data: archetypes } = await supabase
    .from('casualty_archetypes')
    .select('id, triage_level, mechanism, injuries')
    .eq('is_active', true)
  const byLevel: Record<string, typeof archetypes> = { P1: [], P2: [], P3: [], BLACK: [] }
  ;(archetypes ?? []).forEach(a => {
    const lvl = a.triage_level as string
    if (byLevel[lvl]) byLevel[lvl]!.push(a)
  })

  // Determine count per level
  const dist: Record<string, number> = {
    P1:    Math.round(d.count * d.p1_pct / 100),
    P2:    Math.round(d.count * d.p2_pct / 100),
    P3:    Math.round(d.count * d.p3_pct / 100),
    BLACK: d.count - Math.round(d.count * d.p1_pct / 100)
            - Math.round(d.count * d.p2_pct / 100)
            - Math.round(d.count * d.p3_pct / 100),
  }

  const rows: Array<Record<string, unknown>> = []
  let seq = 1
  for (const [level, cnt] of Object.entries(dist)) {
    const pool = byLevel[level] ?? []
    for (let i = 0; i < cnt; i++) {
      const archetype = pool.length > 0 ? pool[i % pool.length] : null
      rows.push({
        scenario_id:   d.scenario_id,
        archetype_id:  archetype?.id ?? null,
        patient_code:  `CAS-${String(seq).padStart(3, '0')}`,
        triage_level:  level,
        mechanism:     archetype?.mechanism ?? null,
        injuries:      archetype?.injuries ?? [],
      })
      seq++
    }
  }

  if (rows.length === 0) return ok({ count: 0 })

  // Clear old instances before re-generating
  await supabase.from('casualty_instances').delete().eq('scenario_id', d.scenario_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('casualty_instances').insert(rows as any)
  if (error) return fail('database_error', error.message)

  revalidatePath(`/drill/${scenario.drill_id}/dashboard`)
  return ok({ count: rows.length })
}

// ── Create MSEL inject ────────────────────────────────────────────────────────

export async function createMselInjectAction(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = createMselInjectSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: scenario } = await supabase
    .from('scenario_instances')
    .select('drill_id')
    .eq('id', d.scenario_id)
    .single()
  if (!scenario) return fail('not_found', 'ไม่พบ Scenario')

  const { data, error } = await supabase
    .from('msel_injects')
    .insert({
      scenario_id:     d.scenario_id,
      inject_code:     d.inject_code,
      title:           d.title,
      description:     d.description ?? null,
      inject_type:     d.inject_type,
      severity:        d.severity,
      target_team:     d.target_team ?? null,
      expected_action: d.expected_action ?? null,
      offset_minutes:  d.offset_minutes,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'Insert failed')

  revalidatePath(`/drill/${scenario.drill_id}/dashboard`)
  return ok({ id: data.id })
}

// ── Lock objectives ───────────────────────────────────────────────────────────

export async function lockObjectivesAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = lockObjectivesSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('scenario_instances')
    .select('drill_id, objectives')
    .eq('id', d.scenario_id)
    .single()
  if (!current) return fail('not_found', 'ไม่พบ Scenario')
  if ((current.objectives ?? []).length === 0) {
    return fail('validation_error', 'ต้องมีวัตถุประสงค์อย่างน้อย 1 ข้อก่อน lock')
  }

  const { error } = await supabase
    .from('scenario_instances')
    .update({ objectives_locked: true, status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', d.scenario_id)
  if (error) return fail('database_error', error.message)

  await supabase.from('platform_events').insert({
    event_type: 'SCENARIO_OBJECTIVES_LOCKED',
    source_type: 'scenario_instances',
    source_id: d.scenario_id,
    severity: 'info',
    title: 'Scenario objectives ถูกล็อคแล้ว — พร้อมเริ่มการซ้อม',
    actor_id: ctx.data.userId,
    drill_id: current.drill_id,
  })

  revalidatePath(`/drill/${current.drill_id}/dashboard`)
  return ok(true as const)
}

// ── Assign controller / evaluator ────────────────────────────────────────────

export async function assignControllerAction(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await checkPlannerAccess()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = assignControllerSchema.safeParse(raw)
  if (!parsed.success) return fail('validation_error', parsed.error.issues[0].message)

  const d = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('controllers_evaluators')
    .upsert({
      drill_id:        d.drill_id,
      user_id:         d.user_id,
      assignment_type: d.assignment_type,
      assigned_team:   d.assigned_team ?? null,
      notes:           d.notes ?? null,
    }, { onConflict: 'drill_id,user_id' })
  if (error) return fail('database_error', error.message)

  revalidatePath(`/drill/${d.drill_id}/dashboard`)
  return ok(true as const)
}
