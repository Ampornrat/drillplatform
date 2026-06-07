'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, AlertTriangle, CheckCircle2, Activity, Droplets, Wind, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateFacilityStatusAction } from '@/actions/facility.actions'
import type { FacilityStatusFull, FacilityLevel } from '@/contracts/op.contract'
import { cn } from '@/lib/utils'

const FACILITY_LEVELS: FacilityLevel[] = ['CoE', 'Role3', 'Role2', 'Role1', 'CCP']

const levelColor: Record<string, string> = {
  CoE:   'bg-purple-100 text-purple-700 border-purple-200',
  Role3: 'bg-red-100 text-red-700 border-red-200',
  Role2: 'bg-orange-100 text-orange-700 border-orange-200',
  Role1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CCP:   'bg-blue-100 text-blue-700 border-blue-200',
}

const diversionColor: Record<string, string> = {
  open:       'bg-green-100 text-green-700',
  divert:     'bg-orange-100 text-orange-700',
  overloaded: 'bg-red-100 text-red-700',
  closed:     'bg-gray-200 text-gray-700',
}

const diversionLabel: Record<string, string> = {
  open: 'รับผู้ป่วย', divert: 'Divert', overloaded: 'Overload', closed: 'ปิด',
}

interface Props {
  drillId: string
  initialFacilities: FacilityStatusFull[]
}

