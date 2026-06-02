'use client'

import { useState, useTransition } from 'react'
import { updateDrillStatusAction } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Play, Pause, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  drillId: string
  currentStatus: string
  userRole: string
}

const statusTransitions: Record<string, Array<{ to: string; label: string; icon: React.ElementType; variant: 'default' | 'outline' | 'destructive' }>> = {
  draft: [
    { to: 'planned', label: 'ยืนยันแผน', icon: CheckCircle, variant: 'outline' },
  ],
  planned: [
    { to: 'active', label: 'เริ่ม Drill', icon: Play, variant: 'default' },
    { to: 'cancelled', label: 'ยกเลิก', icon: XCircle, variant: 'destructive' },
  ],
  active: [
    { to: 'paused', label: 'หยุดชั่วคราว', icon: Pause, variant: 'outline' },
    { to: 'completed', label: 'สิ้นสุด', icon: CheckCircle, variant: 'default' },
  ],
  paused: [
    { to: 'active', label: 'ดำเนินการต่อ', icon: Play, variant: 'default' },
    { to: 'completed', label: 'สิ้นสุด', icon: CheckCircle, variant: 'outline' },
  ],
  completed: [],
  cancelled: [],
}

export function DrillStatusActions({ drillId, currentStatus, userRole }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  const canChange = ['admin', 'commander'].includes(userRole)
  const transitions = statusTransitions[currentStatus] ?? []

  if (!canChange || transitions.length === 0) return null

  function handleChange(toStatus: string) {
    setPendingStatus(toStatus)
    startTransition(async () => {
      const result = await updateDrillStatusAction(drillId, toStatus)
      if (result?.error) {
        toast.error('เปลี่ยนสถานะไม่สำเร็จ', { description: result.error })
      } else {
        toast.success('เปลี่ยนสถานะสำเร็จ')
      }
      setPendingStatus(null)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus === 'active' && (
        <Button size="sm" asChild variant="outline">
          <Link href={`/operation/${drillId}/cop`}>เปิด COP</Link>
        </Button>
      )}
      {transitions.map(t => {
        const isLoading = isPending && pendingStatus === t.to
        return (
          <Button
            key={t.to}
            size="sm"
            variant={t.variant}
            disabled={isPending}
            onClick={() => handleChange(t.to)}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <t.icon className="w-3.5 h-3.5 mr-1.5" />
            )}
            {t.label}
          </Button>
        )
      })}
    </div>
  )
}
