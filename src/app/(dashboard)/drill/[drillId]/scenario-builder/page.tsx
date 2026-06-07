import { redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import { getScenarioTemplates, getCasualtyArchetypes, getScenarioInstances } from '@/services/scenario.service'
import { ScenarioBuilderClient } from './scenario-builder-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scenario Builder' }

export default async function ScenarioBuilderPage({
  params,
}: {
  params: Promise<{ drillId: string }>
}) {
  const { drillId } = await params

  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')

  const { role } = ctxResult.data
  if (!['admin', 'commander'].includes(role)) redirect('/dashboard')

  const [templatesResult, archetypesResult, scenariosResult] = await Promise.all([
    getScenarioTemplates(),
    getCasualtyArchetypes(),
    getScenarioInstances(drillId),
  ])

  return (
    <ScenarioBuilderClient
      drillId={drillId}
      templates={templatesResult.ok ? templatesResult.data : []}
      archetypes={archetypesResult.ok ? archetypesResult.data : []}
      existingScenarios={scenariosResult.ok ? scenariosResult.data : []}
    />
  )
}
