import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { TransportObject, PatientTrack, PatientMovementRow } from '@/contracts/op.contract'

export async function getTransportObjects(
  drillId: string
): Promise<ServiceResult<TransportObject[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('object_registry')
    .select('id, object_code, name, type, capability, status, readiness, assigned_patient_id, lat, lng')
    .eq('drill_id', drillId)
    .order('type')
    .order('name')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as TransportObject[])
}

export async function getPatientTracksForDrill(
  drillId: string
): Promise<ServiceResult<PatientTrack[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patient_tracks')
    .select('*')
    .eq('drill_id', drillId)
    .order('triage_level')
    .order('patient_code')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as PatientTrack[])
}

export async function getPatientMovementsForDrill(
  drillId: string
): Promise<ServiceResult<PatientMovementRow[]>> {
  const supabase = await createClient()

  // Get session IDs for this drill to filter patients
  const { data: sessions } = await supabase
    .from('iodp_sessions')
    .select('id')
    .eq('drill_id', drillId)
  const sessionIds = (sessions ?? []).map(s => s.id)
  if (sessionIds.length === 0) return ok([])

  // Get patients in those sessions
  const { data: patients } = await supabase
    .from('iodp_patients')
    .select('id, patient_code')
    .in('session_id', sessionIds)
  const patientMap = new Map((patients ?? []).map(p => [p.id, p.patient_code]))
  const patientIds = [...patientMap.keys()]
  if (patientIds.length === 0) return ok([])

  // Get movements for those patients
  const { data, error } = await supabase
    .from('patient_movements')
    .select('id, patient_id, transport_mode, moved_at, notes, from_site_id, to_site_id')
    .in('patient_id', patientIds)
    .order('moved_at', { ascending: false })
    .limit(100)
  if (error) return fail('database_error', error.message)

  // Get site names for all referenced sites
  const siteIds = [
    ...(data ?? []).map(r => r.from_site_id).filter(Boolean),
    ...(data ?? []).map(r => r.to_site_id).filter(Boolean),
  ] as string[]
  const { data: sites } = siteIds.length > 0
    ? await supabase.from('iodp_sites').select('id, name').in('id', siteIds)
    : { data: [] }
  const siteMap = new Map((sites ?? []).map(s => [s.id, s.name]))

  return ok(
    (data ?? []).map(row => ({
      id: row.id,
      patient_id: row.patient_id,
      patient_code: patientMap.get(row.patient_id) ?? row.patient_id,
      from_site_name: row.from_site_id ? (siteMap.get(row.from_site_id) ?? null) : null,
      to_site_name: row.to_site_id ? (siteMap.get(row.to_site_id) ?? null) : null,
      transport_mode: row.transport_mode,
      moved_at: row.moved_at,
      notes: row.notes,
    })) as PatientMovementRow[]
  )
}

export async function seedTransportObjects(
  drillId: string,
  objects: Omit<TransportObject, 'id' | 'assigned_patient_id'>[]
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const rows = objects.map(o => ({ ...o, drill_id: drillId }))
  const { error } = await supabase.from('object_registry').upsert(rows, {
    onConflict: 'drill_id,object_code',
    ignoreDuplicates: true,
  })
  if (error) return fail('database_error', error.message)
  return ok(true as const)
}
