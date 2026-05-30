export interface IodpSession {
  id: string
  code: string
  title_th: string
  title_en: string | null
  mode: 'operation' | 'drill'
  status: string
  scenario_type: string | null
  op_period: string | null
  start_time: string | null
  end_time: string | null
  center_lat: number
  center_lng: number
  zoom_level: number
  meta: Record<string, any>
}

export interface IodpSite {
  id: string
  session_id: string
  site_code: string
  name: string | null
  type: 'facility' | 'incident' | 'ccp' | 'lz' | 'uav' | 'team'
  status: string | null
  lat: number
  lng: number
  capacity: number | null
  current_load: number
  meta: Record<string, any>
}

export interface IodpTeam {
  id: string
  session_id: string
  team_code: string
  name: string
  type: string | null
  status: string
  site_id: string | null
  personnel: number
  readiness: number
  lat: number | null
  lng: number | null
  meta: Record<string, any>
}

export interface IodpPatient {
  id: string
  session_id: string
  patient_code: string
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
  status: string
  site_id: string | null
  destination_id: string | null
  lat: number | null
  lng: number | null
  march_data: Record<string, any>
  meta: Record<string, any>
}

export interface IodpEvent {
  id: string
  session_id: string
  event_code: string
  severity: 'info' | 'warning' | 'critical' | 'drill'
  actor: string | null
  target: string | null
  description: string | null
  flagged: boolean
  meta: Record<string, any>
  occurred_at: string
}

export interface IodpSafetyGate {
  id: string
  session_id: string
  gate_code: string
  name: string
  status: 'passed' | 'pending' | 'failed' | 'waived' | 'critical'
  checked_by: string | null
  checked_at: string | null
  notes: string | null
}

export interface IodpInject {
  id: string
  session_id: string
  inject_code: string
  title: string
  description: string | null
  type: string
  status: 'queued' | 'pushed' | 'acknowledged' | 'completed' | 'skipped'
  scheduled_at: string | null
  pushed_at: string | null
  target_team: string | null
  severity: string
  expected_action: string | null
  actual_action: string | null
  meta: Record<string, any>
}

export interface IodpAarFinding {
  id: string
  session_id: string
  finding_code: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string | null
  category: string | null
  lms_course: string | null
  lms_deadline: string | null
  status: 'open' | 'in_progress' | 'resolved'
}
