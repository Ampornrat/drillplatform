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
