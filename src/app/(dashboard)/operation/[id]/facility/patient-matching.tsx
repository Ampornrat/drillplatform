'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { User, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { assignPatientDestinationAction, createPatientMovementAction } from '@/actions/facility.actions'
import type { PatientTrack, FacilityStatusFull, TransportObject } from '@/contracts/op.contract'
import { cn } from '@/lib/utils'

const triageColor: Record<string, string> = {
  P1:    'bg-red-600 text-white',
  P2:    'bg-yellow-500 text-white',
  P3:    'bg-green-600 text-white',
  BLACK: 'bg-gray-800 text-white',
}

/** P1 → Role3/CoE, P2 → Role2/Role3, P3 → CCP/Role1/Role2 */
const triageToLevels: Record<string, string[]> = {
  P1:    ['CoE', 'Role3'],
  P2:    ['Role3', 'Role2'],
  P3:    ['CCP', 'Role1', 'Role2'],
  BLACK: [],
}

function getSuggestedFacilities(
  triage: string | null,
  facilities: FacilityStatusFull[]
): FacilityStatusFull[] {
  if (!triage || triage === 'BLACK') return []
  const levels = triageToLevels[triage] ?? []
  return facilities.filter(f =>
    f.facility_level &&
    levels.includes(f.facility_level) &&
    f.diversion_status === 'open' &&
    f.status !== 'closed'
  )
}

interface Props {
  drillId: string
  initialPatients: PatientTrack[]
  facilities: FacilityStatusFull[]
  transports: TransportObject[]
}