export function FacilityBoard({ drillId, initialFacilities }: Props) {
  const [facilities, setFacilities] = useState<FacilityStatusFull[]>(initialFacilities)
  const [activeLevel, setActiveLevel] = useState<FacilityLevel | 'all'>('all')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Realtime updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`facility:${drillId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'facility_status',
        filter: `drill_id=eq.${drillId}`,
      }, (payload) => {
        const row = payload.new as FacilityStatusFull
        setFacilities(prev => {
          const idx = prev.findIndex(f => f.site_code === row.site_code)
          if (idx >= 0) return prev.map((f, i) => i === idx ? row : f)
          return [...prev, row]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [drillId])

  const filtered = activeLevel === 'all'
    ? facilities
    : facilities.filter(f => f.facility_level === activeLevel)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const result = await updateFacilityStatusAction(fd)
      if (!result.ok) {
        toast.error('อัปเดตไม่สำเร็จ', { description: result.message })
      } else {
        toast.success('อัปเดตสถานะสถานพยาบาลแล้ว')
        setEditingCode(null)
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Level filter */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-gray-50 shrink-0 flex-wrap">
        <button
          onClick={() => setActiveLevel('all')}
          className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
            activeLevel === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'
          )}
        >
          ทั้งหมด
        </button>
        {FACILITY_LEVELS.map(l => (
          <button
            key={l}
            onClick={() => setActiveLevel(l)}
            className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
              activeLevel === l ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Facility cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            ไม่มีข้อมูลสถานพยาบาล<br />
            <span className="text-gray-300">ใช้ปุ่ม + เพิ่มสถานะแรก</span>
          </div>
        )}
        {filtered.map((f) => (
          <div key={f.site_code} className="bg-white rounded-xl border overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center gap-2 p-3 cursor-pointer select-none"
              onClick={() => setExpandedCode(expandedCode === f.site_code ? null : f.site_code)}
            >
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0',
                f.diversion_status === 'open' ? 'bg-green-500' :
                f.diversion_status === 'divert' ? 'bg-orange-500' :
                f.diversion_status === 'overloaded' ? 'bg-red-500' : 'bg-gray-400'
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {f.site_name ?? f.site_code}
                  </span>
                  {f.facility_level && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-md border font-medium', levelColor[f.facility_level] ?? 'bg-gray-100 text-gray-600')}>
                      {f.facility_level}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 font-mono">{f.site_code}</div>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', diversionColor[f.diversion_status ?? 'open'])}>
                {diversionLabel[f.diversion_status ?? 'open']}
              </span>
              {expandedCode === f.site_code
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              }
            </div>

            {/* Capacity bars */}
            <div className="px-3 pb-2">
              {/* General beds */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400 w-10 shrink-0">Bed</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all',
                      (f.load_pct ?? 0) >= 90 ? 'bg-red-500' :
                      (f.load_pct ?? 0) >= 70 ? 'bg-orange-400' : 'bg-green-500'
                    )}
                    style={{ width: `${Math.min(f.load_pct ?? 0, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 tabular-nums w-16 text-right shrink-0">
                  {f.current_load}/{f.capacity ?? '∞'}
                </span>
              </div>
              {/* ICU */}
              {f.icu_beds_total > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 w-10 shrink-0">ICU</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all',
                        f.icu_beds_available === 0 ? 'bg-red-500' :
                        f.icu_beds_available <= 2 ? 'bg-orange-400' : 'bg-green-500'
                      )}
                      style={{ width: `${Math.min(((f.icu_beds_total - f.icu_beds_available) / Math.max(f.icu_beds_total, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={cn('text-xs tabular-nums w-16 text-right shrink-0',
                    f.icu_beds_available === 0 ? 'text-red-600 font-semibold' : 'text-gray-500'
                  )}>
                    {f.icu_beds_available} ว่าง
                  </span>
                </div>
              )}
              {/* Resource indicators */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                  f.or_available ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                )}>
                  <Activity className="w-3 h-3" />
                  OR {f.or_available ? 'ว่าง' : 'เต็ม'}
                </span>
                <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                  f.blood_available ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                )}>
                  <Droplets className="w-3 h-3" />
                  {f.blood_available ? 'เลือดพอ' : 'เลือดน้อย'}
                </span>
                <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                  f.oxygen_level === 'normal' ? 'bg-green-50 text-green-600' :
                  f.oxygen_level === 'low' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                )}>
                  <Wind className="w-3 h-3" />
                  O₂ {f.oxygen_level === 'normal' ? 'ปกติ' : f.oxygen_level === 'low' ? 'ต่ำ' : 'วิกฤต'}
                </span>
              </div>
            </div>

            {/* Expanded: edit form */}
            {expandedCode === f.site_code && (
              <div className="border-t bg-gray-50 p-3">
                {editingCode === f.site_code ? (
                  <form onSubmit={handleUpdate} className="space-y-2.5">
                    <input type="hidden" name="drill_id" value={drillId} />
                    <input type="hidden" name="site_code" value={f.site_code} />
                    <input type="hidden" name="site_name" value={f.site_name ?? ''} />
                    {f.facility_level && <input type="hidden" name="facility_level" value={f.facility_level} />}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">สถานะ</label>
                        <select
                          name="status"
                          defaultValue={f.status}
                          className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                        >
                          <option value="normal">Normal</option>
                          <option value="surge">Surge</option>
                          <option value="critical">Critical</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Diversion</label>
                        <select
                          name="diversion_status"
                          defaultValue={f.diversion_status}
                          className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                        >
                          <option value="open">Open</option>
                          <option value="divert">Divert</option>
                          <option value="overloaded">Overloaded</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">ผู้ป่วยปัจจุบัน</label>
                        <input
                          type="number" name="current_load" min={0}
                          defaultValue={f.current_load}
                          className="w-full text-xs border rounded px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">ความจุ</label>
                        <input
                          type="number" name="capacity" min={0}
                          defaultValue={f.capacity ?? ''}
                          className="w-full text-xs border rounded px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">ICU ว่าง</label>
                        <input
                          type="number" name="icu_beds_available" min={0}
                          defaultValue={f.icu_beds_available}
                          className="w-full text-xs border rounded px-2 py-1.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">ICU ทั้งหมด</label>
                        <input
                          type="number" name="icu_beds_total" min={0}
                          defaultValue={f.icu_beds_total}
                          className="w-full text-xs border rounded px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">O₂</label>
                        <select
                          name="oxygen_level"
                          defaultValue={f.oxygen_level}
                          className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                        >
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox" name="or_available"
                          defaultChecked={f.or_available}
                          value="true"
                          className="rounded"
                        />
                        OR ว่าง
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox" name="blood_available"
                          defaultChecked={f.blood_available}
                          value="true"
                          className="rounded"
                        />
                        เลือดพอ
                      </label>
                    </div>

                    <input
                      type="text" name="notes"
                      defaultValue={f.notes ?? ''}
                      placeholder="หมายเหตุ..."
                      className="w-full text-xs border rounded px-2 py-1.5"
                    />

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button" variant="ghost" size="sm"
                        className="text-xs h-7"
                        onClick={() => setEditingCode(null)}
                      >
                        ยกเลิก
                      </Button>
                      <Button
                        type="submit" size="sm"
                        className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'บันทึก'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      {f.notes ?? 'ไม่มีหมายเหตุ'} · อัปเดต {new Date(f.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <Button
                      variant="outline" size="sm"
                      className="text-xs h-7"
                      onClick={() => setEditingCode(f.site_code)}
                    >
                      อัปเดตสถานะ
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new facility status entry */}
      <div className="border-t p-3 shrink-0">
        <NewFacilityForm drillId={drillId} />
      </div>
    </div>
  )
}

function NewFacilityForm({ drillId }: { drillId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs text-blue-600 border border-dashed border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition-colors"
      >
        + เพิ่มสถานพยาบาล / อัปเดตใหม่
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateFacilityStatusAction(fd)
      if (!result.ok) {
        toast.error('เพิ่มไม่สำเร็จ', { description: result.message })
      } else {
        toast.success('เพิ่มสถานพยาบาลแล้ว')
        setOpen(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="drill_id" value={drillId} />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" name="site_code" required
          placeholder="รหัส เช่น HOSP-R3-01"
          className="text-xs border rounded px-2 py-1.5"
        />
        <input
          type="text" name="site_name"
          placeholder="ชื่อสถานพยาบาล"
          className="text-xs border rounded px-2 py-1.5"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="facility_level" className="text-xs border rounded px-2 py-1.5 bg-white">
          <option value="">ระดับ...</option>
          <option value="CoE">CoE</option>
          <option value="Role3">Role 3</option>
          <option value="Role2">Role 2</option>
          <option value="Role1">Role 1</option>
          <option value="CCP">CCP</option>
        </select>
        <select name="diversion_status" defaultValue="open" className="text-xs border rounded px-2 py-1.5 bg-white">
          <option value="open">Open</option>
          <option value="divert">Divert</option>
          <option value="overloaded">Overloaded</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <input type="hidden" name="status" value="normal" />
      <input type="hidden" name="current_load" value="0" />
      <input type="hidden" name="icu_beds_total" value="0" />
      <input type="hidden" name="icu_beds_available" value="0" />
      <input type="hidden" name="or_available" value="true" />
      <input type="hidden" name="blood_available" value="true" />
      <input type="hidden" name="oxygen_level" value="normal" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
        <Button type="submit" size="sm" className="text-xs h-7 bg-blue-600 hover:bg-blue-700" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'เพิ่ม'}
        </Button>
      </div>
    </form>
  )
}
