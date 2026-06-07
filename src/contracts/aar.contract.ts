/**
 * aar.contract.ts — After-Action Review module view models.
 *
 * Used by: /core/aar, IODP AARLoop view, (future) /drill/aar/[id]
 * DB sources: aar_reports, drills, iodp_aar_findings
 */

// ── Finding ───────────────────────────────────────────────────────────────────

/**
 * Single AAR finding. Extends the raw AARFinding from @/types with
 * lifecycle fields needed by the findings editor.
 */
export interface AARFindingItem {
  /** Inline ID (index-based until persisted). */
  id: string
  category: 'strength' | 'area_for_improvement' | 'sustain' | 'improve'
  description: string
  recommendation: string | null
  priority: 'low' | 'medium' | 'high'
  responsible_party: string | null
  due_date: string | null
  status: 'open' | 'in_progress' | 'closed'
  /** LMS course code for linked training (iodp_aar_findings.lms_course) */
  lms_course: string | null
  lms_deadline: string | null
}

// ── Report ────────────────────────────────────────────────────────────────────

/** Full AAR report view — aar_reports joined with drills. */
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

/** Minimal shape for the AAR list. */
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
