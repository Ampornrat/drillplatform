import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveFullContext } from '@/services/context.service'
import { createClient } from '@/lib/supabase/server'
import { TriageForm } from '@/components/field/triage-form'
import type { PatientSummary } from '@/contracts/field.contract'

export const metadata: Metadata = { title: 'Patient Triage' }

export default async function TriagePage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const supabase = await createClient()
  let patients: PatientSummary[] = []

  if (ctx.activeScenarioId) {
    const { data } = await supabase
      .from('iodp_patients')
      .select('id, patient_code, triage_level, status, site_id, destination_id, lat, lng, march_data')
      .eq('session_id', ctx.activeScenarioId)
      .order('patient_code')
      .limit(50)

    patients = (data ?? []).map(p => ({
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
    }))
  }

  return (
    <TriageForm
      patients={patients}
      drillId={ctx.activeIncidentId ?? ''}
      drillMode={ctx.activeIncidentMode ?? 'drill'}
    />
  )
}
