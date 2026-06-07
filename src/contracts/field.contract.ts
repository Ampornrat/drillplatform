/**
 * field.contract.ts — Field / Mobile unit view models.
 *
 * Used by: /participant, IODP FieldMobile view (triage, check-in, supply, inbox)
 * DB sources: drill_participants, drills, iodp_patients, iodp_teams, iodp_sites
 */

// ── Participant check-in ──────────────────────────────────────────────────────

/** drill_participants row enriched with drill title. */
export interface CheckInEntry {
  id: string
  user_id: string
  userName: string | null
  drill_id: string
  drillTitle: string
  role_in_drill: string | null
  status: 'registered' | 'checked_in' | 'checked_out' | 'absent'
  checked_in_at: string | null
  location: string | null
}

// ── Triage patient ────────────────────────────────────────────────────────────

/** Maps to iodp_patients row. */
export interface PatientSummary {
  id: string
  patient_code: string
  /** P1–P3 / BLACK — SALT/START triage levels */
  triage_level: 'P1' | 'P2' | 'P3' | 'BLACK' | null
  status: string
  site_id: string | null
  siteName: string | null
  destination_id: string | null
  /** Subset of MARCH data for field display */
  march_data: {
    massive_haemorrhage?: boolean
    airway?: string
    respiration?: string
    circulation?: string
    hypothermia?: boolean
  }
  lat: number | null
  lng: number | null
}

// ── Supply request ────────────────────────────────────────────────────────────

export interface SupplyRequest {
  id: string
  drill_id: string
  requested_by: string
  item_code: string
  item_name: string
  quantity: number
  unit: string
  priority: 'routine' | 'urgent' | 'immediate'
  status: 'pending' | 'approved' | 'dispatched' | 'delivered'
  requested_at: string
}

// ── Field inbox ───────────────────────────────────────────────────────────────

/** Incoming inject / message for field teams. Maps to iodp_injects (target_team). */
export interface FieldInboxMessage {
  id: string
  inject_code: string
  subject: string
  body: string | null
  priority: 'low' | 'normal' | 'high'
  read: boolean
  received_at: string
  /** True once acknowledgeInject() called */
  acknowledged: boolean
}
