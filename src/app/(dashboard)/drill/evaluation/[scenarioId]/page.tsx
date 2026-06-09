import { notFound, redirect } from 'next/navigation'
import { resolveFullContext } from '@/services/context.service'
import { getEvaluationDashboard } from '@/services/evaluation.service'
import { EvaluationDashboard } from './evaluation-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Evaluation Dashboard' }

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>
}) {
  const { scenarioId } = await params

  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')

  const { role, userId, profile } = ctxResult.data
  if (!['admin', 'commander', 'controller', 'evaluator'].includes(role)) {
    redirect('/dashboard')
  }

  const dataResult = await getEvaluationDashboard(scenarioId)
  if (!dataResult.ok) notFound()

  const d = dataResult.data

  return (
    <EvaluationDashboard
      scenarioId={scenarioId}
      drillId={d.drillId}
      drillTitle={d.drillTitle}
      rules={d.rules}
      initialScores={d.scores}
      initialObservations={d.observations}
      initialTeamPerformance={d.teamPerformance}
      initialViolations={d.violations}
      initialEvents={d.events}
      initialMetricScores={d.metricScores}
      initialOverallPct={d.overallPct}
      userId={userId}
      userName={profile.full_name ?? 'ผู้ใช้'}
      userRole={role}
    />
  )
}
