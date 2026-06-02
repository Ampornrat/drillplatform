'use server'

import { createClient } from './server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ----------------------------------------------------------------
// Internal: insert to event_log with correct user_id field
// ----------------------------------------------------------------
async function logPlatformEvent(params: {
  drillId?: string | null
  eventType: string
  title: string
  description?: string
  severity?: 'info' | 'warning' | 'critical'
  mode?: 'operation' | 'drill'
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  let mode: 'operation' | 'drill' = params.mode ?? 'drill'
  if (params.drillId && !params.mode) {
    const { data: drill } = await supabase
      .from('drills').select('mode').eq('id', params.drillId).single()
    if (drill) mode = drill.mode as typeof mode
  }

  await supabase.from('event_log').insert({
    drill_id: params.drillId ?? null,
    event_type: params.eventType,
    title: params.title,
    description: params.description ?? null,
    severity: params.severity ?? 'info',
    mode,
    user_id: user.id,
    timestamp: new Date().toISOString(),
  })
}

// ----------------------------------------------------------------
// Create Drill + log platform event
// ----------------------------------------------------------------
export async function createDrillAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'กรุณาระบุชื่อ Drill' }

  const mode = ((formData.get('mode') as string) || 'drill') as 'operation' | 'drill'
  const rawObj = formData.get('objectives') as string
  const maxP = formData.get('max_participants') as string

  const { data: drill, error } = await supabase
    .from('drills')
    .insert({
      title,
      description: (formData.get('description') as string) || null,
      mode,
      status: 'draft',
      location: (formData.get('location') as string) || null,
      start_date: (formData.get('start_date') as string) || null,
      end_date: (formData.get('end_date') as string) || null,
      max_participants: maxP ? parseInt(maxP) : null,
      objectives: rawObj ? rawObj.split('\n').filter(Boolean) : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logPlatformEvent({
    drillId: drill.id,
    eventType: 'drill_created',
    title: `สร้าง Drill: ${title}`,
    severity: 'info',
    mode,
  })

  revalidatePath('/planner/drills')
  revalidatePath('/dashboard')
  redirect('/planner/drills')
}

// ----------------------------------------------------------------
// Log a manual event (from Event Log page or Observer)
// ----------------------------------------------------------------
export async function logEventAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'กรุณาระบุชื่อ Event' }

  const drillId = (formData.get('drill_id') as string) || null
  let mode: 'operation' | 'drill' = 'drill'
  if (drillId) {
    const { data: drill } = await supabase
      .from('drills').select('mode').eq('id', drillId).single()
    if (drill) mode = drill.mode as typeof mode
  }

  const { error } = await supabase.from('event_log').insert({
    drill_id: drillId,
    event_type: (formData.get('event_type') as string) || 'observation',
    title,
    description: (formData.get('description') as string) || null,
    severity: (formData.get('severity') as string) || 'info',
    mode,
    user_id: user.id,
    timestamp: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/core/event-log')
  revalidatePath('/observer')
  revalidatePath('/dashboard')
  return { success: true }
}

// ----------------------------------------------------------------
// Create AAR Report (drill_id NOT NULL per schema)
// ----------------------------------------------------------------
export async function createAARReportAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'กรุณาระบุชื่อ AAR Report' }

  const drillId = (formData.get('drill_id') as string)?.trim()
  if (!drillId) return { error: 'กรุณาเลือก Drill' }

  const ratingRaw = formData.get('rating') as string

  const { data: report, error } = await supabase
    .from('aar_reports')
    .insert({
      drill_id: drillId,
      title,
      summary: (formData.get('summary') as string) || null,
      status: 'draft',
      rating: ratingRaw ? parseInt(ratingRaw) : null,
      findings: [],
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logPlatformEvent({
    drillId,
    eventType: 'aar_created',
    title: `สร้าง AAR Report: ${title}`,
    severity: 'info',
  })

  revalidatePath('/core/aar')
  return { success: true, id: report.id }
}

// ----------------------------------------------------------------
// Update Drill Status — checks blocking safety gates before activate
// ----------------------------------------------------------------
export async function updateDrillStatusAction(drillId: string, newStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'commander'].includes(profile.role)) {
    return { error: 'ไม่มีสิทธิ์เปลี่ยนสถานะ Drill' }
  }

  if (newStatus === 'active') {
    const { data: blockingRules } = await supabase
      .from('safety_gate_rules')
      .select('id, name')
      .eq('is_active', true)
      .eq('action', 'block')
      .eq('condition_type', 'pre_check')

    if (blockingRules && blockingRules.length > 0) {
      const { data: passedGates } = await supabase
        .from('drill_safety_gates')
        .select('rule_id')
        .eq('drill_id', drillId)
        .in('status', ['passed', 'waived'])

      const passedIds = new Set((passedGates ?? []).map(g => g.rule_id))
      const blockers = blockingRules.filter(r => !passedIds.has(r.id))

      if (blockers.length > 0) {
        return {
          error: `Safety Gate ยังไม่ผ่าน: ${blockers.map(r => r.name).join(', ')}`,
          blocked: true,
        }
      }
    }
  }

  const { data: drill } = await supabase
    .from('drills').select('mode').eq('id', drillId).single()

  const { error } = await supabase
    .from('drills')
    .update({ status: newStatus })
    .eq('id', drillId)

  if (error) return { error: error.message }

  await logPlatformEvent({
    drillId,
    eventType: 'drill_status_changed',
    title: `สถานะ Drill เปลี่ยนเป็น: ${newStatus}`,
    severity: newStatus === 'cancelled' ? 'warning' : 'info',
    mode: (drill?.mode as 'operation' | 'drill') ?? 'drill',
  })

  revalidatePath('/planner/drills')
  revalidatePath('/dashboard')
  revalidatePath(`/planner/drills/${drillId}`)
  revalidatePath(`/operation/${drillId}/cop`)
  return { success: true }
}
