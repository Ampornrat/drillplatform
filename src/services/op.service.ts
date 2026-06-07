import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { OpDashboardMetrics } from '@/contracts/op.contract'

export async function getDashboardMetrics(): Promise<ServiceResult<OpDashboardMetrics>> {
  const supabase = await createClient()

  const [drillsRes, eventsRes, standardsRes] = await Promise.all([
    supabase.from('drills').select('id, status'),
    supabase
      .from('event_log')
      .select('id, title, severity, timestamp')
      .order('timestamp', { ascending: false })
      .limit(5),
    supabase.from('standards_registry').select('id').eq('is_active', true),
  ])

  if (drillsRes.error) return fail('database_error', drillsRes.error.message)

  const drills = drillsRes.data ?? []
  const events = eventsRes.data ?? []

  return ok({
    totalDrills: drills.length,
    activeDrills: drills.filter(d => d.status === 'active').length,
    recentEvents: events.map(e => ({
      id: e.id,
      title: e.title,
      severity: e.severity as 'info' | 'warning' | 'critical',
      timestamp: e.timestamp,
    })),
    activeStandards: standardsRes.data?.length ?? 0,
  })
}
