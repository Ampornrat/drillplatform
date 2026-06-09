import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { EventLogItem } from '@/contracts/common.contract'
import type { DrillMode, EventSeverity } from '@/contracts/common.contract'

const PAGE_SIZE = 50

export interface EventPage {
  items: EventLogItem[]
  nextCursor: string | null
  total: number
}

export async function getEvents(params?: {
  drillId?: string
  severity?: EventSeverity
  limit?: number
  /** ISO timestamp cursor — fetch events older than this timestamp */
  before?: string
}): Promise<ServiceResult<EventPage>> {
  const supabase = await createClient()
  const limit = params?.limit ?? PAGE_SIZE

  let q = supabase
    .from('event_log')
    .select('id, event_type, mode, drill_id, user_id, severity, title, description, timestamp', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .limit(limit + 1) // fetch one extra to determine if there's a next page

  if (params?.drillId) q = q.eq('drill_id', params.drillId)
  if (params?.severity) q = q.eq('severity', params.severity)
  if (params?.before) q = q.lt('timestamp', params.before)

  const { data, error, count } = await q
  if (error) return fail('database_error', error.message)

  const rows = (data ?? []) as EventLogItem[]
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].timestamp ?? null : null

  return ok({ items, nextCursor, total: count ?? items.length })
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
