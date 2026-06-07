import { redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import {
  getDrillDashboardSummary,
  getScenarioInstances,
  getMselInjects,
  getExerciseTeams,
  getControllersEvaluators,
} from '@/services/scenario.service'
import { DrillDashboard } from './drill-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Drill Dashboard' }

export default async function DrillDashboardPage({
  params,
}: {
  params: Promise<{ drillId: string }>
}) {
  const { drillId } = await params

  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')

  const [summaryResult, scenariosResult, teamsResult, ceResult] = await Promise.all([
    getDrillDashboardSummary(drillId),
    getScenarioInstances(drillId),
    getExerciseTeams(drillId),
    getControllersEvaluators(drillId),
  ])

  const summary = summaryResult.ok ? summaryResult.data : null
  const scenarios = scenariosResult.ok ? scenariosResult.data : []
  const teams = teamsResult.ok ? teamsResult.data : []
  const controllers = ceResult.ok ? ceResult.data : []

  // Fetch injects for active scenario if present
  const activeScenarioId = summary?.active_scenario_id ?? null
  const injectsResult = activeScenarioId ? await getMselInjects(activeScenarioId) : null
  const injects = injectsResult?.ok ? injectsResult.data : []

  return (
    <DrillDashboard
      drillId={drillId}
      summary={summary}
      scenarios={scenarios}
      injects={injects}
      teams={teams}
      controllers={controllers}
      userRole={ctxResult.data.role}
    />
  )
}
