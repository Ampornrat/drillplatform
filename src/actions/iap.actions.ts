'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventType: string,
  title: string,
  drillId: string,
  severity = 'info'
) {
  await supabase.rpc('log_platform_event', {
    payload: { event_type: eventType, mode: 'operation', drill_id: drillId, severity, title },
  })
}

// Creates a new IAP version (auto-increments) via RPC
export async function createIapVersion(
  drillId: string
): Promise<ServiceResult<{ iap_id: string; version: number }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_iap_version', {
    payload: { drill_id: drillId },
  })
  if (error) return fail('database_error', error.message)
  if (data?.error) return fail('forbidden', data.message ?? 'สร้าง IAP ไม่สำเร็จ')
  revalidatePath('/', 'layout')
  return ok({ iap_id: data.data.iap_id as string, version: data.data.version as number })
}

// Upserts a section's JSONB content + logs IAP_SECTION_UPDATED
export async function saveIapSection(
  iapVersionId: string,
  drillId: string,
  sectionCode: string,
  content: Record<string, unknown>
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('update_iap_section', {
    payload: { iap_version_id: iapVersionId, section_code: sectionCode, content },
  })
  if (error) return fail('database_error', error.message)
  if (data?.error) return fail('forbidden', data.message ?? 'บันทึกไม่สำเร็จ')
  await logEvent(supabase, 'IAP_SECTION_UPDATED', `IAP section updated: ${sectionCode}`, drillId)
  return ok(true as const)
}

// draft → safety_brief
export async function submitForSafetyBrief(
  iapVersionId: string,
  drillId: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  const { error } = await supabase
    .from('iap_versions')
    .update({ status: 'safety_brief', submitted_by: user.id, submitted_at: new Date().toISOString() })
    .eq('id', iapVersionId)
  if (error) return fail('database_error', error.message)

  await logEvent(supabase, 'IAP_SUBMITTED', 'IAP ส่ง Safety Brief แล้ว', drillId)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

// safety_brief → pending_approval
export async function submitForApproval(
  iapVersionId: string,
  drillId: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  const { error } = await supabase
    .from('iap_versions')
    .update({ status: 'pending_approval' })
    .eq('id', iapVersionId)
  if (error) return fail('database_error', error.message)

  await logEvent(supabase, 'IAP_SUBMITTED', 'IAP ส่งขออนุมัติแล้ว', drillId)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

// pending_approval → approved
export async function approveIap(
  iapVersionId: string,
  drillId: string,
  comments?: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  const { error } = await supabase
    .from('iap_versions')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      review_comments: comments ?? null,
    })
    .eq('id', iapVersionId)
  if (error) return fail('database_error', error.message)

  await logEvent(supabase, 'IAP_APPROVED', 'IAP อนุมัติแล้ว', drillId)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

// approved → active (supersedes any current active version + notifies roles)
export async function activateIap(
  iapVersionId: string,
  drillId: string
): Promise<ServiceResult<true>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  // Supersede any currently active version
  await supabase
    .from('iap_versions')
    .update({ status: 'superseded' })
    .eq('drill_id', drillId)
    .eq('status', 'active')

  const { data: verData } = await supabase
    .from('iap_versions').select('version').eq('id', iapVersionId).single()

  const { error } = await supabase
    .from('iap_versions')
    .update({ status: 'active' })
    .eq('id', iapVersionId)
  if (error) return fail('database_error', error.message)

  const vLabel = `v${verData?.version ?? '?'}`
  await logEvent(supabase, 'IAP_ACTIVATED', `IAP ${vLabel} เปิดใช้งานแล้ว`, drillId, 'info')

  const { data: targets } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'commander', 'medical', 'logistics'])

  if (targets && targets.length > 0) {
    await supabase.from('notifications').insert(
      targets.map(t => ({
        user_id: t.id,
        type: 'info',
        title: `IAP ${vLabel} เปิดใช้งานแล้ว`,
        body: 'แผนปฏิบัติการฉบับใหม่มีผลบังคับใช้แล้ว',
        drill_id: drillId,
        link: `/op/iap`,
      }))
    )
  }

  revalidatePath('/', 'layout')
  return ok(true as const)
}
