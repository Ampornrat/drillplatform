'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AARDetailData, AARFinding, LMSAssignment, SOPUpdate, ScenarioBankUpdate } from '@/contracts/aar.contract'

interface UseAARDetailReturn {
  findings: AARFinding[]
  allAssignments: LMSAssignment[]
  sopUpdates: SOPUpdate[]
  scenarioBankUpdates: ScenarioBankUpdate[]
  loading: boolean
  refresh: () => void
}

export function useAARDetail(
  drillId: string,
  aarReportId: string | null,
  initial: Pick<AARDetailData, 'findings' | 'allAssignments' | 'sopUpdates' | 'scenarioBankUpdates'>
): UseAARDetailReturn {
  const [findings, setFindings] = useState<AARFinding[]>(initial.findings)
  const [allAssignments, setAllAssignments] = useState<LMSAssignment[]>(initial.allAssignments)
  const [sopUpdates, setSopUpdates] = useState<SOPUpdate[]>(initial.sopUpdates)
  const [scenarioBankUpdates, setScenarioBankUpdates] = useState<ScenarioBankUpdate[]>(initial.scenarioBankUpdates)
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [actionsRes, assignmentsRes, sopRes, bankRes] = await Promise.all([
      aarReportId
        ? supabase
            .from('improvement_actions')
            .select('*, profiles!improvement_actions_owner_id_fkey(full_name)')
            .eq('aar_report_id', aarReportId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('lms_assignments')
        .select('*, profiles!lms_assignments_assignee_id_fkey(full_name), lms_courses(course_name)')
        .eq('drill_id', drillId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('sop_updates')
        .select('*, profiles!sop_updates_proposed_by_fkey(full_name)')
        .eq('drill_id', drillId)
        .order('proposed_at', { ascending: false }),
      supabase
        .from('scenario_bank_updates')
        .select('*, profiles!scenario_bank_updates_submitted_by_fkey(full_name)')
        .eq('drill_id', drillId)
        .order('submitted_at', { ascending: false }),
    ])

    const assignmentsRaw = (assignmentsRes.data ?? []) as Array<Record<string, unknown>>
    const newAssignments: LMSAssignment[] = assignmentsRaw.map(a => ({
      id: a.id as string,
      finding_id: (a.finding_id as string) ?? null,
      course_code: a.course_code as string,
      course_name: ((a.lms_courses as { course_name: string } | null)?.course_name) ?? null,
      assignee_id: (a.assignee_id as string) ?? null,
      assignee_name: ((a.profiles as { full_name: string } | null)?.full_name) ?? null,
      assigned_by: (a.assigned_by as string) ?? null,
      assigned_at: a.assigned_at as string,
      deadline: (a.deadline as string) ?? null,
      status: a.status as LMSAssignment['status'],
      completed_at: (a.completed_at as string) ?? null,
      notes: (a.notes as string) ?? null,
      drill_id: (a.drill_id as string) ?? null,
    }))
    setAllAssignments(newAssignments)

    const actionsRaw = (actionsRes.data ?? []) as Array<Record<string, unknown>>
    const newFindings: AARFinding[] = actionsRaw.map(a => ({
      id: a.id as string,
      aar_report_id: (a.aar_report_id as string) ?? null,
      finding_type: (a.finding_type as string) ?? null,
      finding_code: (a.finding_code as string) ?? null,
      category: a.category as AARFinding['category'],
      description: a.description as string,
      recommendation: (a.recommendation as string) ?? null,
      root_cause: (a.root_cause as string) ?? null,
      recommended_track: (a.recommended_track as string) ?? null,
      priority: a.priority as AARFinding['priority'],
      severity: (a.severity as AARFinding['severity']) ?? 'warning',
      status: a.status as AARFinding['status'],
      responsible_party: (a.responsible_party as string) ?? null,
      owner_id: (a.owner_id as string) ?? null,
      owner_name: ((a.profiles as { full_name: string } | null)?.full_name) ?? null,
      due_date: (a.due_date as string) ?? null,
      completed_at: (a.completed_at as string) ?? null,
      lms_course: (a.lms_course as string) ?? null,
      evidence_event_ids: (a.evidence_event_ids as string[]) ?? [],
      created_at: a.created_at as string,
      updated_at: a.updated_at as string,
      assignments: newAssignments.filter(asn => asn.finding_id === (a.id as string)),
    }))
    setFindings(newFindings)

    const sopRaw = (sopRes.data ?? []) as Array<Record<string, unknown>>
    setSopUpdates(sopRaw.map(s => ({
      id: s.id as string,
      drill_id: (s.drill_id as string) ?? null,
      aar_report_id: (s.aar_report_id as string) ?? null,
      finding_id: (s.finding_id as string) ?? null,
      sop_code: (s.sop_code as string) ?? null,
      title: s.title as string,
      description: s.description as string,
      change_type: s.change_type as SOPUpdate['change_type'],
      priority: s.priority as SOPUpdate['priority'],
      status: s.status as SOPUpdate['status'],
      proposed_by: (s.proposed_by as string) ?? null,
      proposer_name: ((s.profiles as { full_name: string } | null)?.full_name) ?? null,
      proposed_at: s.proposed_at as string,
      approved_by: (s.approved_by as string) ?? null,
      approved_at: (s.approved_at as string) ?? null,
      notes: (s.notes as string) ?? null,
    })))

    const bankRaw = (bankRes.data ?? []) as Array<Record<string, unknown>>
    setScenarioBankUpdates(bankRaw.map(b => ({
      id: b.id as string,
      drill_id: (b.drill_id as string) ?? null,
      aar_report_id: (b.aar_report_id as string) ?? null,
      title: b.title as string,
      summary: (b.summary as string) ?? null,
      lessons_learned: (b.lessons_learned as string) ?? null,
      difficulty_adj: (b.difficulty_adj as ScenarioBankUpdate['difficulty_adj']) ?? null,
      finding_codes: (b.finding_codes as string[]) ?? [],
      submitted_by: (b.submitted_by as string) ?? null,
      submitter_name: ((b.profiles as { full_name: string } | null)?.full_name) ?? null,
      submitted_at: b.submitted_at as string,
      status: b.status as ScenarioBankUpdate['status'],
    })))

    setLoading(false)
  }, [drillId, aarReportId])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`aar-detail:${drillId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'improvement_actions' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lms_assignments', filter: `drill_id=eq.${drillId}` }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sop_updates', filter: `drill_id=eq.${drillId}` }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scenario_bank_updates', filter: `drill_id=eq.${drillId}` }, () => { void refresh() })
      .subscribe()

    channelRef.current = channel
    return () => { void supabase.removeChannel(channel) }
  }, [drillId, refresh])

  return { findings, allAssignments, sopUpdates, scenarioBankUpdates, loading, refresh }
}
