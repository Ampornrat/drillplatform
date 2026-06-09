'use client'

import { Radio, FlaskConical, AlertCircle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { IncidentSelector } from './incident-selector'
import { ScenarioSelector } from './scenario-selector'
import { clearActiveIncidentAction, clearActiveScenarioAction } from '@/actions/context.actions'
import { useTransition } from 'react'
import { toast } from 'sonner'
import type { AppCtx } from '@/types'
import type { DrillListItem, ScenarioSummary } from '@/contracts/drill.contract'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { CriticalAlertBanner } from '@/components/notifications/critical-alert-banner'

interface ActiveContextBarProps {
  ctx: AppCtx
  availableIncidents: DrillListItem[]
  availableScenarios: ScenarioSummary[]
}

const ROLES_NEEDING_INCIDENT: AppCtx['role'][] = ['admin', 'commander', 'medical', 'logistics', 'evaluator', 'observer']
const ROLES_NEEDING_SCENARIO: AppCtx['role'][] = ['admin', 'commander', 'controller', 'evaluator']

export function ActiveContextBar({ ctx, availableIncidents, availableScenarios }: ActiveContextBarProps) {
  const [pending, startTransition] = useTransition()

  const { notifications, unreadCount, criticalUnread, loading, markRead, markAllRead, dismiss } =
    useNotifications({ userId: ctx.userId, activeIncidentId: ctx.activeIncidentId })

  const needsIncident = ROLES_NEEDING_INCIDENT.includes(ctx.role)
  const needsScenario = ROLES_NEEDING_SCENARIO.includes(ctx.role)

  const hasWarning =
    (needsIncident && !ctx.activeIncidentId) ||
    (needsScenario && !ctx.activeScenarioId)

  function clearIncident() {
    startTransition(async () => {
      await clearActiveIncidentAction()
      toast.success('ล้าง Active Incident แล้ว')
    })
  }

  function clearScenario() {
    startTransition(async () => {
      await clearActiveScenarioAction()
      toast.success('ล้าง Active Scenario แล้ว')
    })
  }

  return (
    <>
      <div className={`flex items-center gap-2 px-4 py-1.5 border-b text-sm flex-wrap ${
        hasWarning && (needsIncident || needsScenario)
          ? 'bg-amber-50 border-amber-200'
          : 'bg-gray-50 border-gray-200'
      }`}>

        {/* Incident section */}
        {needsIncident && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Radio className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            {ctx.activeIncidentId ? (
              <>
                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700 gap-1">
                  {ctx.activeIncidentMode === 'drill' ? 'Drill' : 'Op'}:
                  <span className="max-w-[120px] truncate">{ctx.activeIncidentTitle}</span>
                </Badge>
                <button
                  onClick={clearIncident}
                  disabled={pending}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="ล้าง active incident"
                >
                  <X className="w-3 h-3" />
                </button>
                <IncidentSelector
                  incidents={availableIncidents}
                  activeIncidentId={ctx.activeIncidentId}
                  trigger={
                    <button className="text-xs text-blue-600 hover:underline">เปลี่ยน</button>
                  }
                />
              </>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                ยังไม่มี Incident ที่ Active
                <IncidentSelector
                  incidents={availableIncidents}
                  activeIncidentId={null}
                  trigger={
                    <button className="text-blue-600 hover:underline ml-1">เลือก</button>
                  }
                />
              </span>
            )}
          </div>
        )}

        {needsIncident && needsScenario && (
          <span className="text-gray-300 select-none">|</span>
        )}

        {/* Scenario section */}
        {needsScenario && (
          <div className="flex items-center gap-1.5 shrink-0">
            <FlaskConical className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            {ctx.activeScenarioId ? (
              <>
                <Badge variant="outline" className="text-xs bg-purple-50 border-purple-300 text-purple-700 gap-1">
                  <span className="font-mono">{ctx.activeScenarioCode}</span>
                </Badge>
                <button
                  onClick={clearScenario}
                  disabled={pending}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="ล้าง active scenario"
                >
                  <X className="w-3 h-3" />
                </button>
                <ScenarioSelector
                  scenarios={availableScenarios}
                  activeScenarioId={ctx.activeScenarioId}
                  trigger={
                    <button className="text-xs text-purple-600 hover:underline">เปลี่ยน</button>
                  }
                />
              </>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                ยังไม่มี Scenario ที่ Active
                <ScenarioSelector
                  scenarios={availableScenarios}
                  activeScenarioId={null}
                  trigger={
                    <button className="text-blue-600 hover:underline ml-1">เลือก</button>
                  }
                />
              </span>
            )}
          </div>
        )}

        {/* Notification bell — always on the right */}
        <div className="ml-auto shrink-0">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            loading={loading}
            onMarkRead={markRead}
            onMarkAllRead={() => void markAllRead()}
            onDismiss={dismiss}
            activeIncidentId={ctx.activeIncidentId}
          />
        </div>
      </div>

      {/* Critical alert banner sits directly below the context bar */}
      <CriticalAlertBanner
        criticalUnread={criticalUnread}
        onMarkRead={id => void markRead(id)}
        onMarkAllRead={() => void markAllRead()}
      />
    </>
  )
}
