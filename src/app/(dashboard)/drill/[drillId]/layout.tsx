import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveFullContext } from '@/services/context.service'
import { getDrillDetail } from '@/services/drill.service'
import { ArrowLeft, Radio } from 'lucide-react'
import DrillSidebarNav from './_nav-link'

interface Props {
  children: React.ReactNode
  params: Promise<{ drillId: string }>
}

export default async function DrillLayout({ children, params }: Props) {
  const { drillId } = await params

  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')

  const { role, profile } = ctxResult.data
  const userName = profile.full_name ?? null
  if (!['admin', 'commander', 'controller', 'evaluator'].includes(role)) {
    redirect('/dashboard')
  }

  const drillResult = await getDrillDetail(drillId, ctxResult.data.userId, role)
  const drillTitle = drillResult.ok ? drillResult.data.title : 'Drill'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-56 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <Link
            href="/planner/drills"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            จัดการ Drills
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{drillTitle}</p>
          </div>
        </div>

        <DrillSidebarNav drillId={drillId} drillTitle={drillTitle} userName={userName} />

        <div className="border-t border-gray-100 p-3">
          <p className="text-xs text-gray-400 px-2 truncate">{userName ?? 'ผู้ใช้งาน'}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