export function PatientMatching({ drillId, initialPatients, facilities, transports }: Props) {
  const [patients, setPatients] = useState<PatientTrack[]>(initialPatients)
  const [filter, setFilter] = useState<'unassigned' | 'en_route' | 'all'>('unassigned')
  const [selectedPatient, setSelectedPatient] = useState<PatientTrack | null>(null)
  const [assigningDestId, setAssigningDestId] = useState<string>('')
  const [assigningTransportId, setAssigningTransportId] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  // Realtime patient status updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`patients:${drillId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'iodp_patients',
      }, () => {
        // Reload patients on any change — simplest approach
        supabase
          .from('patient_tracks')
          .select('*')
          .eq('drill_id', drillId)
          .then(({ data }) => {
            if (data) setPatients(data as unknown as PatientTrack[])
          })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [drillId])

  const displayed = patients.filter(p => {
    if (filter === 'unassigned') return !p.destination_id && p.status !== 'admitted' && p.status !== 'deceased'
    if (filter === 'en_route') return p.status === 'en_route'
    return p.status !== 'admitted' && p.status !== 'deceased'
  })

  const suggested = selectedPatient
    ? getSuggestedFacilities(selectedPatient.triage_level, facilities)
    : []

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedPatient || !assigningDestId) return
    const fd = new FormData(e.currentTarget)
    fd.set('drill_id', drillId)
    fd.set('patient_id', selectedPatient.id)
    fd.set('destination_id', assigningDestId)
    if (assigningTransportId) fd.set('transport_object_id', assigningTransportId)
    startTransition(async () => {
      const result = await assignPatientDestinationAction(fd)
      if (!result.ok) {
        toast.error('กำหนดปลายทางไม่สำเร็จ', { description: result.message })
      } else {
        toast.success(`กำหนดปลายทาง ${selectedPatient.patient_code} แล้ว`)
        setSelectedPatient(null)
        setAssigningDestId('')
        setAssigningTransportId('')
      }
    })
  }

  async function handleStartTransport(patient: PatientTrack) {
    if (!patient.destination_id) {
      toast.warning('กรุณากำหนดปลายทางก่อน')
      return
    }
    const fd = new FormData()
    fd.set('drill_id', drillId)
    fd.set('patient_id', patient.id)
    fd.set('to_site_id', patient.destination_id)
    if (patient.transport_mode) fd.set('transport_mode', patient.transport_mode)
    if (patient.transport_object_id) fd.set('transport_object_id', patient.transport_object_id)
    startTransition(async () => {
      const result = await createPatientMovementAction(fd)
      if (!result.ok) {
        toast.error('เริ่ม Transport ไม่สำเร็จ', { description: result.message })
      } else {
        toast.success(`${patient.patient_code} กำลังเดินทาง`)
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b bg-gray-50 shrink-0">
        {(['unassigned', 'en_route', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
              filter === f ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >
            {f === 'unassigned' ? `ยังไม่ได้ปลายทาง (${patients.filter(p => !p.destination_id && p.status !== 'admitted').length})` :
             f === 'en_route' ? `กำลังเดินทาง (${patients.filter(p => p.status === 'en_route').length})` :
             'ทั้งหมด'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Assign destination panel */}
        {selectedPatient && (
          <div className="m-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded', triageColor[selectedPatient.triage_level ?? ''] ?? 'bg-gray-200')}>
                  {selectedPatient.triage_level}
                </span>
                <span className="text-sm font-medium text-gray-900">{selectedPatient.patient_code}</span>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <p className="text-xs text-blue-700 mb-2">
              {selectedPatient.triage_level === 'P1' ? 'ต้องการ Role 3 / CoE' :
               selectedPatient.triage_level === 'P2' ? 'ต้องการ Role 2 / Role 3' :
               'ต้องการ CCP / Role 1 / Role 2'}
            </p>
            <form onSubmit={handleAssign} className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">เลือกสถานพยาบาลปลายทาง</label>
                {suggested.length > 0 ? (
                  <div className="space-y-1">
                    {suggested.map(f => (
                      <label key={f.site_code} className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                        assigningDestId === (f.drill_id ?? f.session_id ?? '') + ':' + f.site_code
                          ? 'border-blue-400 bg-blue-100'
                          : 'border-gray-200 bg-white hover:border-blue-200'
                      )}>
                        <input
                          type="radio"
                          name="destination_id"
                          value={f.site_code}
                          onChange={() => setAssigningDestId(f.site_code)}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900">{f.site_name ?? f.site_code}</div>
                          <div className="text-xs text-gray-500">
                            {f.facility_level} · เตียง {f.current_load}/{f.capacity ?? '∞'}
                            {f.icu_beds_total > 0 && ` · ICU ${f.icu_beds_available} ว่าง`}
                          </div>
                        </div>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
                          f.diversion_status === 'open' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        )}>
                          {f.diversion_status === 'open' ? 'รับได้' : 'Divert'}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-red-500 py-1">ไม่มีสถานพยาบาลที่เหมาะสมในขณะนี้</p>
                )}
              </div>
              {/* Transport selection */}
              {transports.filter(t => t.status === 'available').length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">ยานพาหนะ (optional)</label>
                  <select
                    className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                    value={assigningTransportId}
                    onChange={e => setAssigningTransportId(e.target.value)}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {transports.filter(t => t.status === 'available').map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type}) · {t.readiness}%
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <input type="hidden" name="destination_id" value={assigningDestId} />
              <Button
                type="submit"
                size="sm"
                className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700"
                disabled={isPending || !assigningDestId}
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'กำหนดปลายทาง'}
              </Button>
            </form>
          </div>
        )}

        {/* Patient list */}
        <div className="p-3 space-y-1.5">
          {displayed.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
              {filter === 'unassigned' ? 'ผู้ป่วยทุกคนได้รับการกำหนดปลายทางแล้ว' : 'ไม่มีผู้ป่วยในหมวดนี้'}
            </div>
          )}
          {displayed.map(p => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2.5 p-2.5 bg-white rounded-lg border transition-colors',
                selectedPatient?.id === p.id ? 'border-blue-400 shadow-sm' : 'border-gray-100 hover:border-gray-200'
              )}
            >
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded shrink-0', triageColor[p.triage_level ?? ''] ?? 'bg-gray-200 text-gray-700')}>
                {p.triage_level ?? '?'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{p.patient_code}</div>
                <div className="text-xs text-gray-400 truncate">
                  {p.current_location ?? '—'}
                  {p.destination_name && (
                    <>
                      <ChevronRight className="w-3 h-3 inline mx-0.5" />
                      <span className="text-blue-600">{p.destination_name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  {p.status === 'triaged' ? 'Triaged' :
                   p.status === 'en_route' ? 'On Route' :
                   p.status === 'admitted' ? 'Admitted' : p.status}
                </Badge>
                {p.status === 'triaged' && !p.destination_id && (
                  <Button
                    variant="outline" size="sm"
                    className="h-6 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setSelectedPatient(p)
                      setAssigningDestId('')
                      setAssigningTransportId('')
                    }}
                  >
                    กำหนด
                  </Button>
                )}
                {p.status === 'triaged' && p.destination_id && (
                  <Button
                    variant="outline" size="sm"
                    className="h-6 px-2 text-xs border-green-200 text-green-600 hover:bg-green-50"
                    disabled={isPending}
                    onClick={() => handleStartTransport(p)}
                  >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ส่ง'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
