import { notFound, redirect } from 'next/navigation'
import { resolveFullContext } from '@/services/context.service'
import { getControlRoomData, getObjectsForDrill } from '@/services/control.service'
import { ControlRoom } from './control-room'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Control Room' }

export default async function ControlRoomPage({
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

  const dataResult = await getControlRoomData(scenarioId)
  if (!dataResult.ok) notFound()

  const { scenario, clock, injects, deliveries, flags, recentEvents } = dataResult.data

  const resourcesResult = await getObjectsForDrill(scenario.drill_id)
  const resources = resourcesResult.ok ? resourcesResult.data : []

  return (
    <ControlRoom
      scenarioId={scenarioId}
      drillId={scenario.drill_id}
      initialData={{ scenario, clock, injects, deliveries, flags, recentEvents }}
      resources={resources}
      userId={userId}
      userName={profile.full_name ?? 'ผู้ใช้'}
      userRole={role}
    />
  )
}
