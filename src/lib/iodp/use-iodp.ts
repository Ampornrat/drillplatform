'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DEMO_DATA } from './demo-data'
import { fetchSessions, fetchSessionData, insertEvent, updateSafetyGate, pushInject as dbPushInject, acknowledgeInject as dbAckInject, subscribeToSession } from './supabase'
import type { IodpSession, IodpSite, IodpTeam, IodpPatient, IodpEvent, IodpSafetyGate, IodpInject, IodpAarFinding } from './types'

type DbData = {
  sites: IodpSite[]
  teams: IodpTeam[]
  patients: IodpPatient[]
  events: IodpEvent[]
  gates: IodpSafetyGate[]
  injects: IodpInject[]
  aarFindings: IodpAarFinding[]
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return 'T+00:00'
  const d = new Date(iso)
  return 'T+' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function transformSites(sites: IodpSite[]) {
  return sites.map(s => ({
    id: s.site_code,
    name: s.name ?? s.site_code,
    name_en: s.meta?.name_en,
    lat: s.lat,
    lng: s.lng,
    type: s.type,
    status: s.status ?? 'active',
    patients: s.current_load,
    zone: s.meta?.zone,
    hazard: s.meta?.hazard,
    safety: s.meta?.safety,
    // facility fields
    role: s.meta?.role,
    name_th: s.name ?? s.site_code,
    beds: s.current_load,
    beds_total: s.capacity ?? 0,
    icu: s.meta?.icu ?? 0,
    icu_total: s.meta?.icu_total ?? 0,
    or: s.meta?.or_count ?? 0,
    or_total: s.meta?.or_total ?? 0,
    blood: s.meta?.blood ?? 'ok',
    oxygen: s.meta?.oxygen ?? 'ok',
    inbound: s.meta?.inbound ?? 0,
  }))
}

function transformTeams(teams: IodpTeam[]) {
  return teams.map(t => ({
    id: t.team_code,
    db_id: t.id,
    code: t.name,
    type: t.meta?.team_type ?? t.type ?? 'unit',
    capability: t.meta?.capability ?? '',
    readiness: t.readiness,
    status: t.status,
    site: t.meta?.site_code ?? '',
    org: t.meta?.org ?? '',
    lat: t.lat,
    lng: t.lng,
    personnel: t.personnel,
  }))
}

function transformPatients(patients: IodpPatient[]) {
  return patients
    .filter(p => p.lat !== null && p.lng !== null)
    .map(p => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      lvl: (p.triage_level ?? 'p3').toLowerCase(),
      status: p.status,
      patient_code: p.patient_code,
    }))
}

function transformEvents(events: IodpEvent[]) {
  return events.map(e => ({
    id: e.id,
    time: fmtTime(e.occurred_at),
    code: e.event_code,
    actor: e.actor ?? '',
    target: e.target ?? e.description ?? '',
    severity: e.severity,
    flagged: e.flagged,
  }))
}

function transformGates(gates: IodpSafetyGate[]) {
  return gates.map(g => ({
    id: g.id,
    code: g.gate_code,
    title: g.name,
    status: g.status,
    approved_by: g.checked_by,
    approved_at: g.checked_at ? fmtTime(g.checked_at) : null,
    severity: ['failed', 'critical'].includes(g.status) ? 'critical' : 'warning',
    note: g.notes,
  }))
}

function transformInjects(injects: IodpInject[]) {
  return injects.map(i => ({
    id: i.id,
    inject_code: i.inject_code,
    t: fmtTime(i.scheduled_at),
    type: i.type,
    title: i.title,
    target: i.target_team ?? '',
    status: i.status,
    expected: i.expected_action ?? '',
    severity: i.severity,
  }))
}

function transformAar(findings: IodpAarFinding[]) {
  return findings.map(f => ({
    id: f.finding_code,
    type: f.category ?? f.severity,
    severity: f.severity,
    title: f.title,
    summary: f.description ?? '',
    cause: '',
    recommendation: '',
    lms: f.lms_course ? { course: f.lms_course, title: f.lms_deadline ?? '' } : undefined,
  }))
}

