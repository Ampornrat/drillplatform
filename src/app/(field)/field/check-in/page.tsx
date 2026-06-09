import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveFullContext } from '@/services/context.service'
import { createClient } from '@/lib/supabase/server'
import { CheckInForm } from '@/components/field/check-in-form'

export const metadata: Metadata = { title: 'Team Check-in' }

export default async function CheckInPage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const supabase = await createClient()

  // Load active/confirmed drill assignments
  const { data: assignments } = await supabase
    .from('drill_participants')
    .select('id, status, role_in_drill, drill_id, drills(id, title, mode, status)')
    .eq('user_id', ctx.userId)
    .in('status', ['active', 'confirmed', 'invited'])
    .order('created_at', { ascending: false })
    .limit(10)

  type AssignRow = {
    id: string
    status: string
    role_in_drill: string | null
    drill_id: string
    drills: { id: string; title: string; mode: string; status: string } | null
  }

  const activeAssignments = ((assignments ?? []) as AssignRow[]).filter(
    a => a.drills?.status === 'active' || a.drills?.status === 'planned'
  )

  return (
    <CheckInForm
      assignments={activeAssignments}
      defaultDrillId={ctx.activeIncidentId ?? activeAssignments[0]?.drill_id ?? ''}
      userName={ctx.profile.full_name ?? ''}
    />
  )
}
