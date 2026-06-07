import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { PatientSummary } from '@/contracts/field.contract'

export async function getPatients(sessionId: string): Promise<ServiceResult<PatientSummary[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iodp_patients')
    .select('id, patient_code, triage_level, status, site_id, destination_id, lat, lng, march_data')
    .eq('session_id', sessionId)
    .order('patient_code')
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(p => ({
    id: p.id,
    patient_code: p.patient_code,
    triage_level: p.triage_level as PatientSummary['triage_level'],
    status: p.status,
    site_id: p.site_id,
    siteName: null,
    destination_id: p.destination_id,
    march_data: (p.march_data ?? {}) as PatientSummary['march_data'],
    lat: p.lat,
    lng: p.lng,
  })))
}

export async function updatePatientTriage(params: {
  patientId: string
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK'
  status: string
  site_id?: string | null
  march_data?: PatientSummary['march_data']
}): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('iodp_patients')
    .update({
      triage_level: params.triage_level,
      status: params.status,
      site_id: params.site_id ?? undefined,
      march_data: (params.march_data ?? {}) as import('@/types/database.types').Json,
    })
    .eq('id', params.patientId)
  if (error) return fail('database_error', error.message)
  return ok(true as const)
}
