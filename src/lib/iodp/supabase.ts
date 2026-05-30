import { createClient } from '@/lib/supabase/client'
import type { IodpSafetyGate } from './types'

export async function fetchSessions() {
  const supabase = createClient()
  const { data } = await supabase
    .from('iodp_sessions')
    .select('*')
    .in('status', ['active', 'planned', 'paused'])
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function fetchSessionData(sessionId: string) {
  const supabase = createClient()
  const [sites, teams, patients, events, gates, injects, aarFindings] = await Promise.all([
    supabase.from('iodp_sites').select('*').eq('session_id', sessionId).order('site_code'),
    supabase.from('iodp_teams').select('*').eq('session_id', sessionId).order('team_code'),
    supabase.from('iodp_patients').select('*').eq('session_id', sessionId).order('patient_code'),
    supabase.from('iodp_events').select('*').eq('session_id', sessionId).order('occurred_at', { ascending: false }).limit(50),
    supabase.from('iodp_safety_gates').select('*').eq('session_id', sessionId).order('gate_code'),
    supabase.from('iodp_injects').select('*').eq('session_id', sessionId).order('scheduled_at'),
    supabase.from('iodp_aar_findings').select('*').eq('session_id', sessionId).order('severity'),
  ])
  return {
    sites: sites.data ?? [],
    teams: teams.data ?? [],
    patients: patients.data ?? [],
    events: events.data ?? [],
    gates: gates.data ?? [],
    injects: injects.data ?? [],
    aarFindings: aarFindings.data ?? [],
  }
}

export async function insertEvent(sessionId: string, event: {
  event_code: string
  severity: 'info' | 'warning' | 'critical' | 'drill'
  actor?: string
  target?: string
  description?: string
}) {
  const supabase = createClient()
  const { error } = await supabase.from('iodp_events').insert({ session_id: sessionId, ...event })
  return error
}

export async function updateSafetyGate(
  gateId: string,
  status: IodpSafetyGate['status'],
  checkedBy?: string,
  notes?: string,
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_safety_gates')
    .update({ status, checked_by: checkedBy, checked_at: new Date().toISOString(), notes })
    .eq('id', gateId)
  return error
}

export async function pushInject(injectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_injects')
    .update({ status: 'pushed', pushed_at: new Date().toISOString() })
    .eq('id', injectId)
  return error
}

export async function acknowledgeInject(injectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_injects')
    .update({ status: 'acknowledged' })
    .eq('id', injectId)
  return error
}

export async function updatePatientStatus(patientId: string, status: string) {
  const supabase = createClient()
  const { error } = await supabase.from('iodp_patients').update({ status }).eq('id', patientId)
  return error
}

export async function updatePatientTriage(patientId: string, triage_level: 'P1' | 'P2' | 'P3' | 'BLACK') {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_patients')
    .update({ triage_level, triaged_at: new Date().toISOString() })
    .eq('id', patientId)
  return error
}

export async function updateTeamStatus(teamId: string, status: string, siteCode?: string) {
  const supabase = createClient()
  const update: Record<string, any> = { status }
  if (siteCode !== undefined) update['meta'] = { site_code: siteCode }
  const { error } = await supabase.from('iodp_teams').update(update).eq('id', teamId)
  return error
}

export async function createSession(data: {
  code: string
  title_th: string
  title_en?: string
  mode: 'operation' | 'drill'
  status?: string
  scenario_type?: string
  op_period?: string
  center_lat: number
  center_lng: number
  meta?: Record<string, any>
}) {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('iodp_sessions')
    .insert({ status: 'planned', zoom_level: 14, meta: {}, ...data })
    .select()
    .single()
  return { data: row, error }
}

export async function updateSessionStatus(sessionId: string, status: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_sessions')
    .update({ status })
    .eq('id', sessionId)
  return error
}

export async function deleteSession(sessionId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('iodp_sessions').delete().eq('id', sessionId)
  return error
}

export async function addSite(data: {
  session_id: string
  site_code: string
  name: string
  type: 'facility' | 'incident' | 'ccp' | 'lz' | 'uav' | 'team'
  lat: number
  lng: number
  capacity?: number
  meta?: Record<string, any>
}) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_sites')
    .insert({ status: 'active', current_load: 0, meta: {}, ...data })
  return error
}

export async function deleteSite(siteId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('iodp_sites').delete().eq('id', siteId)
  return error
}

export async function addTeam(data: {
  session_id: string
  team_code: string
  name: string
  type?: string
  personnel?: number
  meta?: Record<string, any>
}) {
  const supabase = createClient()
  const { error } = await supabase
    .from('iodp_teams')
    .insert({ status: 'available', readiness: 100, personnel: 0, meta: {}, ...data })
  return error
}

export async function deleteTeam(teamId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('iodp_teams').delete().eq('id', teamId)
  return error
}

export async function lookupPostalCode(postalCode: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('thai_postal_codes')
    .select('province_th, district_th')
    .eq('postal_code', postalCode)
    .order('district_th')
  const seen = new Set<string>()
  const unique: { province_th: string; district_th: string }[] = []
  for (const row of data ?? []) {
    const key = `${row.province_th}|${row.district_th}`
    if (!seen.has(key)) { seen.add(key); unique.push(row) }
  }
  return unique
}

export function subscribeToSession(
  sessionId: string,
  onUpdate: () => void,
) {
  const supabase = createClient()
  const tables = ['iodp_events', 'iodp_patients', 'iodp_teams', 'iodp_safety_gates', 'iodp_injects']
  const channel = supabase.channel(`iodp-${sessionId}`)

  for (const table of tables) {
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table, filter: `session_id=eq.${sessionId}` },
      onUpdate,
    )
  }

  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
