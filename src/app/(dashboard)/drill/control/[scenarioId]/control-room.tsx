'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, Pause, SkipForward, AlertOctagon, CheckCircle2,
  Clock, Zap, Flag, Activity, ArrowLeft, Users,
  ChevronDown, Box,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  updateSimClockAction,
  pushMselInjectAction,
  acknowledgeInjectAction,
  changeResourceStateAction,
  pauseExerciseAction,
  createEvaluatorFlagAction,
} from '@/actions/control.actions'
import type {
  SimClockRow, SimClockStatus,
  InjectDelivery, EvaluatorFlag, EvaluatorFlagCategory,
  ControlRoomData, MselInjectRow,
} from '@/contracts/drill.contract'
import type { UserRole } from '@/types'

interface Resource {
  id: string
  object_code: string
  name: string
  type: string
  status: string
  readiness: number
  owner: string | null
}

interface Props {
  scenarioId: string
  drillId: string
  initialData: ControlRoomData
  resources: Resource[]
  userId: string
  userName: string
  userRole: UserRole
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

const statusColor: Record<SimClockStatus, string> = {
  standby:      'bg-gray-100 text-gray-700',
  live:         'bg-green-100 text-green-700',
  paused:       'bg-yellow-100 text-yellow-700',
  safety_pause: 'bg-red-100 text-red-700',
  completed:    'bg-blue-100 text-blue-700',
}
const statusLabel: Record<SimClockStatus, string> = {
  standby:      'STANDBY',
  live:         'LIVE',
  paused:       'PAUSED',
  safety_pause: 'SAFETY PAUSE',
  completed:    'COMPLETED',
}
const injectStatusColor: Record<string, string> = {
  queued:       'bg-gray-100 text-gray-600',
  pushed:       'bg-blue-100 text-blue-700',
  acknowledged: 'bg-green-100 text-green-700',
  completed:    'bg-green-200 text-green-800',
  skipped:      'bg-gray-50 text-gray-400',
}
const severityDot: Record<string, string> = {
  info:     'bg-blue-400',
  warning:  'bg-yellow-400',
  critical: 'bg-red-500',
  drill:    'bg-purple-400',
}
const flagCategoryLabel: Record<EvaluatorFlagCategory, string> = {
  observation:      'สังเกต',
  strength:         'จุดแข็ง',
  weakness:         'จุดอ่อน',
  safety_concern:   'ความปลอดภัย',
  critical_incident:'เหตุวิกฤต',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ControlRoom({
  scenarioId, drillId, initialData, resources, userId, userName, userRole,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Clock state
  const [clock, setClock] = useState<SimClockRow>(initialData.clock)
  const [elapsed, setElapsed] = useState(initialData.clock.elapsed_seconds)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Injects
  const [injects, setInjects] = useState<MselInjectRow[]>(initialData.injects)
  const [deliveries, setDeliveries] = useState<InjectDelivery[]>(initialData.deliveries)

  // Flags
  const [flags, setFlags] = useState<EvaluatorFlag[]>(initialData.flags)
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [flagForm, setFlagForm] = useState({
    category: 'observation' as EvaluatorFlagCategory,
    title: '', description: '', severity: 'info' as 'info' | 'warning' | 'critical',
  })

  // Events feed
  const [events, setEvents] = useState(initialData.recentEvents)

  // Resource state editor
  const [resourceStatus, setResourceStatus] = useState<Record<string, string>>(
    Object.fromEntries(resources.map(r => [r.id, r.status]))
  )

  // Safety pause confirm
  const [safetyConfirm, setSafetyConfirm] = useState(false)

  const canControl = ['admin', 'commander', 'controller'].includes(userRole)
  const canFlag = ['admin', 'commander', 'controller', 'evaluator'].includes(userRole)

  // ── Sim clock ticking ──────────────────────────────────────────────────────

  useEffect(() => {
    if (clock.status === 'live') {
      tickRef.current = setInterval(() => {
        setElapsed(e => e + 1)
      }, 1000 / clock.speed_multiplier)

      // Sync elapsed to DB every 15 seconds
      syncRef.current = setInterval(() => {
        setElapsed(e => {
          const fd = new FormData()
          fd.append('scenario_id', scenarioId)
          fd.append('status', 'live')
          fd.append('elapsed_seconds', String(e))
          updateSimClockAction(fd).catch(() => {})
          return e
        })
      }, 15000)
    } else {
      setElapsed(clock.elapsed_seconds)
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (syncRef.current) clearInterval(syncRef.current)
    }
  }, [clock.status, clock.speed_multiplier, clock.elapsed_seconds, scenarioId])

  // ── Realtime subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    // Sim clock changes from other clients
    const clockChannel = supabase
      .channel(`ctrl:clock:${scenarioId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sim_clock_state',
        filter: `scenario_id=eq.${scenarioId}`,
      }, (payload) => {
        const row = payload.new as SimClockRow
        setClock(row)
        if (row.status !== 'live') setElapsed(row.elapsed_seconds)
      })
      .subscribe()

    // Inject status changes
    const injectChannel = supabase
      .channel(`ctrl:injects:${scenarioId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'msel_injects',
        filter: `scenario_id=eq.${scenarioId}`,
      }, (payload) => {
        const updated = payload.new as MselInjectRow
        setInjects(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
      })
      .subscribe()

    // Delivery changes (acknowledgements from field)
    const deliveryChannel = supabase
      .channel(`ctrl:deliveries:${scenarioId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inject_deliveries',
        filter: `scenario_id=eq.${scenarioId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const d = payload.new as Record<string, unknown>
          setDeliveries(prev => [{
            id: d.id as string,
            inject_id: d.inject_id as string,
            scenario_id: d.scenario_id as string,
            delivered_to_role: d.delivered_to_role as string | null,
            delivered_to_team: d.delivered_to_team as string | null,
            delivered_to_user: d.delivered_to_user as string | null,
            delivered_at: d.delivered_at as string,
            acknowledged_at: null,
            acknowledged_by: null,
            notes: null,
            inject_code: '',
            inject_title: '',
            inject_severity: 'info',
          }, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const d = payload.new as Record<string, unknown>
          setDeliveries(prev => prev.map(del =>
            del.id === d.id ? { ...del, acknowledged_at: d.acknowledged_at as string | null } : del
          ))
          if (d.acknowledged_at) toast.success('Inject ได้รับการ Acknowledge แล้ว')
        }
      })
      .subscribe()

    // Platform events feed
    const eventsChannel = supabase
      .channel(`ctrl:events:${drillId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'platform_events',
        filter: `drill_id=eq.${drillId}`,
      }, (payload) => {
        const e = payload.new as typeof events[0]
        setEvents(prev => [e, ...prev].slice(0, 50))
        if ((payload.new as Record<string, string>).event_type === 'SAFETY_PAUSE') {
          toast.error('🔴 SAFETY PAUSE — Exercise หยุดฉุกเฉิน', { duration: 10000 })
        }
      })
      .subscribe()

    // Evaluator flags
    const flagChannel = supabase
      .channel(`ctrl:flags:${scenarioId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'evaluator_flags',
        filter: `scenario_id=eq.${scenarioId}`,
      }, (payload) => {
        const f = payload.new as EvaluatorFlag
        setFlags(prev => [{ ...f, flagged_by_name: null }, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(clockChannel)
      supabase.removeChannel(injectChannel)
      supabase.removeChannel(deliveryChannel)
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(flagChannel)
    }
  }, [scenarioId, drillId])

  // ── Clock control ──────────────────────────────────────────────────────────

  async function handleClockAction(status: SimClockStatus) {
    const fd = new FormData()
    fd.append('scenario_id', scenarioId)
    fd.append('status', status)
    fd.append('elapsed_seconds', String(elapsed))

    startTransition(async () => {
      const result = await updateSimClockAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      setClock(prev => ({ ...prev, status, elapsed_seconds: elapsed }))
      toast.success(`Clock: ${statusLabel[status]}`)
    })
  }

  async function handleSafetyPause() {
    if (!safetyConfirm) { setSafetyConfirm(true); return }
    setSafetyConfirm(false)
    const fd = new FormData()
    fd.append('scenario_id', scenarioId)
    fd.append('pause_type', 'safety_pause')
    fd.append('elapsed_seconds', String(elapsed))
    startTransition(async () => {
      const result = await pauseExerciseAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      setClock(prev => ({ ...prev, status: 'safety_pause' }))
    })
  }

  // ── Push inject ────────────────────────────────────────────────────────────

  async function handlePush(injectId: string) {
    const fd = new FormData()
    fd.append('inject_id', injectId)
    fd.append('scenario_id', scenarioId)

    startTransition(async () => {
      const result = await pushMselInjectAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      setInjects(prev => prev.map(i => i.id === injectId ? { ...i, status: 'pushed' } : i))
      toast.success('Inject pushed สำเร็จ')
    })
  }

  // ── Acknowledge inject ─────────────────────────────────────────────────────

  async function handleAck(deliveryId: string) {
    const fd = new FormData()
    fd.append('delivery_id', deliveryId)
    startTransition(async () => {
      const result = await acknowledgeInjectAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      setDeliveries(prev => prev.map(d =>
        d.id === deliveryId ? { ...d, acknowledged_at: new Date().toISOString() } : d
      ))
      toast.success('Acknowledged')
    })
  }

  // ── Resource state ─────────────────────────────────────────────────────────

  async function handleResourceUpdate(resourceId: string) {
    const fd = new FormData()
    fd.append('resource_type', 'object')
    fd.append('resource_id', resourceId)
    fd.append('status', resourceStatus[resourceId] ?? 'available')
    fd.append('scenario_id', scenarioId)

    startTransition(async () => {
      const result = await changeResourceStateAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      toast.success('Resource state updated')
    })
  }

  // ── Evaluator flag ─────────────────────────────────────────────────────────

  async function handleCreateFlag() {
    if (!flagForm.title.trim()) { toast.error('ระบุชื่อ flag'); return }
    const fd = new FormData()
    fd.append('scenario_id', scenarioId)
    fd.append('category', flagForm.category)
    fd.append('title', flagForm.title)
    fd.append('description', flagForm.description)
    fd.append('severity', flagForm.severity)
    fd.append('elapsed_seconds_at', String(elapsed))

    startTransition(async () => {
      const result = await createEvaluatorFlagAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      setFlagForm({ category: 'observation', title: '', description: '', severity: 'info' })
      setShowFlagForm(false)
      toast.success('Flag บันทึกแล้ว')
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isSafetyPause = clock.status === 'safety_pause'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-950 text-white">

      {/* Safety Pause Banner */}
      {isSafetyPause && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold tracking-widest animate-pulse shrink-0">
          🔴 SAFETY PAUSE — EXERCISE HALTED — ALL STATIONS STAND BY
        </div>
      )}

      {/* Top bar */}
      <header className="shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
        <Link href={`/drill/${drillId}/dashboard`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1">
          <p className="text-xs text-gray-400">CONTROL ROOM</p>
          <p className="text-sm font-semibold text-white truncate">{initialData.scenario.title}</p>
        </div>

        {/* Clock display */}
        <div className={cn('px-4 py-1.5 rounded-lg text-center min-w-[140px]', statusColor[clock.status])}>
          <p className="text-2xl font-mono font-bold tracking-widest">
            {formatElapsed(elapsed)}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider">{statusLabel[clock.status]}</p>
        </div>

        {/* Clock controls */}
        {canControl && (
          <div className="flex items-center gap-2">
            {clock.status === 'standby' && (
              <Button size="sm" onClick={() => handleClockAction('live')} disabled={isPending}
                className="bg-green-600 hover:bg-green-500 gap-1.5">
                <Play className="w-3.5 h-3.5" /> LIVE
              </Button>
            )}
            {clock.status === 'live' && (
              <Button size="sm" variant="outline" onClick={() => handleClockAction('paused')} disabled={isPending}
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 gap-1.5">
                <Pause className="w-3.5 h-3.5" /> PAUSE
              </Button>
            )}
            {(clock.status === 'paused') && (
              <Button size="sm" onClick={() => handleClockAction('live')} disabled={isPending}
                className="bg-green-600 hover:bg-green-500 gap-1.5">
                <Play className="w-3.5 h-3.5" /> RESUME
              </Button>
            )}
            {clock.status === 'safety_pause' && (
              <Button size="sm" onClick={() => handleClockAction('live')} disabled={isPending}
                className="bg-green-600 hover:bg-green-500 gap-1.5">
                <Play className="w-3.5 h-3.5" /> RESUME
              </Button>
            )}
            {['live','paused'].includes(clock.status) && (
              <Button size="sm" variant="outline" onClick={() => handleClockAction('completed')} disabled={isPending}
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10 gap-1.5">
                <SkipForward className="w-3.5 h-3.5" /> END
              </Button>
            )}
            {/* Safety pause */}
            {['live','paused'].includes(clock.status) && (
              <Button
                size="sm"
                onClick={handleSafetyPause}
                disabled={isPending}
                className={cn(
                  'gap-1.5 transition-all',
                  safetyConfirm
                    ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                    : 'bg-red-900 hover:bg-red-700 border border-red-600'
                )}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                {safetyConfirm ? 'CONFIRM SAFETY PAUSE' : 'SAFETY PAUSE'}
              </Button>
            )}
          </div>
        )}

        <Link href={`/operation/${drillId}/cop`}
          className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 px-2 py-1.5 rounded">
          Open COP
        </Link>
      </header>

      {/* Main 3-column layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-[1fr_1fr_280px] gap-0">

        {/* ── Column 1: MSEL Inject Queue ── */}
        <section className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              MSEL Queue ({injects.filter(i => i.status === 'queued').length} pending)
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {injects.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-8">ไม่มี inject ใน queue</p>
            )}
            {injects.map(inj => {
              const myDeliveries = deliveries.filter(d => d.inject_id === inj.id)
              const acked = myDeliveries.some(d => d.acknowledged_at)
              return (
                <div key={inj.id}
                  className={cn(
                    'p-3 rounded-lg border transition-all',
                    inj.status === 'queued'      ? 'border-gray-700 bg-gray-800/50' :
                    inj.status === 'pushed'       ? 'border-blue-700 bg-blue-900/20' :
                    inj.status === 'acknowledged' ? 'border-green-700 bg-green-900/20' :
                    'border-gray-800 bg-gray-900/30 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{inj.inject_code}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', injectStatusColor[inj.status])}>
                          {inj.status}
                        </span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          inj.severity === 'critical' ? 'bg-red-900/50 text-red-300' :
                          inj.severity === 'warning'  ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-gray-700 text-gray-300'
                        )}>{inj.severity}</span>
                      </div>
                      <p className="text-sm text-white mt-0.5 leading-tight">{inj.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span><Clock className="w-3 h-3 inline mr-0.5" />T+{inj.offset_minutes}m</span>
                        {inj.target_team && <span>→ {inj.target_team}</span>}
                        {acked && <span className="text-green-400"><CheckCircle2 className="w-3 h-3 inline mr-0.5" />ACK</span>}
                      </div>
                      {myDeliveries.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {myDeliveries.map(del => (
                            <div key={del.id} className="flex items-center justify-between text-xs">
                              <span className={del.acknowledged_at ? 'text-green-400' : 'text-blue-300'}>
                                {del.acknowledged_at ? '✓ ACK' : '⏳ waiting'}
                                {del.delivered_to_team && ` · ${del.delivered_to_team}`}
                              </span>
                              {!del.acknowledged_at && (
                                <button onClick={() => handleAck(del.id)}
                                  className="text-xs text-green-400 hover:text-green-300 border border-green-800 px-1.5 py-0.5 rounded">
                                  ACK
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {canControl && inj.status === 'queued' && (
                      <Button size="sm" onClick={() => handlePush(inj.id)} disabled={isPending}
                        className="shrink-0 bg-blue-600 hover:bg-blue-500 text-xs h-7 px-2">
                        PUSH
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Column 2: Resources + Flags ── */}
        <section className="border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Resources */}
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-orange-400" />
              Resources ({resources.length})
            </h2>
          </div>
          <div className="overflow-y-auto flex-1 max-h-64 p-3 space-y-1.5">
            {resources.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">ไม่มี resource</p>
            )}
            {resources.slice(0, 12).map(res => (
              <div key={res.id} className="flex items-center gap-2 p-2 rounded bg-gray-800/50 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{res.object_code} — {res.name}</p>
                  <p className="text-gray-400">{res.type}{res.owner ? ` · ${res.owner}` : ''}</p>
                </div>
                {canControl ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={resourceStatus[res.id] ?? res.status}
                      onChange={e => setResourceStatus(prev => ({ ...prev, [res.id]: e.target.value }))}
                      className="bg-gray-700 text-white text-xs rounded px-1.5 py-1 border border-gray-600"
                    >
                      {['available','en_route','on_scene','standby','unavailable','maintenance'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleResourceUpdate(res.id)}
                      disabled={isPending || (resourceStatus[res.id] ?? res.status) === res.status}
                      className="text-xs px-1.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
                    >
                      SET
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-300 shrink-0">{res.status}</span>
                )}
              </div>
            ))}
          </div>

          {/* Evaluator Flags */}
          <div className="border-t border-gray-800">
            <div className="px-4 py-2 bg-gray-900 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-purple-400" />
                Evaluator Flags ({flags.length})
              </h2>
              {canFlag && (
                <button onClick={() => setShowFlagForm(f => !f)}
                  className="text-xs text-purple-400 hover:text-purple-300">
                  + Flag
                </button>
              )}
            </div>

            {showFlagForm && (
              <div className="p-3 bg-gray-800/50 border-t border-gray-700 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-400">ประเภท</Label>
                    <select
                      value={flagForm.category}
                      onChange={e => setFlagForm(p => ({ ...p, category: e.target.value as EvaluatorFlagCategory }))}
                      className="w-full mt-1 bg-gray-700 text-white text-xs rounded px-2 py-1.5 border border-gray-600"
                    >
                      {(Object.keys(flagCategoryLabel) as EvaluatorFlagCategory[]).map(k => (
                        <option key={k} value={k}>{flagCategoryLabel[k]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Severity</Label>
                    <select
                      value={flagForm.severity}
                      onChange={e => setFlagForm(p => ({ ...p, severity: e.target.value as 'info' | 'warning' | 'critical' }))}
                      className="w-full mt-1 bg-gray-700 text-white text-xs rounded px-2 py-1.5 border border-gray-600"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <Input
                  value={flagForm.title}
                  onChange={e => setFlagForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="ชื่อ flag *"
                  className="bg-gray-700 border-gray-600 text-white text-xs h-8"
                />
                <Textarea
                  value={flagForm.description}
                  onChange={e => setFlagForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="รายละเอียด"
                  rows={2}
                  className="bg-gray-700 border-gray-600 text-white text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowFlagForm(false)}
                    className="text-gray-400 h-7 text-xs">ยกเลิก</Button>
                  <Button size="sm" onClick={handleCreateFlag} disabled={isPending}
                    className="bg-purple-600 hover:bg-purple-500 h-7 text-xs">
                    บันทึก Flag
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-y-auto max-h-52 p-3 space-y-1.5">
              {flags.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">ยังไม่มี flag</p>
              )}
              {flags.map(f => (
                <div key={f.id} className={cn(
                  'p-2.5 rounded-lg border text-xs',
                  f.severity === 'critical' ? 'border-red-700 bg-red-900/20' :
                  f.severity === 'warning'  ? 'border-yellow-700 bg-yellow-900/10' :
                  'border-gray-700 bg-gray-800/30'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-400">{flagCategoryLabel[f.category]}</span>
                        <span className={cn('px-1 rounded text-xs font-medium',
                          f.severity === 'critical' ? 'bg-red-800 text-red-200' :
                          f.severity === 'warning'  ? 'bg-yellow-800 text-yellow-200' :
                          'bg-gray-700 text-gray-300'
                        )}>{f.severity}</span>
                        {f.elapsed_seconds_at != null && (
                          <span className="text-gray-500">T+{Math.floor(f.elapsed_seconds_at / 60)}m</span>
                        )}
                      </div>
                      <p className="text-white mt-0.5">{f.title}</p>
                      {f.description && <p className="text-gray-400 mt-0.5">{f.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Column 3: Event Feed ── */}
        <section className="flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              Event Feed
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {events.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-8">รอ events...</p>
            )}
            {events.map(ev => (
              <div key={ev.id} className="flex items-start gap-2 p-2 rounded bg-gray-800/30 text-xs">
                <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', severityDot[ev.severity] ?? 'bg-gray-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 leading-snug line-clamp-2">{ev.title}</p>
                  <p className="text-gray-500 mt-0.5">
                    {new Date(ev.occurred_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {' · '}<span className="font-mono">{ev.event_type}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