function computeMetricsOp(patients: IodpPatient[], teams: IodpTeam[], sites: IodpSite[], gates: IodpSafetyGate[]) {
  const p1 = patients.filter(p => p.triage_level === 'P1').length
  const p2 = patients.filter(p => p.triage_level === 'P2').length
  const p3 = patients.filter(p => p.triage_level === 'P3').length
  const black = patients.filter(p => p.triage_level === 'BLACK').length
  const total = p1 + p2 + p3 + black
  const activeTeams = teams.filter(t => t.status !== 'available').length
  const enRoute = teams.filter(t => t.status === 'en_route').length
  const onScene = teams.filter(t => t.status === 'on_scene').length
  const diverts = sites.filter(s => s.type === 'facility' && s.status === 'divert').length
  const divertNames = sites.filter(s => s.type === 'facility' && s.status === 'divert').map(s => s.name ?? s.site_code).join(' · ')
  const critGates = gates.filter(g => g.status === 'failed' || g.status === 'critical').length
  const activeSites = sites.filter(s => s.status === 'active').length

  return [
    { label: 'ผู้ป่วยที่ปฏิบัติการ', value: total, unit: '', footer: `P1 ${p1} · P2 ${p2} · P3 ${p3} · ⬛ ${black}`, tone: '' },
    { label: 'ทีมที่ส่ง', value: activeTeams, unit: `/ ${teams.length}`, footer: `กำลังเดินทาง ${enRoute} · ถึงที่เกิดเหตุ ${onScene}`, tone: '' },
    { label: 'สถานะ รพ.', value: diverts, unit: 'เบี่ยง', tone: diverts > 0 ? 'warn' : 'ok', footer: divertNames || 'ทุก รพ. พร้อมรับ' },
    { label: 'ด่านความปลอดภัย', value: critGates, unit: critGates > 0 ? 'วิกฤต' : 'ผ่านแล้ว', tone: critGates > 0 ? 'critical' : 'ok', footer: critGates > 0 ? 'ตรวจสอบด่านที่ล้มเหลว' : 'ด่านทั้งหมดผ่าน' },
    { label: 'ระดับตอบสนอง', value: 'ระดับภูมิภาค', footer: 'ยกระดับแล้ว', tone: 'warn' },
    { label: 'ความครบถ้วน COP', value: sites.length ? Math.round((activeSites / sites.length) * 100) : 0, unit: '%', footer: `${activeSites} จาก ${sites.length} จุด รายงานแล้ว`, tone: 'ok' },
  ]
}

function computeMetricsDrill(patients: IodpPatient[], teams: IodpTeam[], injects: IodpInject[], gates: IodpSafetyGate[]) {
  const pushed = injects.filter(i => i.status !== 'queued').length
  const violations = gates.filter(g => g.status === 'failed').length
  const readyTeams = teams.filter(t => t.status !== 'offline').length

  return [
    { label: 'เวลาฝึก (Sim Clock)', value: 'T+01:35', footer: 'สด · ผู้ควบคุม', tone: '' },
    { label: 'ทีมที่พร้อม', value: readyTeams, unit: `/ ${teams.length}`, footer: `รอ Check-in ${teams.length - readyTeams} ทีม` },
    { label: 'ผู้ประสบภัยจำลอง', value: patients.length, unit: `/ ${patients.length}`, footer: 'ในฐานข้อมูล' },
    { label: 'Inject ที่ส่งแล้ว', value: pushed, unit: `/ ${injects.length}`, footer: 'inject ถัดไปในคิว', tone: pushed < injects.length ? 'warn' : 'ok' },
    { label: 'ละเมิดความปลอดภัย', value: violations, unit: 'รายการ', footer: violations > 0 ? 'ต้องทบทวน' : 'ไม่มีการละเมิด', tone: violations > 0 ? 'critical' : 'ok' },
    { label: 'ผู้ประเมิน', value: 0, unit: 'ออนไลน์', footer: 'บันทึกการสังเกต', tone: 'ok' },
  ]
}

const EMPTY_INCIDENT = {
  code: '—', title_th: 'ยังไม่มีเหตุการณ์', title_en: '', type: '—',
  response_level: '—', command_mode: '—', lead_org: '—', status: 'planned',
  op_period: '—', iap_version: '—', started: 'T+00:00',
  location: { lat: null, lng: null },
}

const EMPTY_DRILL = {
  code: '—', title_th: 'ยังไม่มีการฝึก', title_en: '', type: '—',
  teams: 0, casualties_total: 0, sim_clock: 'T+00:00', sim_status: 'planned',
}

