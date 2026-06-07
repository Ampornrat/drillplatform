'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type EventCallback = (e: { severity: string; title: string; body: string }) => void

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const EVENT_TOASTS: Record<string, { severity: string; mkBody: (r: any) => string }> = {
  INCIDENT_CREATED:      { severity: 'info',     mkBody: r => `เปิดเหตุใหม่ · ${r.title ?? ''}` },
  IAP_APPROVED:          { severity: 'info',     mkBody: r => `IAP อนุมัติแล้ว · ${r.description ?? ''}` },
  DISPATCH_ASSIGNED:     { severity: 'info',     mkBody: r => `ส่งกำลัง · ${r.description ?? ''}` },
  TEAM_ON_SCENE:         { severity: 'info',     mkBody: r => `ทีมถึงหน้างาน · ${r.description ?? ''}` },
  PATIENT_TRIAGED:       { severity: 'info',     mkBody: r => `คัดแยกผู้ป่วย · ${r.description ?? ''}` },
  FACILITY_DIVERSION:    { severity: 'warning',  mkBody: r => `รพ. เบี่ยงผู้ป่วย · ${r.description ?? ''}` },
  SAFETY_GATE_VIOLATION: { severity: 'critical', mkBody: r => `ละเมิดด่านความปลอดภัย · ${r.description ?? ''}` },
  RESOURCE_REQUESTED:    { severity: 'info',     mkBody: r => `ขอทรัพยากร · ${r.description ?? ''}` },
}

export type OpSummary = {
  drill_id: string; title: string; mode: string; status: string
  location: string | null; organization_id: string | null; organization_name: string | null
  participant_count: number; total_events: number; critical_events: number
  last_event_at: string | null; gates_passed: number; gates_blocking_total: number; active_resources: number
}

export type PatientCounts = { p1: number; p2: number; p3: number; black: number; total: number }

export type CopMarker = {
  session_id: string; marker_type: 'site' | 'team' | 'patient'
  marker_id: string; code: string; name: string; sub_type: string
  status: string; lat: number | null; lng: number | null
  triage_level: string | null; current_load: number | null; capacity: number | null
}

export type IapInfo = {
  id: string; version: number; approved: boolean
  period_start: string | null; period_end: string | null; approved_at: string | null
}

export type SessionInfo = {
  id: string; code: string; title_th: string; status: string
  scenario_type: string | null; op_period: string | null
  center_lat: number | null; center_lng: number | null
  meta: Record<string, any> | null
}

export type OpEvent = {
  id: string; time: string; code: string; actor: string | null
  target: string; severity: string; flagged?: boolean
}
export type OpGate = { id: string; code: string; title: string; status: string; note: string | null }
export type OpResource = {
  id: string; resource_name: string | null; resource_type: string | null
  resource_code: string | null; assigned_to: string | null; location: string | null
  priority: string; status: string; duration_minutes: number
}
export type OpFacility = {
  site_code: string; site_name: string; status: string
  current_load: number; capacity: number; load_pct: number
}
export type OpNotification = {
  id: string; type: string; title: string; body: string | null
  link: string | null; read: boolean; created_at: string
}

export type OpDashboardResult = {
  summary: OpSummary | null; session: SessionInfo | null; iap: IapInfo | null
  patientCounts: PatientCounts; copMarkers: CopMarker[]
  events: OpEvent[]; gates: OpGate[]; resources: OpResource[]
  facilities: OpFacility[]; notifications: OpNotification[]
  loading: boolean; error: string | null; refresh: () => void
}

