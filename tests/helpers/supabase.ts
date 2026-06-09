/**
 * Test Supabase helpers.
 * Uses SUPABASE_SERVICE_ROLE_KEY for admin operations (user creation, cleanup).
 * Uses SUPABASE_ANON_KEY + email/password for role-specific sessions.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'DrillTest2026!'

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

/** Admin client — bypasses RLS, used for seeding and cleanup only. */
export function adminClient() {
  if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Anon client — sign-in required before use. */
export function anonClient() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Sign in as a test role and return an authenticated client. */
export async function clientAs(role: TestRole) {
  const email = TEST_EMAILS[role]
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message}`)
  }
  return client
}

export type TestRole =
  | 'admin'
  | 'commander'
  | 'medical'
  | 'logistics'
  | 'controller'
  | 'evaluator'
  | 'field'

export const TEST_EMAILS: Record<TestRole, string> = {
  admin:      'admin@drill.test',
  commander:  'commander@drill.test',
  medical:    'medical@drill.test',
  logistics:  'logistics@drill.test',
  controller: 'controller@drill.test',
  evaluator:  'evaluator@drill.test',
  field:      'field@drill.test',
}