function buildAppData(
  opSession: IodpSession | null,
  drillSession: IodpSession | null,
  opData: DbData | null,
  drillData: DbData | null,
): typeof DEMO_DATA {
  const activeOpData = opData ?? { sites: [], teams: [], patients: [], events: [], gates: [], injects: [], aarFindings: [] }
  const activeDrillData = drillData ?? { sites: [], teams: [], patients: [], events: [], gates: [], injects: [], aarFindings: [] }

  const sites = transformSites(activeOpData.sites.length ? activeOpData.sites : activeDrillData.sites)
  const teams = transformTeams(activeOpData.teams.length ? activeOpData.teams : activeDrillData.teams)
  const patientMarkers = transformPatients(activeOpData.patients.length ? activeOpData.patients : activeDrillData.patients)
  const events = transformEvents(activeOpData.events)
  const gates = transformGates(activeOpData.gates.length ? activeOpData.gates : activeDrillData.gates)
  const facilities = sites.filter(s => s.type === 'facility')
  const drillInjects = transformInjects(activeDrillData.injects)
  const aarFindings = transformAar(activeDrillData.aarFindings.length ? activeDrillData.aarFindings : activeOpData.aarFindings)

  const metricsOp = computeMetricsOp(activeOpData.patients, activeOpData.teams, activeOpData.sites, activeOpData.gates)
  const metricsDrill = computeMetricsDrill(activeDrillData.patients, activeDrillData.teams, activeDrillData.injects, activeDrillData.gates)

  const incident = opSession ? {
    code: opSession.code,
    title_th: opSession.title_th,
    title_en: opSession.title_en ?? '',
    type: opSession.scenario_type ?? '—',
    response_level: opSession.meta?.response_level ?? '—',
    command_mode: opSession.meta?.command_mode ?? '—',
    lead_org: opSession.meta?.lead_org ?? '—',
    status: opSession.status,
    op_period: opSession.op_period ?? '—',
    iap_version: opSession.meta?.iap_version ?? '—',
    started: fmtTime(opSession.start_time),
    location: { lat: opSession.center_lat, lng: opSession.center_lng },
  } : EMPTY_INCIDENT

  const drill = drillSession ? {
    code: drillSession.code,
    title_th: drillSession.title_th,
    title_en: drillSession.title_en ?? '',
    type: drillSession.meta?.drill_type ?? '—',
    teams: activeDrillData.teams.length,
    casualties_total: activeDrillData.patients.length,
    sim_clock: 'T+00:00',
    sim_status: drillSession.status === 'active' ? 'live' : drillSession.status,
  } : EMPTY_DRILL

  return {
    ...DEMO_DATA,
    incident,
    drill,
    sites,
    patient_markers: patientMarkers,
    teams,
    facilities,
    events,
    safety_gates: gates,
    drill_injects: drillInjects,
    aar_findings: aarFindings,
    metrics_op: metricsOp,
    metrics_drill: metricsDrill,
  } as typeof DEMO_DATA
}

export function useIodpData(mode: 'op' | 'drill') {
  const [opSession, setOpSession] = useState<IodpSession | null>(null)
  const [drillSession, setDrillSession] = useState<IodpSession | null>(null)
  const [opData, setOpData] = useState<DbData | null>(null)
  const [drillData, setDrillData] = useState<DbData | null>(null)
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async (opSess: IodpSession | null, drillSess: IodpSession | null) => {
    const [opResult, drillResult] = await Promise.all([
      opSess ? fetchSessionData(opSess.id) : null,
      drillSess ? fetchSessionData(drillSess.id) : null,
    ])
    if (opResult) setOpData(opResult)
    if (drillResult) setDrillData(drillResult)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchSessions()
      .then(sessions => {
        if (cancelled) return
        const op = sessions.find(s => s.mode === 'operation') ?? null
        const drill = sessions.find(s => s.mode === 'drill') ?? null
        setOpSession(op)
        setDrillSession(drill)

        refresh(op, drill).finally(() => {
          if (!cancelled) setLoading(false)
        })

        const activeId = mode === 'op' ? op?.id : drill?.id
        if (activeId) {
          if (unsubRef.current) unsubRef.current()
          unsubRef.current = subscribeToSession(activeId, () => refresh(op, drill))
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false) // fallback to DEMO_DATA on error
      })

    return () => {
      cancelled = true
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    }
  }, [mode])

  const data = useMemo(
    () => buildAppData(opSession, drillSession, opData, drillData),
    [opSession, drillSession, opData, drillData],
  )

  const activeSessionId = mode === 'op' ? opSession?.id : drillSession?.id

  const writeEvent = useCallback(async (event: {
    event_code: string
    severity: 'info' | 'warning' | 'critical' | 'drill'
    actor?: string
    target?: string
    description?: string
  }) => {
    if (!activeSessionId) return
    await insertEvent(activeSessionId, event)
  }, [activeSessionId])

  const updateGate = useCallback(async (gateId: string, status: IodpSafetyGate['status'], checkedBy?: string) => {
    await updateSafetyGate(gateId, status, checkedBy)
  }, [])

  const pushInject = useCallback(async (injectId: string) => {
    await dbPushInject(injectId)
  }, [])

  const ackInject = useCallback(async (injectId: string) => {
    await dbAckInject(injectId)
  }, [])

  return { data, loading, opSession, drillSession, writeEvent, updateGate, pushInject, ackInject }
}
