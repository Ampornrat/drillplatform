/**
 * op.contract.ts — Operation module view models.
 *
 * Used by: /dashboard, /operation/[id]/cop, (future) /op/iap, /op/facility
 * DB sources: drills, organizations, event_log, drill_participants,
 *             safety_gate_rules, drill_safety_gates, standards_registry
 */
import type { DrillMode, DrillStatus, GateStatus, EventLogItem } from './common.contract'

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface OpDashboardMetrics {
  totalDrills: number
  activeDrills: number
  recentEvents: Pick<EventLogItem, 'id' | 'title' | 'severity' | 'timestamp'>[]
  activeStandards: number
}

// ── Incident / Drill summary (list view) ─────────────────────────────────────

/** One row in the drills list or sidebar. */
export interface IncidentSummary {
  id: string
  title: string
  mode: DrillMode
  status: DrillStatus
  location: string | null
  organizationName: string | null
  start_date: string | null
  end_date: string | null
  participantCount: number
}

// ── IAP ──────────────────────────────────────────────────────────────────────

/** Incident Action Plan version. Maps to future iap_versions table / drills.scenario JSONB. */
export interface IAPVersion {
  id: string
  drill_id: string
  version: number
  objectives: string[]
  period_start: string | null
  period_end: string | null
  created_by: string
  created_at: string
  notes: string | null
}

// ── COP map ──────────────────────────────────────────────────────────────────

/** Single map marker on the Common Operating Picture. */
export interface COPMarker {
  id: string
  label: string
  lat: number
  lng: number
  /** Drives icon/colour on the map */
  type: 'unit' | 'incident' | 'facility' | 'resource' | 'ccp' | 'lz' | 'uav'
  status: string
  /** Tailwind colour token or hex (optional override) */
  color?: string
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

export interface DispatchAssignment {
  id: string
  drill_id: string
  resource_id: string
  resource_name: string
  resource_type: string
  assigned_to: string
  location: string | null
  status: 'staged' | 'en_route' | 'on_scene' | 'released'
  assigned_at: string
}

// ── Facility ─────────────────────────────────────────────────────────────────

export interface FacilityLoad {
  id: string
  name: string
  type: string
  capacity: number | null
  current_load: number
  status: 'normal' | 'surge' | 'critical' | 'closed'
}

export type FacilityLevel = 'Role1' | 'Role2' | 'Role3' | 'CoE' | 'CCP'
export type DiversionStatus = 'open' | 'divert' | 'closed' | 'overloaded'
export type OxygenLevel = 'normal' | 'low' | 'critical'

export interface FacilityStatusFull {
  /** Unique key: `${drill_id}:${site_code}` */
  site_code: string
  site_name: string | null
  drill_id: string | null
  session_id: string | null
  facility_level: FacilityLevel | null
  status: 'normal' | 'surge' | 'critical' | 'closed'
  current_load: number
  capacity: number | null
  load_pct: number | null
  icu_beds_total: number
  icu_beds_available: number
  or_available: boolean
  blood_available: boolean
  oxygen_level: OxygenLevel
  diversion_status: DiversionStatus
  notes: string | null
  updated_at: string
}

// ── Transport / Object Registry ───────────────────────────────────────────────

export type TransportType = 'ambulance' | 'boat' | 'HEMS' | 'UAV' | 'ALS_unit' | 'BLS_unit' | 'other'
export type TransportStatus = 'available' | 'en_route' | 'on_scene' | 'standby' | 'unavailable'

export interface TransportObject {
  id: string
  object_code: string
  name: string
  type: TransportType
  capability: string[]
  status: TransportStatus
  readiness: number
  assigned_patient_id: string | null
  lat: number | null
  lng: number | null
}

// ── Patient Track (view: patient_tracks) ──────────────────────────────────────

export interface PatientTrack {
  id: string
  session_id: string
  drill_id: string | null
  patient_code: string
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
  status: string
  site_id: string | null
  destination_id: string | null
  transport_mode: string | null
  transport_object_id: string | null
  mist_data: Record<string, unknown>
  march_data: Record<string, unknown>
  departed_at: string | null
  found_at: string | null
  triaged_at: string | null
  admitted_at: string | null
  current_location: string | null
  current_site_code: string | null
  destination_name: string | null
  destination_site_code: string | null
  lat: number | null
  lng: number | null
  updated_at: string
}

// ── Patient Movement Timeline ─────────────────────────────────────────────────

export interface PatientMovementRow {
  id: string
  patient_id: string
  patient_code: string
  from_site_name: string | null
  to_site_name: string | null
  transport_mode: string | null
  moved_at: string
  notes: string | null
}

// ── Safety Gate (op context — per-drill merged view) ─────────────────────────

export interface SafetyGateView {
  id: string
  name: string
  description: string | null
  condition_type: 'pre_check' | 'during' | 'post_check'
  action: 'block' | 'warn' | 'notify'
  priority: number
  /** drill_safety_gates.status, defaulting to 'pending' if no row yet */
  status: GateStatus
}
