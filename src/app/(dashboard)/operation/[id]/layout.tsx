import { redirect } from 'next/navigation'
import { OperationSidebar } from '@/components/operation/operation-sidebar'
import { resolveFullContext, assertCanAccessIncident } from '@/services/context.service'

export default async function OperationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const { id } = await params

  const accessResult = await assertCanAccessIncident(ctx, id)
  if (!accessResult.ok) redirect('/forbidden')

  const roleLabel: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ', commander: 'ผู้บัญชาการ',
    medical: 'ทีมการแพทย์', logistics: 'โลจิสติกส์',
    controller: 'Controller', evaluator: 'ผู้ประเมิน',
    observer: 'ผู้สังเกตการณ์', participant: 'ผู้เข้าร่วม', guest: 'ผู้เยี่ยมชม',
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <OperationSidebar
        incidentId={id}
        mode="operation"
        userName={ctx.profile.full_name ?? null}
        userRole={roleLabel[ctx.role] ?? ctx.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
