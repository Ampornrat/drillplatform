'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  ChevronLeft, Activity, Wrench, Zap, BookOpen, CheckCircle2,
  Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  updateObjectReadinessAction,
  changeObjectStatusAction,
  assignObjectCapabilityAction,
  attachObjectStandardAction,
  markObjectMaintenanceAction,
} from '@/actions/object.actions'
import { cn } from '@/lib/utils'
import type { ObjectRegistryItem, LifecycleEvent, CapabilityItem } from '@/contracts/registry.contract'
import type { StandardEntry } from '@/contracts/registry.contract'

// ── Lookups ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100 text-green-800 border-green-200',
  en_route:    'bg-blue-100 text-blue-800 border-blue-200',
  on_scene:    'bg-orange-100 text-orange-800 border-orange-200',
  standby:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  unavailable: 'bg-gray-100 text-gray-600 border-gray-200',
  maintenance: 'bg-red-100 text-red-800 border-red-200',
  demobilized: 'bg-gray-200 text-gray-500 border-gray-300',
}
const STATUS_LABELS: Record<string, string> = {
  available: 'ว่าง', en_route: 'กำลังส่ง', on_scene: 'ที่เกิดเหตุ',
  standby: 'Standby', unavailable: 'ไม่พร้อม', maintenance: 'ซ่อมบำรุง', demobilized: 'ปลดประจำการ',
}
const TYPE_LABELS: Record<string, string> = {
  ambulance: 'รถพยาบาล', boat: 'เรือ', HEMS: 'HEMS', UAV: 'UAV',
  ALS_unit: 'ALS Unit', BLS_unit: 'BLS Unit',
  personnel: 'บุคลากร', unit: 'หน่วย', equipment: 'อุปกรณ์', vehicle: 'ยานพาหนะ', other: 'อื่นๆ',
}
const EVENT_ICONS: Record<string, React.ReactNode> = {
  created:              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  status_change:        <Activity className="w-3.5 h-3.5 text-blue-500" />,
  readiness_update:     <Zap className="w-3.5 h-3.5 text-yellow-500" />,
  capability_assigned:  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />,
  capability_removed:   <XCircle className="w-3.5 h-3.5 text-gray-400" />,
  standard_attached:    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />,
  maintenance_started:  <Wrench className="w-3.5 h-3.5 text-red-500" />,
  maintenance_ended:    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  demobilized:          <XCircle className="w-3.5 h-3.5 text-gray-400" />,
  deployed:             <Activity className="w-3.5 h-3.5 text-blue-500" />,
  returned:             <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
}
const ALLOWED_ROLES = ['admin', 'commander', 'logistics']

interface Props {
  initialObject: ObjectRegistryItem
  initialLifecycle: LifecycleEvent[]
  capabilities: CapabilityItem[]
  standards: StandardEntry[]
  userRole: string
}

