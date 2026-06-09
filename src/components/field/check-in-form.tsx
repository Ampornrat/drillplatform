'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { MapPin, Loader2, CheckCircle, RefreshCw } from 'lucide-react'
import { FieldShell } from './field-shell'
import { submitFieldCheckinAction } from '@/actions/field.actions'
import { useFieldQueue } from '@/hooks/use-field-queue'
import { cn } from '@/lib/utils'

interface AssignRow {
  id: string
  status: string
  role_in_drill: string | null
  drill_id: string
  drills: { id: string; title: string; mode: string; status: string } | null
}

interface CheckInFormProps {
  assignments: AssignRow[]
  defaultDrillId: string
  userName: string
}

type CheckInStatus = 'available' | 'deployed' | 'on_scene' | 'completed'

const STATUS_OPTIONS: { id: CheckInStatus; label: string; color: string; border: string; activeBg: string }[] = [
  { id: 'available', label: 'พร้อมใช้งาน', color: 'text-green-700', border: 'border-green-300', activeBg: 'bg-green-50' },
  { id: 'deployed', label: 'กำลังเดินทาง', color: 'text-blue-700', border: 'border-blue-300', activeBg: 'bg-blue-50' },
  { id: 'on_scene', label: 'ถึงที่เกิดเหตุ', color: 'text-amber-700', border: 'border-amber-300', activeBg: 'bg-amber-50' },
  { id: 'completed', label: 'เสร็จสิ้น', color: 'text-gray-700', border: 'border-gray-300', activeBg: 'bg-gray-100' },
]

function toPayload(data: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '') out[k] = String(v)
  }
  return out
}

export function CheckInForm({ assignments, defaultDrillId, userName }: CheckInFormProps) {
  const [drillId, setDrillId] = useState(defaultDrillId)
  const [status, setStatus] = useState<CheckInStatus>('available')
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const queueAction = useCallback(async (payload: Record<string, string>) => {
    const fd = new FormData()
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
    const result = await submitFieldCheckinAction(fd)
    return { ok: result.ok, message: result.ok ? undefined : result.message }
  }, [])

  const queue = useFieldQueue('check_in', queueAction)

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับ GPS')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setGpsLoading(false)
        toast.success('จับพิกัด GPS สำเร็จ')
      },
      err => {
        setGpsLoading(false)
        toast.error(`GPS: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    captureGps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = () => {
    if (!drillId) { toast.error('กรุณาเลือก Drill'); return }
    const payload = toPayload({
      drill_id: drillId,
      status,
      lat: gps?.lat,
      lng: gps?.lng,
      accuracy: gps?.accuracy,
      notes: notes || undefined,
    })

    if (!queue.isOnline) {
      queue.enqueue(payload)
      toast.warning('ออฟไลน์ — บันทึกไว้แล้ว จะส่งเมื่อเชื่อมต่ออีกครั้ง')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      const result = await submitFieldCheckinAction(fd)
      if (result.ok) {
        setSuccess(true)
        toast.success('Check-in สำเร็จ!')
        setTimeout(() => setSuccess(false), 3000)
      } else {
        queue.enqueue(payload)
        toast.error(result.message + ' — บันทึกไว้ใน queue')
      }
    })
  }

  if (success) {
    return (
      <FieldShell title="Check-in" backHref="/field">
        <div className="flex flex-col items-center justify-center py-24 px-8 gap-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">Check-in สำเร็จ</p>
          <p className="text-sm text-gray-500">สถานะ: <strong>{STATUS_OPTIONS.find(s => s.id === status)?.label}</strong></p>
          {gps && <p className="text-xs text-gray-400 font-mono">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} ±{Math.round(gps.accuracy)}m</p>}
        </div>
      </FieldShell>
    )
  }

  return (
    <FieldShell title="Team Check-in" backHref="/field">
      <div className="p-4 space-y-5">
        {/* User info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">ผู้ใช้งาน</p>
          <p className="text-base font-bold text-blue-900 mt-0.5">{userName}</p>
        </div>

        {/* Drill select */}
        {assignments.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">เลือก Drill</label>
            <div className="space-y-2">
              {assignments.map(a => a.drills && (
                <button
                  key={a.drill_id}
                  onClick={() => setDrillId(a.drill_id)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border-2 transition-colors',
                    drillId === a.drill_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  )}
                >
                  <p className="font-semibold text-sm text-gray-900">{a.drills.title}</p>
                  {a.role_in_drill && <p className="text-xs text-blue-600 mt-0.5">{a.role_in_drill}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">สถานะ</label>
          <div className="space-y-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setStatus(opt.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left',
                  status === opt.id ? `${opt.activeBg} ${opt.border}` : 'bg-white border-gray-200'
                )}
              >
                <span className={cn(
                  'w-3 h-3 rounded-full',
                  opt.id === 'available' ? 'bg-green-500' :
                  opt.id === 'deployed' ? 'bg-blue-500' :
                  opt.id === 'on_scene' ? 'bg-amber-500' : 'bg-gray-400'
                )} />
                <span className={cn('font-semibold text-sm flex-1', status === opt.id ? opt.color : 'text-gray-700')}>
                  {opt.label}
                </span>
                {status === opt.id && <CheckCircle className={cn('w-4 h-4', opt.color)} />}
              </button>
            ))}
          </div>
        </div>

        {/* GPS */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">พิกัด GPS</label>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {gpsLoading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">กำลังจับพิกัด...</span>
              </div>
            ) : gps ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {gps.lat.toFixed(5)}°N, {gps.lng.toFixed(5)}°E
                  </span>
                </div>
                <p className="text-xs text-gray-500">ความแม่นยำ ±{Math.round(gps.accuracy)} ม.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">ยังไม่ได้จับพิกัด</p>
            )}
          </div>
          <button
            onClick={captureGps}
            disabled={gpsLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            จับพิกัด GPS อีกครั้ง
          </button>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">หมายเหตุ (ถ้ามี)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="ระบุตำแหน่ง / หมายเหตุเพิ่มเติม..."
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Pending queue indicator */}
        {queue.pendingCount > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <RefreshCw className="w-4 h-4" />
              รอส่ง {queue.pendingCount} รายการ
            </div>
            <button
              onClick={queue.retryAll}
              disabled={!queue.isOnline}
              className="text-xs text-amber-700 font-semibold disabled:opacity-50"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isPending || !drillId}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> ส่ง Check-in</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">บันทึก TEAM_CHECK_IN · อัปเดต Dashboard</p>
      </div>
    </FieldShell>
  )
}