export function useOpDashboard(drillId: string | null, onEvent?: EventCallback): OpDashboardResult {
  const [summary, setSummary]     = useState<OpSummary | null>(null)
  const [session, setSession]     = useState<SessionInfo | null>(null)
  const [iap, setIap]             = useState<IapInfo | null>(null)
  const [patientCounts, setPatientCounts] = useState<PatientCounts>({ p1: 0, p2: 0, p3: 0, black: 0, total: 0 })
  const [copMarkers, setCopMarkers]       = useState<CopMarker[]>([])
  const [events, setEvents]       = useState<OpEvent[]>([])
  const [gates, setGates]         = useState<OpGate[]>([])
  const [resources, setResources] = useState<OpResource[]>([])
  const [facilities, setFacilities] = useState<OpFacility[]>([])
  const [notifications, setNotifications] = useState<OpNotification[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const unsubRef    = useRef<(() => void) | null>(null)
  const unsubPatRef = useRef<(() => void) | null>(null)
  const onEventRef  = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const fetchPatients = useCallback(async (sessionId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('iodp_patients').select('triage_level')
      .eq('session_id', sessionId).neq('status', 'deceased')
    const pts = data ?? []
    setPatientCounts({
      p1: pts.filter(p => p.triage_level === 'P1').length,
      p2: pts.filter(p => p.triage_level === 'P2').length,
      p3: pts.filter(p => p.triage_level === 'P3').length,
      black: pts.filter(p => p.triage_level === 'BLACK').length,
      total: pts.length,
    })
  }, [])

  const fetchMarkers = useCallback(async (sessionId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('v_incident_cop_markers').select('*').eq('session_id', sessionId)
    setCopMarkers((data ?? []) as CopMarker[])
  }, [])

  const subscribePatients = useCallback((sessionId: string) => {
    if (unsubPatRef.current) { unsubPatRef.current(); unsubPatRef.current = null }
    const supabase = createClient()
    const ch = supabase.channel(`op-patients:${sessionId}`)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'iodp_patients', filter: `session_id=eq.${sessionId}` },
      () => Promise.all([fetchPatients(sessionId), fetchMarkers(sessionId)])
    )
    ch.subscribe()
    unsubPatRef.current = () => supabase.removeChannel(ch)
  }, [fetchPatients, fetchMarkers])

  const fetchAll = useCallback(async (id: string) => {
    const supabase = createClient()

    // Phase 1 — all non-session queries in parallel
    const [sumRes, drillRes, evtRes, rulesRes, gateRes, rsrcRes, facRes, iapRes, notifRes] =
      await Promise.all([
        supabase.from('v_op_dashboard_summary').select('*').eq('drill_id', id).maybeSingle(),
        supabase.from('drills').select('id, organization_id').eq('id', id).maybeSingle(),
        supabase.from('event_log')
          .select('id, severity, title, timestamp, event_type, description')
          .eq('drill_id', id).order('timestamp', { ascending: false }).limit(30),
        supabase.from('safety_gate_rules')
          .select('id, name, condition_type').eq('is_active', true).order('priority'),
        supabase.from('drill_safety_gates').select('rule_id, status, notes').eq('drill_id', id),
        supabase.from('v_resource_assignment_status')
          .select('id, resource_name, resource_type, resource_code, assigned_to, location, priority, status, duration_minutes')
          .eq('drill_id', id).in('status', ['assigned', 'en_route', 'on_scene'])
          .order('assigned_at', { ascending: false }).limit(20),
        supabase.from('v_facility_latest_status')
          .select('site_code, site_name, status, current_load, capacity, load_pct')
          .eq('drill_id', id),
        supabase.from('iap_versions')
          .select('id, version, period_start, period_end, approved_by, approved_at')
          .eq('drill_id', id).order('version', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('notifications')
          .select('id, type, title, body, link, read, created_at')
          .eq('drill_id', id).eq('read', false).order('created_at', { ascending: false }).limit(10),
      ])

    if (sumRes.data) setSummary(sumRes.data as OpSummary)

    setEvents((evtRes.data ?? []).map(e => ({
      id: e.id, time: fmtTime(e.timestamp),
      code: e.event_type ?? '', actor: null,
      target: e.title ?? '', severity: e.severity ?? 'info',
      flagged: e.severity === 'critical',
    })))

    const gateMap = Object.fromEntries((gateRes.data ?? []).map(g => [g.rule_id, g]))
    setGates((rulesRes.data ?? []).map(r => ({
      id: r.id,
      code: r.condition_type ?? r.id.slice(0, 8).toUpperCase(),
      title: r.name,
      status: (gateMap[r.id] as any)?.status ?? 'pending',
      note: (gateMap[r.id] as any)?.notes ?? null,
    })))

    setResources((rsrcRes.data ?? []).map(r => ({
      id: r.id, resource_name: r.resource_name, resource_type: r.resource_type,
      resource_code: r.resource_code, assigned_to: r.assigned_to, location: r.location,
      priority: r.priority ?? 'routine', status: r.status,
      duration_minutes: Math.round(r.duration_minutes ?? 0),
    })))

    setFacilities((facRes.data ?? []).map(f => ({
      site_code: f.site_code, site_name: f.site_name,
      status: f.status ?? 'normal', current_load: f.current_load ?? 0,
      capacity: f.capacity ?? 0, load_pct: Number(f.load_pct ?? 0),
    })))

    if (iapRes.data) {
      const d = iapRes.data as any
      setIap({
        id: d.id, version: d.version ?? 1,
        approved: !!d.approved_by,
        period_start: d.period_start, period_end: d.period_end, approved_at: d.approved_at,
      })
    }

    setNotifications((notifRes.data ?? []).map(n => ({
      id: n.id, type: n.type ?? 'info', title: n.title,
      body: n.body, link: n.link, read: n.read, created_at: n.created_at,
    })))

    // Phase 2 — linked IODP session via organization_id
    const orgId = (drillRes.data as any)?.organization_id
    if (!orgId) return

    const { data: sessData } = await supabase.from('iodp_sessions')
      .select('id, code, title_th, status, scenario_type, op_period, center_lat, center_lng, meta')
      .eq('organization_id', orgId).in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!sessData) return
    setSession(sessData as SessionInfo)
    const sessionId = sessData.id

    // Phase 3 — session-dependent: patients + COP markers in parallel
    await Promise.all([fetchPatients(sessionId), fetchMarkers(sessionId)])
    subscribePatients(sessionId)
  }, [fetchPatients, fetchMarkers, subscribePatients])

  const refresh = useCallback(() => {
    if (!drillId) return
    setLoading(true)
    fetchAll(drillId).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))
  }, [drillId, fetchAll])

  useEffect(() => {
    if (!drillId) {
      setSummary(null); setSession(null); setIap(null)
      setPatientCounts({ p1: 0, p2: 0, p3: 0, black: 0, total: 0 })
      setCopMarkers([]); setEvents([]); setGates([]); setResources([]); setFacilities([]); setNotifications([])
      return
    }

    setLoading(true); setError(null)
    fetchAll(drillId).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase.channel(`op-dash:${drillId}`)

    // event_log: push new rows inline + fire named event toasts
    channel.on('postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'event_log', filter: `drill_id=eq.${drillId}` },
      (payload: any) => {
        const row = payload.new
        setEvents(prev => [{
          id: row.id, time: fmtTime(row.timestamp), code: row.event_type ?? '',
          actor: null, target: row.title ?? '', severity: row.severity ?? 'info',
          flagged: row.severity === 'critical',
        }, ...prev].slice(0, 30))
        const handler = EVENT_TOASTS[row.event_type ?? '']
        if (handler) onEventRef.current?.({ severity: handler.severity, title: row.event_type, body: handler.mkBody(row) })
      }
    )

    // Full re-fetch on dispatch / facility / gate / iap changes
    const refetch = () => fetchAll(drillId)
    channel.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'dispatch_assignments', filter: `drill_id=eq.${drillId}` }, refetch)
    channel.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'facility_status', filter: `drill_id=eq.${drillId}` }, refetch)
    channel.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'drill_safety_gates', filter: `drill_id=eq.${drillId}` }, refetch)
    channel.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'iap_versions', filter: `drill_id=eq.${drillId}` }, refetch)

    channel.subscribe()
    unsubRef.current = () => supabase.removeChannel(channel)

    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
      if (unsubPatRef.current) { unsubPatRef.current(); unsubPatRef.current = null }
    }
  }, [drillId, fetchAll])

  return {
    summary, session, iap, patientCounts, copMarkers,
    events, gates, resources, facilities, notifications,
    loading, error, refresh,
  }
}
