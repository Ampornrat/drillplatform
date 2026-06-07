'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Truck, Clock, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { confirmPatientHandoverAction } from '@/actions/facility.actions'
import type { TransportObject, PatientTrack, PatientMovementRow } from '@/contracts/op.contract'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const transportIcon: Record<string, string> = {
  ambulance: '🚑', boat: '⛵', HEMS: '🚁', UAV: '🛸', ALS_unit: '🚒', BLS_unit: '🚐', other: '🚗',
}

const statusColor: Record<string, string> = {
  available:   'bg-green-100 text-green-700',
  en_route:    'bg-blue-100 text-blue-700',
  on_scene:    'bg-orange-100 text-orange-700',
  standby:     'bg-yellow-100 text-yellow-700',
  unavailable: 'bg-gray-100 text-gray-500',
}

const statusLabel: Record<string, string> = {
  available: 'ว่าง', en_route: 'กำลังส่ง', on_scene: 'ที่เกิดเหตุ', standby: 'Standby', unavailable: 'ไม่พร้อม',
}

interface Props {
  drillId: string
  initialTransports: TransportObject[]
  initialPatients: PatientTrack[]
  initialMovements: PatientMovementRow[]
}

export function TransportTimeline({ drillId, initialTransports, initialPatients, initialMovements }: Props) {
  const [transports, setTransports] = useState<TransportObject[]>(initialTransports)
  const [patients, setPatients] = useState<PatientTrack[]>(initialPatients)
  const [movements, setMovements] = useState<PatientMovementRow[]>(initialMovements)
  const [handoverPatient, setHandoverPatient] = useState<PatientTrack | null>(null)
  const [showMist, setShowMist] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient()

    const transportCh = supabase
      .channel(`transports:${drillId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'object_registry',
        filter: `drill_id=eq.${drillId}`,
      }, (payload) => {
        const row = payload.new as TransportObject
        setTransports(prev => prev.map(t => t.id === row.id ? row : t))
      })
      .subscribe()

    const patientCh = supabase
      .channel(`transport-patients:${drillId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'iodp_patients',
      }, () => {
        supabase.from('patient_tracks').select('*').eq('drill_id', drillId)
          .then(({ data }) => { if (data) setPatients(data as unknown as PatientTrack[]) })
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'patient_movements',
      }, async () => {
        // Refresh movements via patient_tracks (drill-scoped) then join movement data
        const { data: tracks } = await supabase
          .from('patient_tracks').select('id, patient_code').eq('drill_id', drillId)
        const patientMap = new Map((tracks ?? []).map(t => [t.id, t.patient_code]))
        const patientIds = [...patientMap.keys()]
        if (!patientIds.length) return
        const { data: mvs } = await supabase
          .from('patient_movements')
          .select('id, patient_id, transport_mode, moved_at, notes, from_site_id, to_site_id')
          .in('patient_id', patientIds)
          .order('moved_at', { ascending: false })
          .limit(20)
        if (!mvs) return
        const siteIds = [...new Set([
          ...mvs.map(r => r.from_site_id).filter(Boolean),
          ...mvs.map(r => r.to_site_id).filter(Boolean),
        ])] as string[]
        const { data: sites } = siteIds.length > 0
          ? await supabase.from('iodp_sites').select('id, name').in('id', siteIds)
          : { data: [] }
        const siteMap = new Map((sites ?? []).map(s => [s.id, s.name]))
        setMovements(mvs.map(r => ({
          id: r.id,
          patient_id: r.patient_id,
          patient_code: patientMap.get(r.patient_id) ?? '',
          from_site_name: r.from_site_id ? (siteMap.get(r.from_site_id) ?? null) : null,
          to_site_name: r.to_site_id ? (siteMap.get(r.to_site_id) ?? null) : null,
          transport_mode: r.transport_mode,
          moved_at: r.moved_at,
          notes: r.notes,
        })))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(transportCh)
      supabase.removeChannel(patientCh)
    }
  }, [drillId])

  const enRoutePatients = patients.filter(p => p.status === 'en_route')

  async function handleHandover(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!handoverPatient) return
    const fd = new FormData(e.currentTarget)
    fd.set('drill_id', drillId)
    fd.set('patient_id', handoverPatient.id)

    // Build MIST data from form
    const mist = {
      mechanism: fd.get('mist_mechanism') as string || undefined,
      injuries: fd.get('mist_injuries') as string || undefined,
      signs: fd.get('mist_signs') as string || undefined,
      treatment: fd.get('mist_treatment') as string || undefined,
    }
    fd.set('mist_data', JSON.stringify(mist))

    startTransition(async () => {
      const result = await confirmPatientHandoverAction(fd)
      if (!result.ok) {
        toast.error('Handover ไม่สำเร็จ', { description: result.message })
      } else {
        toast.success(`${handoverPatient.patient_code} รับตัวแล้ว`)
        setHandoverPatient(null)
        setShowMist(false)
      }
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Transport objects */}
      <div className="border-b shrink-0">
        <div className="px-3 py-2 bg-gray-50 border-b">
          <h3 className="text-xs font-semibold text-gray-700">
            ยานพาหนะ / Transport ({transports.length})
          </h3>
        </div>
        <div className="divide-y max-h-48 overflow-y-auto">
          {transports.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              ไม่มียานพาหนะในระบบ<br />
              <span className="text-gray-300 text-xs">เพิ่มผ่าน SQL หรือ API</span>
            </p>
          )}
          {transports.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 px-3 py-2">
              <span className="text-lg leading-none shrink-0">{transportIcon[t.type] ?? '🚗'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">{t.name}</div>
                <div className="text-xs text-gray-400">
                  {t.capability.join(' · ') || t.type}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', statusColor[t.status])}>
                  {statusLabel[t.status]}
                </span>
                <div className="text-xs text-gray-400 mt-0.5">
                  <span className={cn(t.readiness < 50 ? 'text-red-500' : t.readiness < 80 ? 'text-orange-500' : 'text-green-600')}>
                    {t.readiness}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* En-route patients — pending handover */}
      <div className="border-b shrink-0">
        <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700">
            รอ Handover ({enRoutePatients.length})
          </h3>
        </div>
        <div className="divide-y max-h-40 overflow-y-auto">
          {enRoutePatients.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">ไม่มีผู้ป่วยกำลังเดินทาง</p>
          )}
          {enRoutePatients.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2">
              <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded shrink-0',
                p.triage_level === 'P1' ? 'bg-red-600 text-white' :
                p.triage_level === 'P2' ? 'bg-yellow-500 text-white' :
                'bg-green-600 text-white'
              )}>
                {p.triage_level}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900">{p.patient_code}</div>
                <div className="text-xs text-gray-400 truncate">→ {p.destination_name ?? '—'}</div>
              </div>
              <Button
                variant="outline" size="sm"
                className="h-6 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50"
                onClick={() => { setHandoverPatient(p); setShowMist(false) }}
              >
                Handover
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Handover form */}
      {handoverPatient && (
        <div className="border-b bg-green-50 p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900">
              Handover: {handoverPatient.patient_code}
            </div>
            <button onClick={() => setHandoverPatient(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <form onSubmit={handleHandover} className="space-y-2">
            <button
              type="button"
              onClick={() => setShowMist(!showMist)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              {showMist ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              MIST/ATMIST Handover Report
            </button>
            {showMist && (
              <div className="space-y-1.5 p-2 bg-white rounded-lg border">
                <div>
                  <label className="text-xs text-gray-500">M — กลไกการบาดเจ็บ</label>
                  <input name="mist_mechanism" className="w-full mt-0.5 text-xs border rounded px-2 py-1" placeholder="Mechanism of injury" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">I — การบาดเจ็บ</label>
                  <input name="mist_injuries" className="w-full mt-0.5 text-xs border rounded px-2 py-1" placeholder="Injuries found" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">S — Vital Signs</label>
                  <input name="mist_signs" className="w-full mt-0.5 text-xs border rounded px-2 py-1" placeholder="Signs & vitals" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">T — การรักษาที่ให้</label>
                  <input name="mist_treatment" className="w-full mt-0.5 text-xs border rounded px-2 py-1" placeholder="Treatment given" />
                </div>
              </div>
            )}
            <input name="notes" className="w-full text-xs border rounded px-2 py-1" placeholder="หมายเหตุ handover..." />
            <Button
              type="submit"
              size="sm"
              className="w-full text-xs h-8 bg-green-600 hover:bg-green-700"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ยืนยัน Handover & Admit'}
            </Button>
          </form>
        </div>
      )}

      {/* Movement timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 bg-gray-50 border-b sticky top-0">
          <h3 className="text-xs font-semibold text-gray-700">
            ประวัติการเคลื่อนย้าย
          </h3>
        </div>
        <div className="p-3 space-y-2">
          {movements.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีประวัติการเคลื่อนย้าย</p>
          )}
          {movements.map((m, idx) => (
            <div key={m.id} className="flex gap-2.5">
              <div className="flex flex-col items-center shrink-0">
                <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0',
                  idx === 0 ? 'bg-blue-500' : 'bg-gray-300'
                )} />
                {idx < movements.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
              </div>
              <div className="pb-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-800">{m.patient_code}</span>
                  <span className="text-xs text-gray-400">
                    {m.from_site_name ?? '?'} → {m.to_site_name ?? '?'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {m.transport_mode && <span className="mr-1.5">{m.transport_mode}</span>}
                  {format(new Date(m.moved_at), 'HH:mm', { locale: th })}
                </div>
                {m.notes && <div className="text-xs text-gray-500 mt-0.5">{m.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