export function ObjectPassport({
  initialObject,
  initialLifecycle,
  capabilities,
  standards,
  userRole,
}: Props) {
  const [obj, setObj] = useState(initialObject)
  const [lifecycle, setLifecycle] = useState(initialLifecycle)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [isPending, startTransition] = useTransition()
  const canEdit = ALLOWED_ROLES.includes(userRole)

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`passport:${obj.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'object_registry',
        filter: `id=eq.${obj.id}`,
      }, (payload) => {
        setObj(prev => ({ ...prev, ...(payload.new as Partial<ObjectRegistryItem>) }))
        toast.info('Object อัปเดตแล้ว')
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'lifecycle_events',
        filter: `object_id=eq.${obj.id}`,
      }, (payload) => {
        setLifecycle(prev => [payload.new as LifecycleEvent, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [obj.id])

  function action(e: React.FormEvent<HTMLFormElement>, fn: (fd: FormData) => Promise<{ ok: boolean; message?: string }>, successMsg: string) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('object_id', obj.id)
    startTransition(async () => {
      const result = await fn(fd)
      if (!result.ok) { toast.error((result as { message?: string }).message ?? 'เกิดข้อผิดพลาด'); return }
      toast.success(successMsg)
      setActiveAction(null)
    })
  }

  const readinessColor = obj.readiness >= 80 ? 'text-green-600' : obj.readiness >= 50 ? 'text-orange-500' : 'text-red-500'
  const readinessBarColor = obj.readiness >= 80 ? 'bg-green-500' : obj.readiness >= 50 ? 'bg-orange-400' : 'bg-red-500'
  const metaObj = (obj.meta as Record<string, unknown>) ?? {}

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Breadcrumb */}
      <header className="flex items-center gap-3 px-5 py-3 bg-white border-b shrink-0">
        <Link href="/admin/registry" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4" />
          Registry
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-sm font-semibold text-gray-900">{obj.object_code}</span>
        <span className={cn('ml-auto text-xs font-medium px-2.5 py-1 rounded-full border', STATUS_COLORS[obj.status])}>
          {STATUS_LABELS[obj.status] ?? obj.status}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Passport ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">

          {/* Identity card */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="font-mono text-xs text-gray-400 mb-0.5">OBJECT ID</div>
                <div className="text-2xl font-bold text-gray-900 tracking-wide">{obj.object_code}</div>
                <div className="text-gray-600 mt-1">{obj.name}</div>
              </div>
              {/* Readiness gauge */}
              <div className="text-center shrink-0">
                <div className={cn('text-4xl font-bold tabular-nums', readinessColor)}>{obj.readiness}%</div>
                <div className="text-xs text-gray-400 mt-0.5">Readiness</div>
                <div className="w-20 bg-gray-200 rounded-full h-2 mt-1.5 mx-auto">
                  <div className={cn('h-2 rounded-full transition-all', readinessBarColor)} style={{ width: `${obj.readiness}%` }} />
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Type</dt>
                <dd className="font-medium">{TYPE_LABELS[obj.type] ?? obj.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">เจ้าของ</dt>
                <dd className="font-medium">{obj.owner ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">ฐานที่ตั้ง</dt>
                <dd className="font-medium">{obj.home_location ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">อัปเดตล่าสุด</dt>
                <dd className="font-medium">{format(new Date(obj.updated_at), 'dd MMM yy HH:mm', { locale: th })}</dd>
              </div>
              {obj.drill_id && (
                <div className="col-span-2">
                  <dt className="text-xs text-orange-500 mb-0.5">ประจำการใน Drill</dt>
                  <dd>
                    <Link href={`/operation/${obj.drill_id}/facility`} className="text-blue-600 hover:underline text-xs">
                      {obj.drill_id}
                    </Link>
                  </dd>
                </div>
              )}
              {obj.assigned_patient_id && (
                <div className="col-span-2">
                  <dt className="text-xs text-red-500 mb-0.5">กำลังขนส่งผู้ป่วย</dt>
                  <dd className="text-xs font-mono text-gray-700">{obj.assigned_patient_id}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Capabilities */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Capabilities</h3>
              {canEdit && (
                <button
                  onClick={() => setActiveAction(activeAction === 'capability' ? null : 'capability')}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {activeAction === 'capability' ? 'ปิด' : 'แก้ไข'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {obj.capability.length === 0 && <span className="text-xs text-gray-400">ยังไม่มี Capability</span>}
              {obj.capability.map(c => {
                const cap = capabilities.find(cap => cap.code === c)
                return (
                  <Badge key={c} variant="secondary" className="text-xs gap-1">
                    {cap?.name ?? c}
                    {canEdit && (
                      <button
                        className="hover:text-red-500 ml-0.5"
                        onClick={() => {
                          const fd = new FormData()
                          fd.set('object_id', obj.id)
                          fd.set('capability_code', c)
                          fd.set('action', 'remove')
                          startTransition(async () => {
                            const r = await assignObjectCapabilityAction(fd)
                            if (!r.ok) toast.error(r.message)
                            else {
                              setObj(prev => ({ ...prev, capability: prev.capability.filter(x => x !== c) }))
                              toast.success(`ลบ ${c} แล้ว`)
                            }
                          })
                        }}
                      >×</button>
                    )}
                  </Badge>
                )
              })}
            </div>

            {activeAction === 'capability' && (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  fd.set('object_id', obj.id)
                  fd.set('action', 'add')
                  startTransition(async () => {
                    const r = await assignObjectCapabilityAction(fd)
                    if (!r.ok) { toast.error(r.message); return }
                    const code = fd.get('capability_code') as string
                    setObj(prev => ({ ...prev, capability: Array.from(new Set([...prev.capability, code])) }))
                    toast.success(`เพิ่ม ${code} แล้ว`)
                    setActiveAction(null)
                  })
                }}
                className="mt-3 flex gap-2"
              >
                <Select name="capability_code" required>
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder="เลือก Capability" />
                  </SelectTrigger>
                  <SelectContent>
                    {capabilities
                      .filter(c => !obj.capability.includes(c.code))
                      .map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.category})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="h-8" disabled={isPending}>เพิ่ม</Button>
              </form>
            )}
          </div>

          {/* Limitations */}
          {(obj.limitations.length > 0 || canEdit) && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Limitations</h3>
              <div className="flex flex-wrap gap-1.5">
                {obj.limitations.length === 0 && <span className="text-xs text-gray-400">ไม่มี Limitation</span>}
                {obj.limitations.map((l, i) => (
                  <Badge key={i} variant="outline" className="text-xs text-orange-700 border-orange-200 bg-orange-50">{l}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {obj.notes && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">หมายเหตุ</h3>
              <p className="text-sm text-gray-700">{obj.notes}</p>
            </div>
          )}

          {/* Metadata (collapsible) */}
          <div className="bg-white rounded-xl border shadow-sm">
            <button
              onClick={() => setShowMeta(!showMeta)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900"
            >
              Metadata
              {showMeta ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showMeta && (
              <div className="px-4 pb-4">
                <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-48 text-gray-700">
                  {JSON.stringify(metaObj, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Actions + Timeline ───────────────── */}
        <div className="w-80 flex flex-col border-l bg-white shrink-0 overflow-hidden">

          {/* Action panel */}
          {canEdit && (
            <div className="border-b">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</h3>
              </div>
              <div className="p-3 space-y-2">

                {/* Update readiness */}
                <ActionSection
                  id="readiness"
                  label="อัปเดต Readiness"
                  icon={<Zap className="w-3.5 h-3.5" />}
                  active={activeAction === 'readiness'}
                  onToggle={() => setActiveAction(activeAction === 'readiness' ? null : 'readiness')}
                >
                  <form onSubmit={e => action(e, updateObjectReadinessAction, 'อัปเดต Readiness แล้ว')}>
                    <input type="hidden" name="object_id" value={obj.id} />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input type="number" name="readiness" min={0} max={100}
                          defaultValue={obj.readiness}
                          className="h-7 text-sm w-20" />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      <Input name="notes" placeholder="หมายเหตุ" className="h-7 text-sm" />
                      <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={isPending}>
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'บันทึก'}
                      </Button>
                    </div>
                  </form>
                </ActionSection>

                {/* Change status */}
                <ActionSection
                  id="status"
                  label="เปลี่ยน Status"
                  icon={<Activity className="w-3.5 h-3.5" />}
                  active={activeAction === 'status'}
                  onToggle={() => setActiveAction(activeAction === 'status' ? null : 'status')}
                >
                  <form onSubmit={e => action(e, changeObjectStatusAction, 'เปลี่ยน Status แล้ว')}>
                    <input type="hidden" name="object_id" value={obj.id} />
                    <div className="space-y-2">
                      <Select name="status" defaultValue={obj.status}>
                        <SelectTrigger className="h-7 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input name="notes" placeholder="หมายเหตุ" className="h-7 text-sm" />
                      <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={isPending}>
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'บันทึก'}
                      </Button>
                    </div>
                  </form>
                </ActionSection>

                {/* Attach standard */}
                <ActionSection
                  id="standard"
                  label="Attach Standard"
                  icon={<BookOpen className="w-3.5 h-3.5" />}
                  active={activeAction === 'standard'}
                  onToggle={() => setActiveAction(activeAction === 'standard' ? null : 'standard')}
                >
                  <form onSubmit={e => action(e, attachObjectStandardAction, 'Attach Standard แล้ว')}>
                    <input type="hidden" name="object_id" value={obj.id} />
                    <div className="space-y-2">
                      <Select name="standard_id" required>
                        <SelectTrigger className="h-7 text-sm">
                          <SelectValue placeholder="เลือก Standard" />
                        </SelectTrigger>
                        <SelectContent>
                          {standards.filter(s => s.is_active).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.code} — {s.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={isPending}>
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Attach'}
                      </Button>
                    </div>
                  </form>
                </ActionSection>

                {/* Mark maintenance */}
                <ActionSection
                  id="maintenance"
                  label="ส่งซ่อมบำรุง"
                  icon={<Wrench className="w-3.5 h-3.5 text-red-500" />}
                  active={activeAction === 'maintenance'}
                  onToggle={() => setActiveAction(activeAction === 'maintenance' ? null : 'maintenance')}
                >
                  <form onSubmit={e => action(e, markObjectMaintenanceAction, 'บันทึกการซ่อมแล้ว')}>
                    <input type="hidden" name="object_id" value={obj.id} />
                    <div className="space-y-2">
                      <Input name="notes" placeholder="รายละเอียดงานซ่อม" className="h-7 text-sm" />
                      <Input name="expected_return" type="date" className="h-7 text-sm" />
                      <Button type="submit" size="sm" className="w-full h-7 text-xs bg-red-600 hover:bg-red-700" disabled={isPending}>
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ส่งซ่อม'}
                      </Button>
                    </div>
                  </form>
                </ActionSection>

                {/* Return to available shortcut */}
                {obj.status !== 'available' && (
                  <form onSubmit={e => action(e, changeObjectStatusAction, 'คืนสถานะ Available แล้ว')}>
                    <input type="hidden" name="object_id" value={obj.id} />
                    <input type="hidden" name="status" value="available" />
                    <Button type="submit" size="sm" variant="outline" className="w-full h-7 text-xs" disabled={isPending}>
                      <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                      Return to Available
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Lifecycle timeline */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2.5 bg-gray-50 border-b sticky top-0">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Lifecycle ({lifecycle.length})
              </h3>
            </div>
            <div className="p-3 space-y-0">
              {lifecycle.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">ยังไม่มี lifecycle events</p>
              )}
              {lifecycle.map((ev, idx) => (
                <div key={ev.id} className="flex gap-2.5 pb-3">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div className="w-6 h-6 rounded-full bg-white border flex items-center justify-center shrink-0">
                      {EVENT_ICONS[ev.event_type] ?? <Clock className="w-3 h-3 text-gray-400" />}
                    </div>
                    {idx < lifecycle.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-gray-800 capitalize">
                        {ev.event_type.replace(/_/g, ' ')}
                      </span>
                      {(ev.from_value || ev.to_value) && (
                        <span className="text-xs text-gray-400">
                          {ev.from_value && ev.to_value
                            ? `${ev.from_value} → ${ev.to_value}`
                            : ev.to_value ?? ev.from_value}
                        </span>
                      )}
                    </div>
                    {ev.notes && <div className="text-xs text-gray-500 mt-0.5">{ev.notes}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {ev.actor_name && <span className="mr-1.5">{ev.actor_name}</span>}
                      {format(new Date(ev.occurred_at), 'dd MMM HH:mm', { locale: th })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reusable collapsible action section ──────────────────────────

function ActionSection({
  id, label, icon, active, onToggle, children,
}: {
  id: string
  label: string
  icon: React.ReactNode
  active: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors',
          active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
        )}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {active ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {active && (
        <div className="px-3 pb-3 pt-2 border-t bg-gray-50">
          {children}
        </div>
      )}
    </div>
  )
}
