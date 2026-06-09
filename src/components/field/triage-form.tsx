'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { FieldShell } from './field-shell'
import { submitTriageActionV2 } from '@/actions/field.actions'
import { useFieldQueue } from '@/hooks/use-field-queue'
import { cn } from '@/lib/utils'
import type { PatientSummary } from '@/contracts/field.contract'

interface TriageFormProps {
  patients: PatientSummary[]
  drillId: string
  drillMode: 'drill' | 'operation'
}

type TriageLevel = 'P1' | 'P2' | 'P3' | 'BLACK'

const TRIAGE_LEVELS: { id: TriageLevel; label: string; sub: string; color: string; bg: string; border: string }[] = [
  { id: 'P1', label: 'P1', sub: 'รุนแรง', color: 'text-red-700', bg: 'bg-red-500', border: 'border-red-500' },
  { id: 'P2', label: 'P2', sub: 'เร่งด่วน', color: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-500' },
  { id: 'P3', label: 'P3', sub: 'รอได้', color: 'text-green-700', bg: 'bg-green-500', border: 'border-green-500' },
  { id: 'BLACK', label: 'Black', sub: 'เสียชีวิต', color: 'text-gray-700', bg: 'bg-gray-600', border: 'border-gray-600' },
]

const MARCH_KEYS: { key: string; label: string; sub: string }[] = [
  { key: 'massive_haemorrhage', label: 'M — Massive Haemorrhage', sub: 'เลือดออกมาก' },
  { key: 'airway', label: 'A — Airway', sub: 'ทางเดินหายใจ' },
  { key: 'respiration', label: 'R — Respiration', sub: 'การหายใจ' },
  { key: 'circulation', label: 'C — Circulation', sub: 'ระบบไหลเวียน' },
  { key: 'hypothermia', label: 'H — Hypothermia', sub: 'อุณหภูมิร่างกาย / ศีรษะ' },
]

function toPayload(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = String(v)
  }
  return out
}

