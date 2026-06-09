'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle, ClipboardList, RefreshCw, ChevronDown } from 'lucide-react'
import { FieldShell } from './field-shell'
import { submitEvaluatorObservationAction } from '@/actions/field.actions'
import { useFieldQueue } from '@/hooks/use-field-queue'
import { cn } from '@/lib/utils'

interface ScenarioRow {
  id: string
  code: string
  title_th: string
  status: string
}

interface EvaluatorObservationFormProps {
  drillId: string
  drillTitle: string
  scenarios: ScenarioRow[]
  defaultScenarioId: string
}

type ObsResult = 'pass' | 'gap' | 'fail'

const RESULT_OPTIONS: { id: ObsResult; label: string; emoji: string; color: string; bg: string; border: string }[] = [
  { id: 'pass', label: 'ผ่าน', emoji: '✓', color: 'text-green-700', bg: 'bg-green-500', border: 'border-green-500' },
  { id: 'gap', label: 'Gap', emoji: '△', color: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-500' },
  { id: 'fail', label: 'ไม่ผ่าน', emoji: '✗', color: 'text-red-700', bg: 'bg-red-500', border: 'border-red-500' },
]

const COMMON_METRICS = [
  'TRIAGE_TIME', 'MARCH_PROTOCOL', 'MIST_HANDOVER', 'TEAM_COMM',
  'LEADERSHIP', 'RESOURCE_MGMT', 'SAFETY_PROTOCOL', 'DOC_ACCURACY',
]

function toPayload(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = String(v)
  }
  return out
}

