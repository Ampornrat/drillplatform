'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CopMarker } from './use-op-dashboard'

export type RegistryResource = {
  id: string; type: string; name: string; code: string
  organization_id: string | null
  capability: string | null; readiness: number; location_text: string | null
  data: Record<string, any>
  active_assignment_id: string | null; assignment_status: string | null
}

export type TaskForce = {
  id: string; drill_id: string; name: string; capability: string | null
  destination: string | null; member_ids: string[]; status: string; priority: string
  created_at: string
}

export type DispatchAssignment = {
  id: string; drill_id: string; resource_id: string | null
  resource_name: string | null; resource_code: string | null; resource_type: string | null
  assigned_to: string; location: string | null; priority: string
  status: string; notes: string | null; assigned_at: string
}

export type CopGate = { id: string; code: string; title: string; status: string; note: string | null }
export type CopSite = { id: string; code: string; name: string; type: string; lat: number | null; lng: number | null }

export type CopDispatchResult = {
  resources: RegistryResource[]
  taskForces: TaskForce[]
  assignments: DispatchAssignment[]
  gates: CopGate[]
  copMarkers: CopMarker[]
  sites: CopSite[]
  loading: boolean; error: string | null; refresh: () => void
}

export function useCopDispatch(drillId: string | null): CopDispatchResult {
  const [resources, setResources]   = useState<RegistryResource[]>([])
  const [taskForces, setTaskForces] = useState<TaskForce[]>([])
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([])
  const [gates, setGates]           = useState<CopGate[]>([])
  const [copMarkers, setCopMarkers] = useState<CopMarker[]>([])
  const [sites, setSites]           = useState<CopSite[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const unsubRef                    = useRef<(() => void) | null>(null)

  const fetchAll = useCallback(async (id: string) => {
    const supabase = createClient()

    // Phase 1: parallel
    const [resRes, tfRes, assignRes, rulesRes, gateRes, drillRes] = await Promise.all([
      supabase.from('master_registry').select('*').eq('is_active', true).order('code'),
      supabase.from('task_forces').select('*').eq('drill_id', id).order('created_at', { ascending: false }),
      supabase.from('dispatch_assignments')
        .select('id, drill_id, resource_id, assigned_to, location, priority, status, notes, assigned_at, master_registry(name, code, type)')
        .eq('drill_id', id)
        .not('status', 'in', '(released)')
        .order('assigned_at', { ascending: false }),
      supabase.from('safety_gate_rules').select('id, name, condition_type').eq('is_active', true).order('priority'),
      supabase.from('drill_safety_gates').select('rule_id, status, notes').eq('drill_id', id),
      supabase.from('drills').select('organization_id').eq('id', id).maybeSingle(),
    ])

    // Build active assignment map: resource_id → assignment
    const activeAssignMap: Record<string, { id: string; status: string }> = {}
    for (const a of assignRes.data ?? []) {
      if (a.resource_id && !activeAssignMap[a.resource_id]) {
        activeAssignMap[a.resource_id] = { id: a.id, status: a.status }
      }
    }

    setResources((resRes.data ?? []).map(r => ({
      id: r.id, type: r.type, name: r.name, code: r.code,
      organization_id: r.organization_id,
      capability: (r.data as any)?.capability ?? null,
      readiness: Number((r.data as any)?.readiness ?? 100),
      location_text: (r.data as any)?.location ?? null,
      data: r.data as Record<string, any>,
      active_assignment_id: activeAssignMap[r.id]?.id ?? null,
      assignment_status: activeAssignMap[r.id]?.status ?? null,
    })))

    setTaskForces((tfRes.data ?? []).map(tf => ({
      ...tf,
      member_ids: Array.isArray(tf.member_ids) ? tf.member_ids : (tf.member_ids as any) ?? [],
    })) as TaskForce[])

    setAssignments((assignRes.data ?? []).map((a: any) => ({
      id: a.id, drill_id: a.drill_id, resource_id: a.resource_id,
      resource_name: a.master_registry?.name ?? null,
      resource_code: a.master_registry?.code ?? null,
      resource_type: a.master_registry?.type ?? null,
      assigned_to: a.assigned_to, location: a.location,
      priority: a.priority ?? 'routine', status: a.status,
      notes: a.notes, assigned_at: a.assigned_at,
    })))

    const gateMap = Object.fromEntries((gateRes.data ?? []).map(g => [g.rule_id, g]))
    setGates((rulesRes.data ?? []).map(r => ({
      id: r.id, code: r.condition_type ?? r.id.slice(0, 8).toUpperCase(),
      title: r.name, status: (gateMap[r.id] as any)?.status ?? 'pending',
      note: (gateMap[r.id] as any)?.notes ?? null,
    })))

    // Phase 2: IODP session → sites + cop markers
    const orgId = (drillRes.data as any)?.organization_id
    if (!orgId) return

    const { data: sessData } = await supabase
      .from('iodp_sessions').select('id')
      .eq('organization_id', orgId).in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!sessData) return
    const sessionId = sessData.id

    const [sitesRes, markersRes] = await Promise.all([
      supabase.from('iodp_sites').select('id, site_code, name, type, lat, lng').eq('session_id', sessionId),
      supabase.from('v_incident_cop_markers').select('*').eq('session_id', sessionId),
    ])

    setSites((sitesRes.data ?? []).map(s => ({
      id: s.id, code: s.site_code, name: s.name, type: s.type, lat: s.lat ?? null, lng: s.lng ?? null,
    })))
    setCopMarkers((markersRes.data ?? []) as CopMarker[])
  }, [])

  const refresh = useCallback(() => {
    if (!drillId) return
    setLoading(true)
    fetchAll(drillId).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))
  }, [drillId, fetchAll])

  useEffect(() => {
    if (!drillId) {
      setResources([]); setTaskForces([]); setAssignments([]); setGates([]); setCopMarkers([]); setSites([])
      return
    }
    setLoading(true); setError(null)
    fetchAll(drillId).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))

    const supabase = createClient()
    const ch = supabase.channel(`cop-dispatch:${drillId}`)
    const refetch = () => fetchAll(drillId)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'dispatch_assignments', filter: `drill_id=eq.${drillId}` }, refetch)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'task_forces', filter: `drill_id=eq.${drillId}` }, refetch)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'drill_safety_gates', filter: `drill_id=eq.${drillId}` }, refetch)
    ch.subscribe()
    unsubRef.current = () => supabase.removeChannel(ch)
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [drillId, fetchAll])

  return { resources, taskForces, assignments, gates, copMarkers, sites, loading, error, refresh }
}
