import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type { Profile } from '@/types'

export async function getSession(): Promise<ServiceResult<{ id: string; email: string | undefined }>> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return fail('unauthorized', 'ไม่ได้เข้าสู่ระบบ')
  return ok({ id: user.id, email: user.email })
}

export async function getProfile(userId: string): Promise<ServiceResult<Profile>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !data) return fail('not_found', 'ไม่พบข้อมูลผู้ใช้')
  return ok(data as unknown as Profile)
}

export async function getSessionWithProfile(): Promise<
  ServiceResult<{ userId: string; profile: Profile }>
> {
  const sessionResult = await getSession()
  if (!sessionResult.ok) return sessionResult

  const profileResult = await getProfile(sessionResult.data.id)
  if (!profileResult.ok) return profileResult

  return ok({ userId: sessionResult.data.id, profile: profileResult.data })
}
