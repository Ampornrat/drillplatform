import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveFullContext } from '@/services/context.service'
import { createClient } from '@/lib/supabase/server'
import { EvaluatorObservationForm } from '@/components/field/evaluator-observation-form'

export const metadata: Metadata = { title: 'Evaluator Observation' }

export default async function EvaluatorObservationPage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const supabase = await createClient()

  // Load active scenario sessions for this drill
  const { data: scenarios } = ctx.activeIncidentId
    ? await supabase
        .from('iodp_sessions')
        .select('id, code, title_th, status')
        .eq('drill_id', ctx.activeIncidentId)
        .in('status', ['standby', 'live', 'paused'])
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  type ScenarioRow = { id: string; code: string; title_th: string; status: string }

  return (
    <EvaluatorObservationForm
      drillId={ctx.activeIncidentId ?? ''}
      drillTitle={ctx.activeIncidentTitle ?? ''}
      scenarios={(scenarios ?? []) as ScenarioRow[]}
      defaultScenarioId={ctx.activeScenarioId ?? ''}
    />
  )
}
