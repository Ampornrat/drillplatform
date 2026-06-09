import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveFullContext, toAppCtx } from '@/services/context.service'
import { createClient } from '@/lib/supabase/server'
import { FieldHome } from '@/components/field/field-home'

export const metadata: Metadata = { title: 'Field Home' }

export default async function FieldPage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data
  const appCtx = toAppCtx(ctx)

  const supabase = await createClient()

  // Active assignments
  const { data: assignments } = await supabase
    .from('drill_participants')
    .select('id, status, role_in_drill, drills(id, title, mode, status, location)')
    .eq('user_id', ctx.userId)
    .in('status', ['active', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent events (injects / notifications to this user)
  const { data: recentEvents } = await supabase
    .from('event_log')
    .select('id, event_type, title, description, severity, timestamp')
    .order('timestamp', { ascending: false })
    .limit(8)

  type AssignmentRow = {
    id: string
    status: string
    role_in_drill: string | null
    drills: { id: string; title: string; mode: string; status: string; location: string | null } | null
  }

  return (
    <FieldHome
      appCtx={appCtx}
      assignments={(assignments ?? []) as AssignmentRow[]}
      recentEvents={recentEvents ?? []}
    />
  )
}
