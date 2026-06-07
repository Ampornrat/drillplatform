import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { ScenarioSummary } from '@/contracts/drill.contract'
import type { DrillMode } from '@/contracts/common.contract'

export async function getScenarios(
  status?: string
): Promise<ServiceResult<ScenarioSummary[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('iodp_sessions')
    .select('id, code, title_th, mode, status, scenario_type, start_time, end_time')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(s => ({
    id: s.id,
    code: s.code,
    title: s.title_th,
    mode: s.mode as DrillMode,
    status: s.status,
    scenarioType: s.scenario_type,
    startTime: s.start_time,
    endTime: s.end_time,
  })))
}
