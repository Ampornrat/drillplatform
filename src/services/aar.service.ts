import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { AARSummary, AARReportView, AARFindingItem } from '@/contracts/aar.contract'
import type { DrillMode } from '@/contracts/common.contract'

export async function getAARList(): Promise<ServiceResult<AARSummary[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .select('id, drill_id, title, status, rating, findings, created_at, drills(title)')
    .order('created_at', { ascending: false })
  if (error) return fail('database_error', error.message)

  return ok((data ?? []).map(r => ({
    id: r.id,
    drill_id: r.drill_id,
    drillTitle: (r.drills as { title: string } | null)?.title ?? r.drill_id,
    title: r.title,
    status: r.status as AARSummary['status'],
    rating: r.rating,
    findingCount: Array.isArray(r.findings) ? r.findings.length : 0,
    created_at: r.created_at,
  })))
}

export async function getAARById(id: string): Promise<ServiceResult<AARReportView>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .select('*, drills(title, mode)')
    .eq('id', id)
    .single()
  if (error || !data) return fail('not_found', 'ไม่พบ AAR Report')

  const drill = data.drills as { title: string; mode: string } | null

  return ok({
    id: data.id,
    drill_id: data.drill_id,
    drillTitle: drill?.title ?? data.drill_id,
    drillMode: (drill?.mode ?? 'drill') as DrillMode,
    title: data.title,
    summary: data.summary,
    status: data.status as AARReportView['status'],
    rating: data.rating,
    findings: (Array.isArray(data.findings) ? data.findings : []) as AARFindingItem[],
    created_by: data.created_by ?? '',
    created_at: data.created_at,
  })
}

export async function createAAR(params: {
  drill_id: string
  title: string
  summary?: string | null
  rating?: number | null
  findings?: AARFindingItem[]
  created_by: string
}): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aar_reports')
    .insert({
      drill_id: params.drill_id,
      title: params.title,
      summary: params.summary ?? null,
      rating: params.rating ?? null,
      findings: (params.findings ?? []) as unknown as import('@/types/database.types').Json,
      status: 'draft',
      created_by: params.created_by,
    })
    .select('id')
    .single()
  if (error || !data) return fail('database_error', error?.message ?? 'insert failed')
  return ok({ id: data.id })
}
