import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// One-time admin setup endpoint — blocked after first admin exists
export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Block if any admin already exists
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 })
  }
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Admin already exists' }, { status: 403 })
  }

  const { email, password, full_name } = await req.json()

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'email, password, full_name required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Create user via admin API
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'admin' },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Update profile role to admin
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin', full_name })
    .eq('id', userData.user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: userData.user.email })
}