export function TriageForm({ patients, drillId, drillMode }: TriageFormProps) {
  const [selectedId, setSelectedId] = useState(patients[0]?.id ?? '')
  const [showPatientPicker, setShowPatientPicker] = useState(false)
  const [triageLevel, setTriageLevel] = useState<TriageLevel>('P1')
  const [march, setMarch] = useState<Record<string, boolean>>({
    massive_haemorrhage: false, airway: false, respiration: false,
    circulation: false, hypothermia: false,
  })
  const [mistMechanism, setMistMechanism] = useState('')
  const [mistInjuries, setMistInjuries] = useState('')
  const [mistSigns, setMistSigns] = useState('')
  const [mistTreatment, setMistTreatment] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const queueAction = useCallback(async (payload: Record<string, string>) => {
    const fd = new FormData()
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
    const result = await submitTriageActionV2(fd)
    return { ok: result.ok, message: result.ok ? undefined : result.message }
  }, [])

  const queue = useFieldQueue('triage', queueAction)
  const selectedPatient = patients.find(p => p.id === selectedId)

  const buildPayload = () => {
    const marchData = {
      massive_haemorrhage: march.massive_haemorrhage,
      airway: march.airway ? 'checked' : undefined,
      respiration: march.respiration ? 'checked' : undefined,
      circulation: march.circulation ? 'checked' : undefined,
      hypothermia: march.hypothermia,
    }
    return toPayload({
      patient_id: selectedId,
      triage_level: triageLevel,
      status: 'triaged',
      march_data: JSON.stringify(marchData),
    })
  }

  const handleSubmit = () => {
    if (!selectedId) { toast.error('กรุณาเลือกผู้ป่วย'); return }
    const payload = buildPayload()

    if (!queue.isOnline) {
      queue.enqueue(payload)
      toast.warning('ออฟไลน์ — บันทึกไว้แล้ว')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      const result = await submitTriageActionV2(fd)
      if (result.ok) {
        setSuccess(true)
        toast.success('บันทึกการคัดแยกสำเร็จ!')
        setTimeout(() => setSuccess(false), 3000)
      } else {
        queue.enqueue(payload)
        toast.error(result.message + ' — บันทึกไว้ใน queue')
      }
    })
  }

  if (success) {
    return (
      <FieldShell title="คัดแยกผู้ป่วย" backHref="/field">
        <div className="flex flex-col items-center justify-center py-24 px-8 gap-4 text-center">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center',
            triageLevel === 'P1' ? 'bg-red-100' :
            triageLevel === 'P2' ? 'bg-amber-100' :
            triageLevel === 'P3' ? 'bg-green-100' : 'bg-gray-100'
          )}>
            <CheckCircle className={cn('w-9 h-9',
              triageLevel === 'P1' ? 'text-red-600' :
              triageLevel === 'P2' ? 'text-amber-600' :
              triageLevel === 'P3' ? 'text-green-600' : 'text-gray-600'
            )} />
          </div>
          <p className="text-xl font-bold text-gray-900">บันทึกสำเร็จ</p>
          <p className="text-sm text-gray-500">
            {selectedPatient?.patient_code} → <strong>{triageLevel}</strong>
          </p>
          <p className="text-xs text-gray-400">{drillMode === 'drill' ? 'อัปเดต casualty_instances' : 'อัปเดต patient_tracks'}</p>
        </div>
      </FieldShell>
    )
  }

  return (
    <FieldShell title="คัดแยกผู้ป่วย" backHref="/field">
      <div className="p-4 space-y-5">
        {/* Patient picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ผู้ป่วย</label>
          {patients.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              ไม่พบผู้ป่วยใน scenario นี้ — ตรวจสอบว่าได้เลือก Active Scenario แล้ว
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowPatientPicker(!showPatientPicker)}
                className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-xl px-4 py-3"
              >
                <div className="text-left">
                  {selectedPatient ? (
                    <>
                      <p className="font-mono font-bold text-sm text-gray-900">{selectedPatient.patient_code}</p>
                      {selectedPatient.triage_level && (
                        <p className="text-xs text-gray-500 mt-0.5">เดิม: {selectedPatient.triage_level}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">เลือกผู้ป่วย...</p>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showPatientPicker && 'rotate-180')} />
              </button>
              {showPatientPicker && (
                <div className="mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setShowPatientPicker(false) }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0 border-gray-100',
                        selectedId === p.id && 'bg-blue-50'
                      )}
                    >
                      <span className="font-mono text-sm font-medium">{p.patient_code}</span>
                      {p.triage_level && (
                        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded',
                          p.triage_level === 'P1' ? 'bg-red-100 text-red-700' :
                          p.triage_level === 'P2' ? 'bg-amber-100 text-amber-700' :
                          p.triage_level === 'P3' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        )}>{p.triage_level}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Triage level */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ระดับคัดแยก</label>
          <div className="grid grid-cols-4 gap-2">
            {TRIAGE_LEVELS.map(lvl => (
              <button
                key={lvl.id}
                onClick={() => setTriageLevel(lvl.id)}
                className={cn(
                  'py-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-0.5',
                  triageLevel === lvl.id
                    ? `${lvl.bg} text-white ${lvl.border} scale-105`
                    : 'bg-white border-gray-200 text-gray-700'
                )}
              >
                <span className="text-sm leading-none">{lvl.label}</span>
                <span className="text-[10px] font-medium opacity-80 leading-none">{lvl.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MARCH */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">โปรโตคอล MARCH</label>
          <div className="space-y-2">
            {MARCH_KEYS.map(({ key, label, sub }) => (
              <button
                key={key}
                onClick={() => setMarch(m => ({ ...m, [key]: !m[key] }))}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left',
                  march[key] ? 'bg-green-50 border-green-400' : 'bg-white border-gray-200'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0',
                  march[key] ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                )}>
                  {key[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className={cn('text-sm font-semibold', march[key] ? 'text-green-800' : 'text-gray-800')}>{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
                {march[key] && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* MIST handover */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">MIST Handover (ถ้ามี)</label>
          <div className="space-y-2">
            {[
              { label: 'M — กลไกการบาดเจ็บ', value: mistMechanism, set: setMistMechanism, placeholder: 'เช่น ตกจากที่สูง, ถูกชน' },
              { label: 'I — การบาดเจ็บ', value: mistInjuries, set: setMistInjuries, placeholder: 'บาดแผล, กระดูกหัก, ฯลฯ' },
              { label: 'S — สัญญาณชีพ', value: mistSigns, set: setMistSigns, placeholder: 'BP, HR, SpO2, GCS' },
              { label: 'T — การรักษาที่ให้แล้ว', value: mistTreatment, set: setMistTreatment, placeholder: 'tourniquet, O2, IV' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="text-xs text-gray-500 font-medium">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
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
          disabled={isPending || !selectedId}
          className={cn(
            'w-full py-4 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-60',
            triageLevel === 'P1' ? 'bg-red-600' :
            triageLevel === 'P2' ? 'bg-amber-500' :
            triageLevel === 'P3' ? 'bg-green-600' : 'bg-gray-600'
          )}
        >
          {isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> ส่งการคัดแยก · {triageLevel}</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">บันทึก PATIENT_TRIAGED · อัปเดต Dashboard</p>
      </div>
    </FieldShell>
  )
}
