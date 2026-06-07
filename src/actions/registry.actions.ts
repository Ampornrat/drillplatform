'use server'

import { revalidatePath } from 'next/cache'
import { resolveUserContext } from '@/services/context.service'
import { logEvent } from '@/services/event.service'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'
import { addStandardSchema, addRegistryItemSchema } from '@/contracts/schemas'

export async function addStandardActionV2(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = addStandardSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('standards_registry')
    .insert({
      code: d.code,
      title: d.title,
      category: d.category,
      version: d.version,
      content: d.content ?? null,
      effective_date: d.effective_date ?? null,
      is_active: true,
      created_by: ctx.data.userId,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')

  await logEvent({
    eventType: 'standard_added',
    title: `เพิ่มมาตรฐาน: ${d.code} — ${d.title}`,
    severity: 'info',
    mode: 'drill',
    userId: ctx.data.userId,
  })

  revalidatePath('/core/standards')
  revalidatePath('/dashboard')
  return ok({ id: data.id })
}

export async function addRegistryItemActionV2(
  formData: FormData
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = addRegistryItemSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  const d = parsed.data
  const orgId = (raw.organization_id as string) || null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('master_registry')
    .insert({
      type: d.type,
      name: d.name,
      code: d.code,
      organization_id: orgId === 'none' || !orgId ? null : orgId,
      data: {},
      created_by: ctx.data.userId,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')

  await logEvent({
    eventType: 'registry_item_added',
    title: `เพิ่มรายการ Registry: ${d.code} — ${d.name}`,
    severity: 'info',
    mode: 'drill',
    userId: ctx.data.userId,
  })

  revalidatePath('/core/master-registry')
  return ok({ id: data.id })
}
