/**
 * aar.contract.ts — After-Action Review + LMS + Improvement Plan view models.
 */

// ── Legacy finding (for /core/aar list view) ──────────────────────────────────

export interface AARFindingItem {
  id: string
  category: 'strength' | 'area_for_improvement' | 'sustain' | 'improve'
  description: string
  recommendation: string | null
  priority: 'low' | 'medium' | 'high'
  responsible_party: string | null
  due_date: string | null
  status: 'open' | 'in_progress' | 'closed'
  lms_course: string | null
  lms_deadline: string | null
}

export interface AARReportView {
  id: string
  drill_id: string
  drillTitle: string
  drillMode: import('./common.contract').DrillMode
  title: string
  summary: string | null
  status: 'draft' | 'review' | 'approved' | 'published'
  rating: number | null
  findings: AARFindingItem[]
  created_by: string
  created_at: string
}

export interface AARSummary {
  id: string
  drill_id: string
  drillTitle: string
  title: string
  status: AARReportView['status']
  rating: number | null
  findingCount: number
  created_at: string
}

// ── Rich Improvement Action (from improvement_actions table) ──────────────────

export interface AARFinding {
  id: string
  aar_report_id: string | null
  finding_type: string | null
  finding_code: string | null
  category: 'strength' | 'area_for_improvement' | 'sustain' | 'improve'
  description: string
  recommendation: string | null
  root_cause: string | null
  recommended_track: string | null
  priority: 'low' | 'medium' | 'high'
  severity: 'info' | 'warning' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
  responsible_party: string | null
  owner_id: string | null
  owner_name: string | null
  due_date: string | null
  completed_at: string | null
  lms_course: string | null
  evidence_event_ids: string[]
  created_at: string
  updated_at: string
  /** Populated assignments for this finding */
  assignments: LMSAssignment[]
}

// ── LMS ───────────────────────────────────────────────────────────────────────

export interface LMSCourse {
  id: string
  course_code: string
  course_name: string
  course_name_th: string | null
  finding_type: string | null
  description: string | null
  duration_hours: number
  provider: string
  is_active: boolean
}

export interface LMSAssignment {
  id: string
  finding_id: string | null
  course_code: string
  course_name: string | null
  assignee_id: string | null
  assignee_name: string | null
  assigned_by: string | null
  assigned_at: string
  deadline: string | null
  status: 'assigned' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  completed_at: string | null
  notes: string | null
  drill_id: string | null
}

// ── SOP Update ────────────────────────────────────────────────────────────────

export interface SOPUpdate {
  id: string
  drill_id: string | null
  aar_report_id: string | null
  finding_id: string | null
  sop_code: string | null
  title: string
  description: string
  change_type: 'create' | 'update' | 'retire' | 'review'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'proposed' | 'under_review' | 'approved' | 'rejected' | 'implemented'
  proposed_by: string | null
  proposer_name: string | null
  proposed_at: string
  approved_by: string | null
  approved_at: string | null
  notes: string | null
}

// ── Scenario Bank Update ──────────────────────────────────────────────────────

export interface ScenarioBankUpdate {
  id: string
  drill_id: string | null
  aar_report_id: string | null
  title: string
  summary: string | null
  lessons_learned: string | null
  difficulty_adj: 'easier' | 'same' | 'harder' | null
  finding_codes: string[]
  submitted_by: string | null
  submitter_name: string | null
  submitted_at: string
  status: 'draft' | 'submitted' | 'merged' | 'rejected'
}

// ── Evidence Event (reuse from evaluation contract) ───────────────────────────

export interface AAREventItem {
  id: string
  event_type: string
  title: string
  description: string | null
  severity: 'info' | 'warning' | 'critical'
  occurred_at: string
}

// ── Full AAR Detail bundle ────────────────────────────────────────────────────

export interface AARDetailData {
  drillId: string
  drillTitle: string
  aarReportId: string | null
  aarStatus: string | null
  aarRating: number | null
  findings: AARFinding[]
  lmsCourses: LMSCourse[]
  allAssignments: LMSAssignment[]
  sopUpdates: SOPUpdate[]
  scenarioBankUpdates: ScenarioBankUpdate[]
  events: AAREventItem[]
  generatedAt: string | null
}