export function EvaluatorObservationForm({
  drillId, drillTitle, scenarios, defaultScenarioId,
}: EvaluatorObservationFormProps) {
  const [scenarioId, setScenarioId] = useState(defaultScenarioId)
  const [showScenarioPicker, setShowScenarioPicker] = useState(false)
  const [metricCode, setMetricCode] = useState('')
  const [subjectRef, setSubjectRef] = useState('')
  const [result, setResult] = useState<ObsResult>('pass')
  const [score, setScore] = useState('')
  const [finding, setFinding] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const queueAction = useCallback(async (payload: Record<string, string>) => {
    const fd = new FormData()
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
    const res = await submitEvaluatorObservationAction(fd)
    return { ok: res.ok, message: res.ok ? undefined : res.message }
  }, [])

  const queue = useFieldQueue('evaluator_observation', queueAction)

  const selectedScenario = scenarios.find(s => s.id === scenarioId)

  const handleSubmit = () => {
    if (!metricCode.trim()) { toast.error('กรุณาระบุ Metric Code'); return }
    if (!subjectRef.trim()) { toast.error('กรุณาระบุ Subject'); return }
    if (!finding.trim()) { toast.error('กรุณาระบุรายละเอียดที่พบ'); return }
    if (!drillId) { toast.error('ไม่พบ Active Drill'); return }

    const payload = toPayload({
      drill_id: drillId,
      scenario_id: scenarioId || undefined,
      metric_code: metricCode.trim().toUpperCase(),
      subject_ref: subjectRef.trim(),
      result,
      score: score || undefined,
      finding: finding.trim(),
    })

    if (!queue.isOnline) {
      queue.enqueue(payload)
      toast.warning('ออฟไลน์ — บันทึกไว้แล้ว')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      const res = await submitEvaluatorObservationAction(fd)
      if (res.ok) {
        setSuccess(true)
        toast.success('บันทึกการประเมินสำเร็จ!')
        setTimeout(() => {
          setSuccess(false)
          setMetricCode('')
          setSubjectRef('')
          setFinding('')
          setScore('')
        }, 3000)
      } else {
        queue.enqueue(payload)
        toast.error(res.message + ' — บันทึกไว้ใน queue')
      }
    })
  }

  if (success) {
    const resultOpt = RESULT_OPTIONS.find(r => r.id === result)!
    return (
      <FieldShell title="บันทึกการประเมิน" backHref="/field">
        <div className="flex flex-col items-center justify-center py-24 px-8 gap-4 text-center">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white', resultOpt.bg)}>
            {resultOpt.emoji}
          </div>
          <p className="text-xl font-bold text-gray-900">บันทึกสำเร็จ</p>
          <p className="text-sm font-mono text-gray-600">{metricCode} · {subjectRef}</p>
          <p className="text-xs text-gray-400">EVALUATOR_OBSERVATION ถูกบันทึกแล้ว</p>
        </div>
      </FieldShell>
    )
  }

  return (
    <FieldShell title="บันทึกการประเมิน" backHref="/field">
      <div className="p-4 space-y-5">
        {/* Drill context */}
        {drillTitle && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
            <p className="text-xs text-green-500 font-medium">ปฏิบัติการ</p>
            <p className="text-sm font-bold text-green-900 mt-0.5 truncate">{drillTitle}</p>
          </div>
        )}

        {/* Scenario picker */}
        {scenarios.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Scenario</label>
            <button
              onClick={() => setShowScenarioPicker(!showScenarioPicker)}
              className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="text-left">
                {selectedScenario ? (
                  <p className="font-mono font-bold text-sm text-gray-900">{selectedScenario.code} — {selectedScenario.title_th}</p>
                ) : (
                  <p className="text-sm text-gray-400">เลือก Scenario (ไม่บังคับ)...</p>
                )}
              </div>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showScenarioPicker && 'rotate-180')} />
            </button>
            {showScenarioPicker && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                <button
                  onClick={() => { setScenarioId(''); setShowScenarioPicker(false) }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100"
                >
                  ไม่ระบุ Scenario
                </button>
                {scenarios.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setScenarioId(s.id); setShowScenarioPicker(false) }}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0 border-gray-100',
                      scenarioId === s.id && 'bg-green-50'
                    )}
                  >
                    <p className="font-mono text-sm font-semibold">{s.code}</p>
                    <p className="text-xs text-gray-500">{s.title_th}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metric Code */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Metric Code *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {COMMON_METRICS.map(m => (
              <button
                key={m}
                onClick={() => setMetricCode(m)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors',
                  metricCode === m
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={metricCode}
            onChange={e => setMetricCode(e.target.value.toUpperCase())}
            placeholder="หรือพิมพ์รหัส metric เอง..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Subject *</label>
          <input
            type="text"
            value={subjectRef}
            onChange={e => setSubjectRef(e.target.value)}
            placeholder="เช่น MED-ALPHA, ส.อ. วศิน, ทีม BRAVO"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Result */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ผลการประเมิน</label>
          <div className="grid grid-cols-3 gap-2">
            {RESULT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setResult(opt.id)}
                className={cn(
                  'py-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-1',
                  result === opt.id
                    ? `${opt.bg} text-white ${opt.border} scale-105`
                    : 'bg-white border-gray-200 text-gray-700'
                )}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Score (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            คะแนน 0–10 <span className="text-gray-400 normal-case font-normal">(ถ้ามี)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={score || '5'}
              onChange={e => setScore(e.target.value)}
              className="flex-1 h-2 accent-green-600"
            />
            <div className="w-12 text-center font-bold text-lg text-gray-800">
              {score || '—'}
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-1">
            <span>0</span><span>5</span><span>10</span>
          </div>
          {score && (
            <button onClick={() => setScore('')} className="text-xs text-gray-400 hover:text-gray-600">
              ล้างคะแนน
            </button>
          )}
        </div>

        {/* Finding */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">รายละเอียดที่พบ *</label>
          <textarea
            value={finding}
            onChange={e => setFinding(e.target.value)}
            rows={4}
            placeholder="อธิบายสิ่งที่สังเกตเห็น, ปัญหา, หรือจุดเด่น..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-green-500"
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
          disabled={isPending}
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform disabled:opacity-60"
        >
          {isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
          ) : (
            <><ClipboardList className="w-5 h-5" /> บันทึกการประเมิน</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">บันทึก EVALUATOR_OBSERVATION</p>
      </div>
    </FieldShell>
  )
}
