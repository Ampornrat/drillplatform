import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { MSELInject } from '@/contracts/drill.contract'

export async function getInjects(sessionId: string): Promise<ServiceResult<MSELInject[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iodp_injects')
    .select('*')
    .eq('session_id', sessionId)
    .order('scheduled_at', { ascending: true, nullsFirst: true })
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(i => ({
    id: i.id,
    session_id: i.session_id,
    inject_code: i.inject_code,
    title: i.title,
    description: i.description,
    type: i.type,
    status: i.status as MSELInject['status'],
    severity: (i.severity ?? 'info') as MSELInject['severity'],
    target_team: i.target_team,
    expected_action: i.expected_action,
    scheduled_at: i.scheduled_at,
    pushed_at: i.pushed_at,
  })))
}

export async function pushInject(params: {
  sessionId: string
  injectCode: string
  title: string
  description?: string | null
  type: string
  targetTeam?: string | null
  severity?: MSELInject['severity']
  expectedAction?: string | null
}): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iodp_injects')
    .insert({
      session_id: params.sessionId,
      inject_code: params.injectCode,
      title: params.title,
      description: params.description ?? null,
      type: params.type,
      status: 'pushed',
      target_team: params.targetTeam ?? null,
      severity: params.severity ?? 'info',
      expected_action: params.expectedAction ?? null,
      pushed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')
  return ok({ id: data.id })
}
