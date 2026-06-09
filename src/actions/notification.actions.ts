'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveUserContext } from '@/services/context.service'
import { ok, fail, type ServiceResult } from '@/lib/result'

export async function markNotificationReadAction(
  notificationId: string
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mark_notification_read', {
    payload: { notification_id: notificationId },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  revalidatePath('/', 'layout')
  return ok(true as const)
}

export async function markAllNotificationsReadAction(
  drillId?: string
): Promise<ServiceResult<{ updated: number }>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mark_all_notifications_read', {
    payload: { drill_id: drillId ?? null },
  })

  if (error) return fail('database_error', error.message)
  const res = data as { error?: string; message?: string; data?: { updated: number } } | null
  if (res?.error) return fail('database_error', res.message ?? res.error)

  revalidatePath('/', 'layout')
  return ok({ updated: res?.data?.updated ?? 0 })
}
