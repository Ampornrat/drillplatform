'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Package, RefreshCw } from 'lucide-react'
import { FieldShell } from './field-shell'
import { submitFieldSupplyRequestAction } from '@/actions/field.actions'
import { useFieldQueue } from '@/hooks/use-field-queue'
import { cn } from '@/lib/utils'

interface SupplyRequestFormProps {
  drillId: string
  drillTitle: string
}

type Priority = 'routine' | 'urgent' | 'immediate'

const PRIORITY_OPTIONS: { id: Priority; label: string; color: string; bg: string; border: string }[] = [
  { id: 'routine', label: 'ปกติ', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' },
  { id: 'urgent', label: 'เร่งด่วน', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-400' },
  { id: 'immediate', label: 'ด่วนมาก', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-500' },
]

const COMMON_ITEMS = [
  'เลือด O-neg', 'ออกซิเจน', 'น้ำเกลือ', 'ชุด tourniquet',
  'เปล', 'AED', 'ยาแก้ปวด', 'Chest seal', 'ถุงมือยาง', 'Splint',
]

function toPayload(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = String(v)
  }
  return out
}

export function SupplyRequestForm({ drillId, drillTitle }: SupplyRequestFormProps) {
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('ชิ้น')
  const [priority, setPriority] = useState<Priority>('urgent')
  const [destination, setDestination] = useState('')
  const [neededAt, setNeededAt] = useState('')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const queueAction = useCallback(async (payload: Record<string, string>) => {
    const fd = new FormData()
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
    const result = await submitFieldSupplyRequestAction(fd)
    return { ok: result.ok, message: result.ok ? undefined : result.message }
  }, [])

  const queue = useFieldQueue('supply_request', queueAction)

  const handleSubmit = () => {
    if (!itemName.trim()) { toast.error('กรุณาระบุชื่อสิ่งของ'); return }
    if (!drillId) { toast.error('ไม่พบ Active Drill — กลับไปตั้งค่า Context'); return }
    const payload = toPayload({
      drill_id: drillId,
      item_name: itemName.trim(),
      quantity,
      unit,
      priority,
      destination: destination || undefined,
      needed_at: neededAt || undefined,
      notes: notes || undefined,
    })

    if (!queue.isOnline) {
      queue.enqueue(payload)
      toast.warning('ออฟไลน์ — บันทึกไว้แล้ว')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      const result = await submitFieldSupplyRequestAction(fd)
      if (result.ok) {
        setSuccess(true)
        toast.success('ส่งคำขอสนับสนุนสำเร็จ!')
        setTimeout(() => { setSuccess(false); setItemName(''); setQuantity('1') }, 3000)
      } else {
        queue.enqueue(payload)
        toast.error(result.message + ' — บันทึกไว้ใน queue')
      }
    })
  }

  if (success) {
    return (
      <FieldShell title="ขอสนับสนุน" backHref="/field">
        <div className="flex flex-col items-center justify-center py-24 px-8 gap-4 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">ส่งคำขอสำเร็จ</p>
          <p className="text-sm text-gray-500">
            {itemName} × {quantity} {unit} — <strong>{PRIORITY_OPTIONS.find(p => p.id === priority)?.label}</strong>
          </p>
          <p className="text-xs text-gray-400">Logistics จะได้รับแจ้งทันที</p>
        </div>
      </FieldShell>
    )
  }

  return (
    <FieldShell title="ขอสนับสนุน" backHref="/field">
      <div className="p-4 space-y-5">
        {/* Active drill context */}
        {drillTitle && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
            <p className="text-xs text-purple-500 font-medium">ปฏิบัติการ</p>
            <p className="text-sm font-bold text-purple-900 mt-0.5 truncate">{drillTitle}</p>
          </div>
        )}

        {/* Common items quick select */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">เลือกสิ่งของด่วน</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_ITEMS.map(item => (
              <button
                key={item}
                onClick={() => setItemName(item)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  itemName === item
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Item name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ชื่อสิ่งของ *</label>
          <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-500 bg-white">
            <Package className="w-4 h-4 text-gray-400 ml-3" />
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="ระบุชื่อสิ่งของ..."
              className="flex-1 py-3 pr-3 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">จำนวน</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">หน่วย</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:border-purple-500 bg-white"
            >
              {['ชิ้น', 'ยูนิต', 'กล่อง', 'ถุง', 'ขวด', 'ม้วน', 'ชุด', 'คน'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ลำดับความสำคัญ</label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITY_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPriority(opt.id)}
                className={cn(
                  'py-3 rounded-xl border-2 font-bold text-sm transition-all',
                  priority === opt.id
                    ? `${opt.bg} ${opt.border} ${opt.color} scale-105`
                    : 'bg-white border-gray-200 text-gray-600'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ส่งไปที่ (ถ้ามี)</label>
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="เช่น SITE-A, จุดปฐมพยาบาล"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Needed at */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ต้องการภายใน (ถ้ามี)</label>
          <input
            type="datetime-local"
            value={neededAt}
            onChange={e => setNeededAt(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">หมายเหตุ</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="รายละเอียดเพิ่มเติม..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Queue indicator */}
        {queue.pendingCount > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <RefreshCw className="w-4 h-4" />
              รอส่ง {queue.pendingCount} รายการ
            </div>
            <button onClick={queue.retryAll} disabled={!queue.isOnline} className="text-xs text-amber-700 font-semibold disabled:opacity-50">
              ลองใหม่
            </button>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isPending || !itemName.trim()}
          className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform disabled:opacity-60"
        >
          {isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
          ) : (
            <><Package className="w-5 h-5" /> ส่งคำขอสนับสนุน</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">บันทึก SUPPLY_REQUESTED · แจ้ง Logistics</p>
      </div>
    </FieldShell>
  )
}
