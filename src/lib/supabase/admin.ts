/**
 * Supabase admin client — uses service_role key.
 * SERVER-ONLY. Never import this in any client component or browser bundle.
 * Use only for: background jobs, webhooks, admin-only mutations that bypass RLS.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Guard: fail at module load time if accidentally bundled for the browser.
if (typeof window !== 'undefined') {
  throw new Error(
    'admin.ts imported in a browser context — this file is server-only.'
  )
}

let _admin: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createAdminClient() {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set'
    )
  }
  _admin = createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
