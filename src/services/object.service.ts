import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  ObjectRegistryItem,
  ObjectRegistryPage,
  ObjectListFilters,
  LifecycleEvent,
  CapabilityItem,
} from '@/contracts/registry.contract'

// ── Registry list (paginated, filtered) ──────────────────────────

export async function getObjectRegistry(
  filters: ObjectListFilters = {}
): Promise<ServiceResult<ObjectRegistryPage>> {
  const supabase = await createClient()
  const { search, type, status, minReadiness, capability, page = 1, pageSize = 20 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from('object_registry')
    .select('*', { count: 'exact' })

  if (search) {
    q = q.or(`object_code.ilike.%${search}%,name.ilike.%${search}%`)
  }
  if (type)  q = q.eq('type', type)
  if (status) q = q.eq('status', status)
  if (minReadiness != null) q = q.gte('readiness', minReadiness)
  if (capability) q = q.contains('capability', [capability])

  q = q.order('updated_at', { ascending: false }).range(from, to)

  const { data, error, count } = await q
  if (error) return fail('database_error', error.message)

  return ok({
    items: (data ?? []) as unknown as ObjectRegistryItem[],
    total: count ?? 0,
    page,
    pageSize,
  })
}

// ── Single object ────────────────────────────────────────────────

export async function getObjectById(
  id: string
): Promise<ServiceResult<ObjectRegistryItem>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('object_registry')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return fail(error.code === 'PGRST116' ? 'not_found' : 'database_error', error.message)
  return ok(data as unknown as ObjectRegistryItem)
}

// ── Lifecycle events ─────────────────────────────────────────────

export async function getLifecycleEvents(
  objectId: string
): Promise<ServiceResult<LifecycleEvent[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lifecycle_events')
    .select('*')
    .eq('object_id', objectId)
    .order('occurred_at', { ascending: false })
    .limit(100)
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as LifecycleEvent[])
}

// ── Capabilities ─────────────────────────────────────────────────

export async function getCapabilities(): Promise<ServiceResult<CapabilityItem[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('capability_registry')
    .select('id, code, name, category, description, is_active')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as CapabilityItem[])
}
