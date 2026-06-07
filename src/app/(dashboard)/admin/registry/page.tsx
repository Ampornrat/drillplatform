import { redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import { getObjectRegistry } from '@/services/object.service'
import { getCapabilities } from '@/services/object.service'
import { RegistryList } from './registry-list'
import type { Metadata } from 'next'
import type { ObjectListFilters } from '@/contracts/registry.contract'

export const metadata: Metadata = { title: 'Object Registry — Drill Platform' }

export default async function AdminRegistryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')

  const filters: ObjectListFilters = {
    search:       typeof sp.search === 'string' ? sp.search : undefined,
    type:         typeof sp.type   === 'string' ? sp.type as ObjectListFilters['type'] : undefined,
    status:       typeof sp.status === 'string' ? sp.status as ObjectListFilters['status'] : undefined,
    minReadiness: typeof sp.minReadiness === 'string' ? Number(sp.minReadiness) : undefined,
    capability:   typeof sp.cap    === 'string' ? sp.cap : undefined,
    page:         typeof sp.page   === 'string' ? Math.max(1, Number(sp.page)) : 1,
    pageSize:     20,
  }

  const [registryResult, capsResult] = await Promise.all([
    getObjectRegistry(filters),
    getCapabilities(),
  ])

  const registry = registryResult.ok ? registryResult.data : { items: [], total: 0, page: 1, pageSize: 20 }
  const capabilities = capsResult.ok ? capsResult.data : []

  return (
    <RegistryList
      initialData={registry}
      capabilities={capabilities}
      initialFilters={filters}
    />
  )
}
