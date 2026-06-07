import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { EventLogItem } from '@/contracts/common.contract'
import type { DrillMode, EventSeverity } from '@/contracts/common.contract'

export async function getEvents(params?: {
  drillId?: string
  severity?: EventSeverity
  limit?: number
}): Promise<ServiceResult<EventLogItem[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('event_log')
    .select('id, event_type, mode, drill_id, user_id, severity, title, description, timestamp')
    .order('timestamp', { ascending: false })
    .limit(params?.limit ?? 50)

  if (params?.drillId) q = q.eq('drill_id', params.drillId)
  if (params?.severity) q = q.eq('severity', params.severity)

  const { data, error } = await q
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as EventLogItem[])
}

export async function logEvent(params: {
  eventType: string
  title: string
  description?: string | null
  severity?: EventSeverity
  mode: DrillMode
  drillId?: string | null
  userId: string
}): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_log')
    .insert({
      event_type: params.eventType,
      title: params.title,
      description: params.description ?? null,
      severity: params.severity ?? 'info',
      mode: params.mode,
      drill_id: params.drillId ?? null,
      user_id: params.userId,
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')
  return ok({ id: data.id })
}
