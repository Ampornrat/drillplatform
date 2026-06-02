import { createClient } from './server'
import type { Profile } from '@/types'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data as Profile
}

export async function getAnnouncements(limit = 10) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getPublicDocuments(category?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('public_documents')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  const { data } = await query
  return data ?? []
}

export async function getDrills(mode?: 'operation' | 'drill', status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('drills')
    .select('*')
    .order('created_at', { ascending: false })

  if (mode) query = query.eq('mode', mode)
  if (status) query = query.eq('status', status)
  const { data } = await query
  return data ?? []
}

export async function getEventLog(drillId?: string, limit = 50) {
  const supabase = await createClient()
  let query = supabase
    .from('event_log')
    .select('*, profiles(full_name)')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (drillId) query = query.eq('drill_id', drillId)
  const { data } = await query
  return data ?? []
}

export async function getDrillCOPData(drillId: string) {
  const supabase = await createClient()

  const [drillRes, eventsRes, participantsRes, rulesRes, drillGatesRes] = await Promise.all([
    supabase.from('drills')
      .select('*, organizations(name)')
      .eq('id', drillId)
      .single(),
    supabase.from('event_log')
      .select('id, severity, title, timestamp')
      .eq('drill_id', drillId)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase.from('drill_participants')
      .select('status')
      .eq('drill_id', drillId),
    supabase.from('safety_gate_rules')
      .select('id, name, condition_type, action, priority')
      .eq('is_active', true)
      .order('priority'),
    supabase.from('drill_safety_gates')
      .select('rule_id, status, notes, checked_at')
      .eq('drill_id', drillId),
  ])

  if (drillRes.error || !drillRes.data) return null

  const drill = drillRes.data as typeof drillRes.data & {
    organizations: { name: string } | null
  }
  const events = eventsRes.data ?? []
  const participants = participantsRes.data ?? []
  const rules = rulesRes.data ?? []
  const drillGates = drillGatesRes.data ?? []

  const gateMap = Object.fromEntries(drillGates.map(g => [g.rule_id, g]))
  const gates = rules.map(r => ({
    ...r,
    status: (gateMap[r.id]?.status ?? 'pending') as 'pending' | 'passed' | 'failed' | 'waived',
    notes: gateMap[r.id]?.notes ?? null,
    checked_at: gateMap[r.id]?.checked_at ?? null,
  }))

  const stats = {
    totalParticipants: participants.length,
    activeParticipants: participants.filter(
      p => p.status && ['confirmed', 'active'].includes(p.status)
    ).length,
    eventCount: events.length,
    criticalEvents: events.filter(e => e.severity === 'critical').length,
    gatesPassed: gates.filter(g => g.status === 'passed' || g.status === 'waived').length,
    gatesFailed: gates.filter(g => g.status === 'failed').length,
    gatesTotal: gates.length,
    gatesCritical: gates.filter(g => g.status === 'failed' && g.action === 'block').length,
  }

  return { drill, events, participants, gates, stats }
}
