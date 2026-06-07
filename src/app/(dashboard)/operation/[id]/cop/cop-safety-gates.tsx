'use client'

import { useState, useTransition } from 'react'
import { upsertDrillSafetyGateAction } from '@/lib/supabase/actions'
import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Gate {
  id: string
  name: string
  condition_type: string
  action: string
  status: string
}

interface Props {
  drillId: string
  gates: Gate[]
  canManage: boolean
}

const gateStatusColor: Record<string, string> = {
  passed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  waived: 'bg-gray-100 text-gray-600 border-gray-200',
}
const gateStatusLabel: Record<string, string> = {
  passed: 'PASSED', pending: 'PENDING', failed: 'FAILED', waived: 'WAIVED',
}

export function CopSafetyGates({ drillId, gates, canManage }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [localGates, setLocalGates] = useState<Gate[]>(gates)

  function update(ruleId: string, status: 'passed' | 'failed' | 'waived') {
    setPendingId(ruleId)
    startTransition(async () => {
      const result = await upsertDrillSafetyGateAction(drillId, ruleId, status)
      if (result?.error) {
        toast.error('อัปเดต Safety Gate ไม่สำเร็จ', { description: result.error })
      } else {
        toast.success(`Safety Gate: ${gateStatusLabel[status]}`)
        setLocalGates(prev =>
          prev.map(g => g.id === ruleId ? { ...g, status } : g)
        )
      }
      setPendingId(null)
    })
  }

  if (localGates.length === 0) {
    return <p className="text-xs text-gray-400">ไม่มี Safety Gate Rules</p>
  }

  return (
    <div className="space-y-2.5">
      {localGates.map((gate) => (
        <div key={gate.id}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <div className="text-xs font-medium text-gray-700 truncate">{gate.name}</div>
              <div className="text-xs text-gray-400 capitalize">{gate.condition_type}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${gateStatusColor[gate.status] ?? gateStatusColor.pending}`}>
              {gateStatusLabel[gate.status] ?? 'PENDING'}
            </span>
          </div>
          {canManage && gate.status !== 'passed' && gate.status !== 'waived' && (
            <div className="flex gap-2 justify-end mt-1">
              {isPending && pendingId === gate.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              ) : (
                <>
                  <button
                    onClick={() => update(gate.id, 'passed')}
                    disabled={isPending}
                    className="flex items-center gap-0.5 text-xs text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Pass
                  </button>
                  <button
                    onClick={() => update(gate.id, 'failed')}
                    disabled={isPending}
                    className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    Fail
                  </button>
                  <button
                    onClick={() => update(gate.id, 'waived')}
                    disabled={isPending}
                    className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-600 disabled:opacity-50"
                  >
                    <MinusCircle className="w-3 h-3" />
                    Waive
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
