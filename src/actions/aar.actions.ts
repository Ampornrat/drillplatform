'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { createAAR } from '@/services/aar.service'
import { logEvent } from '@/services/event.service'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'
import { generateAarSchema, assignLmsCourseSchema } from '@/contracts/schemas'

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
