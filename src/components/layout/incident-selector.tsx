'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Radio, CheckCircle2 } from 'lucide-react'
import { setActiveIncidentAction, clearActiveIncidentAction } from '@/actions/context.actions'
import { toast } from 'sonner'
import type { DrillListItem } from '@/contracts/drill.contract'

const statusLabel: Record<string, string> = {
  draft: 'ร่าง', planned: 'วางแผน', active: 'ดำเนินการ',
  paused: 'หยุดชั่วคราว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
}

interface IncidentSelectorProps {
  incidents: DrillListItem[]
  activeIncidentId: string | null
  trigger?: React.ReactNode
}

export function IncidentSelector({ incidents, activeIncidentId, trigger }: IncidentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function select(id: string) {
    startTransition(async () => {
      const result = await setActiveIncidentAction(id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setOpen(false)
      toast.success('เลือก Incident แล้ว')
    })
  }

  function clear() {
    startTransition(async () => {
      await clearActiveIncidentAction()
      setOpen(false)
      toast.success('ล้าง Active Incident แล้ว')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            เลือก Incident
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>เลือก Active Incident / Drill</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {incidents.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Incident ที่พร้อมใช้งาน</p>
          )}
          {incidents.map((item) => {
            const isActive = item.id === activeIncidentId
            return (
              <button
                key={item.id}
                disabled={pending}
                onClick={() => select(item.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                    </Badge>
                    <Badge
                      variant={item.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {statusLabel[item.status] ?? item.status}
                    </Badge>
                  </div>
                  {item.location && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.location}</p>
                  )}
                </div>
                {isActive && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>
        {activeIncidentId && (
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={clear} disabled={pending} className="text-gray-500 hover:text-red-600 text-xs">
              ล้าง Active Incident
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
