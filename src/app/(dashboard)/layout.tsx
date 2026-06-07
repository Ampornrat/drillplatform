import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ActiveContextBar } from '@/components/layout/active-context-bar'
import { AppContextProvider } from '@/components/providers/app-context-provider'
import { resolveFullContext, toAppCtx } from '@/services/context.service'
import { getDrillsList } from '@/services/drill.service'
import { getScenarios } from '@/services/scenario.service'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')

  const ctx = ctxResult.data
  const appCtx = toAppCtx(ctx)

  const [incidentsResult, scenariosResult] = await Promise.all([
    getDrillsList({ limit: 30, status: ['draft', 'planned', 'active', 'paused'] }),
    getScenarios(),
  ])

  const availableIncidents = incidentsResult.ok ? incidentsResult.data : []
  const availableScenarios = scenariosResult.ok ? scenariosResult.data : []

  return (
    <AppContextProvider ctx={appCtx}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar ctx={appCtx} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ActiveContextBar
            ctx={appCtx}
            availableIncidents={availableIncidents}
            availableScenarios={availableScenarios}
          />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AppContextProvider>
  )
}
