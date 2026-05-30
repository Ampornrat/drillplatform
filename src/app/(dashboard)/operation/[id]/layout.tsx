import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OperationSidebar } from '@/components/operation/operation-sidebar'

export default async function OperationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const { id } = await params
  const roleLabel: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ',
    commander: 'ผู้บัญชาการ',
    observer: 'ผู้สังเกตการณ์',
    participant: 'ผู้เข้าร่วม',
    guest: 'ผู้เยี่ยมชม',
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <OperationSidebar
        incidentId={id}
        mode="operation"
        userName={profile?.full_name ?? user.email ?? null}
        userRole={roleLabel[profile?.role ?? 'participant']}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
