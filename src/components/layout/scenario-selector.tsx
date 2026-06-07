'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FlaskConical, CheckCircle2 } from 'lucide-react'
import { setActiveScenarioAction, clearActiveScenarioAction } from '@/actions/context.actions'
import { toast } from 'sonner'
import type { ScenarioSummary } from '@/contracts/drill.contract'

interface ScenarioSelectorProps {
  scenarios: ScenarioSummary[]
  activeScenarioId: string | null
  trigger?: React.ReactNode
}

export function ScenarioSelector({ scenarios, activeScenarioId, trigger }: ScenarioSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function select(id: string) {
    startTransition(async () => {
      const result = await setActiveScenarioAction(id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setOpen(false)
      toast.success('เลือก Scenario แล้ว')
    })
  }

  function clear() {
    startTransition(async () => {
      await clearActiveScenarioAction()
      setOpen(false)
      toast.success('ล้าง Active Scenario แล้ว')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            เลือก Scenario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>เลือก Active Scenario</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {scenarios.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Scenario ที่พร้อมใช้งาน</p>
          )}
          {scenarios.map((s) => {
            const isActive = s.id === activeScenarioId
            return (
              <button
                key={s.id}
                disabled={pending}
                onClick={() => select(s.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-purple-700 shrink-0">[{s.code}]</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{s.mode}</Badge>
                    <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                    {s.scenarioType && (
                      <span className="text-xs text-gray-400">{s.scenarioType}</span>
                    )}
                  </div>
                </div>
                {isActive && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>
        {activeScenarioId && (
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={clear} disabled={pending} className="text-gray-500 hover:text-red-600 text-xs">
              ล้าง Active Scenario
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
