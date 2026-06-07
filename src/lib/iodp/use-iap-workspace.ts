'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type IapVersion = {
  id: string
  drill_id: string
  version: number
  status: string
  objectives: string[]
  period_start: string | null
  period_end: string | null
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_comments: string | null
  created_by: string | null
  created_at: string
}

export type IapSection = {
  id: string
  iap_version_id: string
  section_code: string
  content: Record<string, any>
  updated_by: string | null
  updated_at: string
}

export type IapGate = {
  id: string
  code: string
  title: string
  status: string
  note: string | null
}

export type IapWorkspaceResult = {
  versions: IapVersion[]
  currentVersion: IapVersion | null
  sections: Record<string, IapSection>
  gates: IapGate[]
  userMap: Record<string, string>
  loading: boolean
  error: string | null
  selectVersion: (id: string) => void
  refresh: () => void
}

export function useIapWorkspace(drillId: string | null): IapWorkspaceResult {
  const [versions, setVersions]     = useState<IapVersion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sections, setSections]     = useState<Record<string, IapSection>>({})
  const [gates, setGates]           = useState<IapGate[]>([])
  const [userMap, setUserMap]       = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const unsubRef                    = useRef<(() => void) | null>(null)

  const currentVersion = versions.find(v => v.id === selectedId) ?? versions[0] ?? null

  const fetchSections = useCallback(async (versionId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('iap_sections')
      .select('*')
      .eq('iap_version_id', versionId)
    const map: Record<string, IapSection> = {}
    for (const s of data ?? []) map[s.section_code] = s as IapSection
    setSections(map)
  }, [])

  const fetchAll = useCallback(async (id: string) => {
    const supabase = createClient()
    const [versRes, rulesRes, gatesRes] = await Promise.all([
      supabase
        .from('iap_versions')
        .select('id,drill_id,version,status,objectives,period_start,period_end,notes,approved_by,approved_at,submitted_by,submitted_at,reviewed_by,reviewed_at,review_comments,created_by,created_at')
        .eq('drill_id', id)
        .order('version', { ascending: false }),
      supabase
        .from('safety_gate_rules')
        .select('id,name,condition_type')
        .eq('is_active', true)
        .order('priority'),
      supabase
        .from('drill_safety_gates')
        .select('rule_id,status,notes')
        .eq('drill_id', id),
    ])

    const versionList = (versRes.data ?? []).map(v => ({
      ...v,
      status: (v as any).status ?? 'draft',
    })) as IapVersion[]
    setVersions(versionList)

    // Default selection: active → latest
    setSelectedId(prev => {
      if (prev && versionList.some(v => v.id === prev)) return prev
      return versionList.find(v => v.status === 'active')?.id ?? versionList[0]?.id ?? null
    })

    const gateMap = Object.fromEntries((gatesRes.data ?? []).map(g => [g.rule_id, g]))
    setGates((rulesRes.data ?? []).map(r => ({
      id: r.id,
      code: r.condition_type ?? r.id.slice(0, 8).toUpperCase(),
      title: r.name,
      status: (gateMap[r.id] as any)?.status ?? 'pending',
      note: (gateMap[r.id] as any)?.notes ?? null,
    })))

    // Resolve display names for all user IDs in versions
    const userIds = new Set<string>()
    for (const v of versionList) {
      if (v.created_by) userIds.add(v.created_by)
      if (v.approved_by) userIds.add(v.approved_by)
      if (v.submitted_by) userIds.add(v.submitted_by)
      if (v.reviewed_by) userIds.add(v.reviewed_by)
    }
    if (userIds.size > 0) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id,full_name,position')
        .in('id', Array.from(userIds))
      const map: Record<string, string> = {}
      for (const p of prof ?? []) map[p.id] = p.full_name ?? p.id.slice(0, 8)
      setUserMap(map)
    }
  }, [])

  const selectVersion = useCallback((id: string) => {
    setSelectedId(id)
    fetchSections(id)
  }, [fetchSections])

  const refresh = useCallback(() => {
    if (!drillId) return
    setLoading(true)
    Promise.all([
      fetchAll(drillId),
      currentVersion ? fetchSections(currentVersion.id) : Promise.resolve(),
    ]).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))
  }, [drillId, fetchAll, fetchSections, currentVersion])

  useEffect(() => {
    if (!drillId) {
      setVersions([]); setSections({}); setGates([]); setSelectedId(null)
      return
    }
    setLoading(true); setError(null)
    fetchAll(drillId).catch(() => setError('โหลดข้อมูลล้มเหลว')).finally(() => setLoading(false))

    const supabase = createClient()
    const ch = supabase.channel(`iap-workspace:${drillId}`)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'iap_versions', filter: `drill_id=eq.${drillId}` },
      () => fetchAll(drillId)
    )
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'drill_safety_gates', filter: `drill_id=eq.${drillId}` },
      () => fetchAll(drillId)
    )
    ch.subscribe()
    unsubRef.current = () => supabase.removeChannel(ch)
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [drillId, fetchAll])

  // Fetch sections whenever selected version changes
  useEffect(() => {
    const vid = currentVersion?.id
    if (!vid) return
    fetchSections(vid)
    const supabase = createClient()
    const ch = supabase.channel(`iap-sections:${vid}`)
    ch.on('postgres_changes' as any,
      { event: '*', schema: 'public', table: 'iap_sections', filter: `iap_version_id=eq.${vid}` },
      () => fetchSections(vid)
    )
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  }, [currentVersion?.id, fetchSections])

  return { versions, currentVersion, sections, gates, userMap, loading, error, selectVersion, refresh }
}
