import { ok, fail, type ServiceResult } from '@/lib/result'
import { getDrillCOPData } from '@/lib/supabase/queries'

export type COPData = NonNullable<Awaited<ReturnType<typeof getDrillCOPData>>>

export async function getCOPData(drillId: string): Promise<ServiceResult<COPData>> {
  const data = await getDrillCOPData(drillId)
  if (!data) return fail('not_found', 'ไม่พบ Drill สำหรับ COP')
  return ok(data)
}
