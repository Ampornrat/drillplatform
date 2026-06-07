/**
 * iap.service.ts — Incident Action Plan.
 * IAP data is stored in drills.objectives + drills.scenario (JSONB) until
 * a dedicated iap_versions table is added. This service maps that shape to IAPVersion.
 */
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { IAPVersion } from '@/contracts/op.contract'

export async function getIAPForDrill(drillId: string): Promise<ServiceResult<IAPVersion>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drills')
    .select('id, objectives, start_date, end_date, created_by, created_at')
    .eq('id', drillId)
    .single()
  if (error || !data) return fail('not_found', 'ไม่พบข้อมูล Drill')

  return ok({
    id: data.id,
    drill_id: data.id,
    version: 1,
    objectives: (data.objectives as string[] | null) ?? [],
    period_start: data.start_date,
    period_end: data.end_date,
    created_by: data.created_by ?? '',
    created_at: data.created_at,
    notes: null,
  })
}

export async function updateIAP(params: {
  drillId: string
  objectives: string[]
  period_start?: string | null
  period_end?: string | null
}): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('drills')
    .update({
      objectives: params.objectives,
      start_date: params.period_start ?? undefined,
      end_date: params.period_end ?? undefined,
    })
    .eq('id', params.drillId)
  if (error) return fail('database_error', error.message)
  return ok(true as const)
}
