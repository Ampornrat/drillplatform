import { notFound, redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import { getObjectById, getLifecycleEvents, getCapabilities } from '@/services/object.service'
import { getStandards } from '@/services/registry.service'
import { ObjectPassport } from './object-passport'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ objectId: string }>
}): Promise<Metadata> {
  const { objectId } = await params
  const result = await getObjectById(objectId)
  if (!result.ok) return { title: 'Object Passport' }
  return { title: `${result.data.object_code} — Object Passport` }
}

export default async function ObjectPassportPage({
  params,
}: {
  params: Promise<{ objectId: string }>
}) {
  const { objectId } = await params

  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')

  const [objResult, lifecycleResult, capsResult, stdResult] = await Promise.all([
    getObjectById(objectId),
    getLifecycleEvents(objectId),
    getCapabilities(),
    getStandards(),
  ])

  if (!objResult.ok) notFound()

  const lifecycle = lifecycleResult.ok ? lifecycleResult.data : []
  const capabilities = capsResult.ok ? capsResult.data : []
  const standards = stdResult.ok ? stdResult.data : []

  return (
    <ObjectPassport
      initialObject={objResult.data}
      initialLifecycle={lifecycle}
      capabilities={capabilities}
      standards={standards}
      userRole={ctxResult.data.role}
    />
  )
}
