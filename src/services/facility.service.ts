import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { FacilityStatusFull } from '@/contracts/op.contract'

export async function getFacilitiesForDrill(
  drillId: string
): Promise<ServiceResult<FacilityStatusFull[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_facility_latest_status')
    .select('*')
    .eq('drill_id', drillId)
    .order('site_code')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as FacilityStatusFull[])
}


export async function getFacilitySitesForDrill(drillId: string): Promise<
  ServiceResult<{ id: string; site_code: string; name: string | null; type: string }[]>
> {
  const supabase = await createClient()
  const { data: sessions, error: sessErr } = await supabase
    .from('iodp_sessions')
    .select('id')
    .eq('drill_id', drillId)
  if (sessErr) return fail('database_error', sessErr.message)
  const sessionIds = (sessions ?? []).map(s => s.id)
  if (sessionIds.length === 0) return ok([])
  const { data, error } = await supabase
    .from('iodp_sites')
    .select('id, site_code, name, type')
    .in('session_id', sessionIds)
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as { id: string; site_code: string; name: string | null; type: string }[])
}

