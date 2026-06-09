'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowLeft,
  ClipboardList, Users, Activity, Search, ChevronDown,
  Clock, FileText, ShieldAlert, Target,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { useEvaluationDashboard } from '@/lib/iodp/use-evaluation-dashboard'
import { submitObservationAction, submitMetricScoreAction, autoCalculateMetricsAction } from '@/actions/evaluation.actions'
import type {
  MeasurementRule,
  EvaluationScoreRow,
  EvaluatorObservation,
  TeamPerformanceSummary,
  SafetyViolation,
  EvidenceEvent,
  ComputedMetricScore,
} from '@/contracts/evaluation.contract'
import type { UserRole } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  scenarioId: string
  drillId: string
  drillTitle: string
  rules: MeasurementRule[]
  initialScores: EvaluationScoreRow[]
  initialObservations: EvaluatorObservation[]
  initialTeamPerformance: TeamPerformanceSummary[]
  initialViolations: SafetyViolation[]
  initialEvents: EvidenceEvent[]
  initialMetricScores: ComputedMetricScore[]
  initialOverallPct: number | null
  userId: string
  userName: string
  userRole: UserRole
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: ComputedMetricScore['status']) {
  if (status === 'pass') return 'text-green-700 bg-green-50 border-green-200'
  if (status === 'gap') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (status === 'fail') return 'text-red-700 bg-red-50 border-red-200'
  return 'text-gray-500 bg-gray-50 border-gray-200'
}

function statusIcon(status: ComputedMetricScore['status']) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-600" />
  if (status === 'gap') return <AlertTriangle className="w-4 h-4 text-amber-500" />
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500" />
  return <Clock className="w-4 h-4 text-gray-400" />
}

function pctBar(pct: number | null, is_safety_critical: boolean) {
  const val = pct ?? 0
  const color = is_safety_critical
    ? 'bg-red-400'
    : val >= 60 ? 'bg-green-500' : val >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, val)}%` }} />
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}

const RESULT_OPTS = [
  { id: 'pass' as const, label: 'ผ่าน', color: 'bg-green-500', border: 'border-green-500', text: 'text-white' },
  { id: 'gap' as const,  label: 'Gap',  color: 'bg-amber-400', border: 'border-amber-400', text: 'text-white' },
  { id: 'fail' as const, label: 'ไม่ผ่าน', color: 'bg-red-500', border: 'border-red-500', text: 'text-white' },
]

const SEVERITY_OPTS = [
  { id: 'info' as const,     label: 'ข้อมูลทั่วไป' },
  { id: 'warning' as const,  label: 'ข้อสังเกต' },
  { id: 'critical' as const, label: 'Critical' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ViolationBanner({ violations }: { violations: SafetyViolation[] }) {
  if (violations.length === 0) return null
  return (
    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-700">Safety Violations ({violations.length})</p>
        <ul className="mt-1 space-y-0.5">
          {violations.map(v => (
            <li key={v.id} className="text-xs text-red-600">
              <span className="font-mono">[{v.rule_code}]</span> {v.title}
            </li>
          ))}
        </ul>
      </div>
      <Badge variant="destructive" className="shrink-0">CRITICAL</Badge>
    </div>
  )
}

function MetricCard({ m }: { m: ComputedMetricScore }) {
  return (
    <div className={cn('border rounded-xl p-4 space-y-2', statusColor(m.status))}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {statusIcon(m.status)}
          <span className="text-xs font-mono text-gray-500">{m.rule.metric_code}</span>
          {m.rule.is_safety_critical && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">CRITICAL</Badge>
          )}
          {m.autoComputed && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">AUTO</Badge>
          )}
        </div>
        <span className="text-sm font-bold">
          {m.score !== null ? `${m.score}/${m.max_score}` : '—'}
        </span>
      </div>

      <p className="text-sm font-semibold">{m.rule.metric_name_th ?? m.rule.metric_name}</p>

      {pctBar(m.pct, m.rule.is_safety_critical)}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{m.pct !== null ? `${m.pct}%` : 'ยังไม่มีคะแนน'}</span>
        {m.autoValue && <span className="font-mono">{m.autoValue}</span>}
        {m.lastUpdated && !m.autoValue && <span>{formatDate(m.lastUpdated)}</span>}
      </div>
    </div>
  )
}

function TeamPerformanceTab({ teamPerformance }: { teamPerformance: TeamPerformanceSummary[] }) {
  if (teamPerformance.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
        <Users className="w-10 h-10" />
        <p className="text-sm">ยังไม่มีคะแนนทีม</p>
        <p className="text-xs">บันทึกคะแนน metric ก่อนเพื่อดูข้อมูลทีม</p>
      </div>
    )
  }

  const categories = teamPerformance.filter(t => t.category !== 'safety')

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Safety violations แสดงแยกที่ด้านบน ไม่นำมาเฉลี่ยคะแนน</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b">
            <th className="text-left py-2 px-2">หมวดหมู่</th>
            <th className="text-right py-2 px-2">เฉลี่ย</th>
            <th className="text-right py-2 px-2">%</th>
            <th className="text-right py-2 px-2">Metrics</th>
            <th className="text-right py-2 px-2">Min–Max</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(t => (
            <tr key={t.category} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-2.5 px-2">
                <span className="font-medium capitalize">{t.category}</span>
              </td>
              <td className="py-2.5 px-2 text-right font-mono">
                {t.avg_score?.toFixed(1)}/{t.avg_max_score?.toFixed(0)}
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className={cn(
                  'font-bold',
                  (t.avg_pct ?? 0) >= 60 ? 'text-green-600' : (t.avg_pct ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {t.avg_pct?.toFixed(0)}%
                </span>
              </td>
              <td className="py-2.5 px-2 text-right text-gray-500">{t.metric_count}</td>
              <td className="py-2.5 px-2 text-right text-gray-400 text-xs font-mono">
                {t.min_pct?.toFixed(0)}%–{t.max_pct?.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {teamPerformance.filter(t => t.category === 'safety').map(t => (
        <div key={t.category} className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs font-bold text-red-700 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Safety (critical flag — ไม่รวมใน avg)
          </p>
          <p className="text-xs text-red-600 mt-1">
            avg: {t.avg_pct?.toFixed(0)}% · {t.metric_count} metric(s)
          </p>
        </div>
      ))}
    </div>
  )
}

function ObservationsTab({ observations }: { observations: EvaluatorObservation[] }) {
  if (observations.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
        <ClipboardList className="w-10 h-10" />
        <p className="text-sm">ยังไม่มีการบันทึกการสังเกต</p>
      </div>
    )
  }

  const resultColor = { pass: 'text-green-700 bg-green-50', gap: 'text-amber-700 bg-amber-50', fail: 'text-red-700 bg-red-50' }

  return (
    <div className="space-y-3">
      {observations.map(obs => (
        <div key={obs.id} className="border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">{obs.metric_code ?? obs.category}</span>
                {obs.result && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-semibold', resultColor[obs.result])}>
                    {obs.result === 'pass' ? 'ผ่าน' : obs.result === 'gap' ? 'Gap' : 'ไม่ผ่าน'}
                  </span>
                )}
              </div>
              {obs.subject_ref && (
                <p className="text-sm font-semibold mt-0.5">{obs.subject_ref}</p>
              )}
            </div>
            {obs.score !== null && (
              <span className="text-sm font-bold text-gray-700 shrink-0">
                {obs.score}/{obs.max_score}
              </span>
            )}
          </div>

          {obs.finding && <p className="text-sm text-gray-700">{obs.finding}</p>}

          {obs.recommended_action && (
            <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
              แนะนำ: {obs.recommended_action}
            </p>
          )}

          {obs.root_cause && (
            <p className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded">
              สาเหตุ: {obs.root_cause}
            </p>
          )}

          {obs.evidence_event_ids.length > 0 && (
            <p className="text-xs text-gray-400">หลักฐาน: {obs.evidence_event_ids.length} event(s)</p>
          )}

          <p className="text-xs text-gray-400">
            {obs.flagged_by_name ?? 'ผู้ประเมิน'} · {formatDate(obs.flagged_at)}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Evidence Timeline ─────────────────────────────────────────────────────────

function EvidenceTimeline({
  events,
  selectedIds,
  onToggle,
}: {
  events: EvidenceEvent[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = events.filter(e =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.event_type.toLowerCase().includes(search.toLowerCase())
  )

  const sevColor = { info: 'bg-blue-100 text-blue-700', warning: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700' }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา event..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-blue-600 font-medium">เลือกแล้ว {selectedIds.length} event(s)</p>
      )}
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {filtered.map(ev => {
          const isSelected = selectedIds.includes(ev.id)
          return (
            <button
              key={ev.id}
              onClick={() => onToggle(ev.id)}
              className={cn(
                'w-full text-left p-2.5 rounded-lg border text-sm transition-all',
                isSelected
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-100 hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono', sevColor[ev.severity])}>
                  {ev.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400 font-mono">{ev.event_type}</span>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 ml-auto shrink-0" />}
              </div>
              <p className="font-medium text-gray-900 mt-0.5 truncate">{ev.title}</p>
              <p className="text-xs text-gray-400">{formatDate(ev.occurred_at)}</p>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">ไม่พบ event</p>
        )}
      </div>
    </div>
  )
}

// ── Score Entry Form ──────────────────────────────────────────────────────────

function ScoreEntryForm({
  scenarioId,
  drillId,
  rules,
  events,
  onDone,
}: {
  scenarioId: string
  drillId: string
  rules: MeasurementRule[]
  events: EvidenceEvent[]
  onDone: () => void
}) {
  const [metricCode, setMetricCode] = useState('')
  const [subjectRef, setSubjectRef] = useState('')
  const [result, setResult] = useState<'pass' | 'gap' | 'fail'>('pass')
  const [score, setScore] = useState<number>(3)
  const [finding, setFinding] = useState('')
  const [recommendedAction, setRecommendedAction] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info')
  const [evidenceIds, setEvidenceIds] = useState<string[]>([])
  const [showEvidence, setShowEvidence] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedRule = rules.find(r => r.metric_code === metricCode)

  function toggleEvidence(id: string) {
    setEvidenceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    if (!metricCode) { toast.error('กรุณาเลือก Metric'); return }
    if (!subjectRef.trim()) { toast.error('กรุณาระบุ Subject'); return }
    if (!finding.trim()) { toast.error('กรุณาระบุรายละเอียดที่พบ'); return }

    startTransition(async () => {
      const res = await submitObservationAction({
        scenario_id:       scenarioId,
        metric_code:       metricCode,
        subject_ref:       subjectRef.trim(),
        result,
        score,
        finding:           finding.trim(),
        evidence_event_ids: evidenceIds,
        recommended_action: recommendedAction.trim() || undefined,
        root_cause:        rootCause.trim() || undefined,
        severity,
      })

      if (res.ok) {
        toast.success('บันทึกการประเมินสำเร็จ')
        setSubjectRef('')
        setFinding('')
        setRecommendedAction('')
        setRootCause('')
        setEvidenceIds([])
        setResult('pass')
        setScore(3)
        onDone()
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Metric picker */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide">Metric *</Label>
        <div className="grid grid-cols-2 gap-2">
          {rules.map(r => (
            <button
              key={r.metric_code}
              onClick={() => setMetricCode(r.metric_code)}
              className={cn(
                'text-left p-2.5 rounded-lg border text-xs transition-all',
                metricCode === r.metric_code
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-200 hover:border-blue-300',
                r.is_safety_critical && metricCode !== r.metric_code && 'border-red-200 bg-red-50'
              )}
            >
              <p className="font-mono font-bold">{r.metric_code}</p>
              <p className={cn('mt-0.5 truncate', metricCode === r.metric_code ? 'text-blue-100' : 'text-gray-500')}>
                {r.metric_name_th ?? r.metric_name}
              </p>
              {r.is_safety_critical && (
                <span className={cn('text-[10px]', metricCode === r.metric_code ? 'text-red-200' : 'text-red-500')}>
                  SAFETY CRITICAL
                </span>
              )}
            </button>
          ))}
        </div>
        {selectedRule?.description && (
          <p className="text-xs text-gray-400 px-1">{selectedRule.description}</p>
        )}
      </div>

      {/* Subject ref */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide">Subject * <span className="font-normal normal-case text-gray-400">(เช่น PAT-001, Team 3B, Medic Alpha)</span></Label>
        <Input
          value={subjectRef}
          onChange={e => setSubjectRef(e.target.value)}
          placeholder="ระบุ subject..."
          className="font-mono"
        />
      </div>

      {/* Result */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide">ผลการประเมิน</Label>
        <div className="grid grid-cols-3 gap-2">
          {RESULT_OPTS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setResult(opt.id)}
              className={cn(
                'py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                result === opt.id ? `${opt.color} ${opt.text} ${opt.border} scale-[1.02]` : 'bg-white border-gray-200 text-gray-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score slider */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide">
          คะแนน 0–{selectedRule?.max_score ?? 5}
          <span className="ml-2 font-normal normal-case text-gray-400">(ผ่านที่ ≥ {selectedRule?.pass_threshold ?? 3})</span>
        </Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={selectedRule?.max_score ?? 5}
            step={0.5}
            value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            className="flex-1 h-2 accent-blue-600"
          />
          <span className="w-10 text-center font-bold text-lg text-gray-800">{score}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span>0</span><span>{selectedRule?.max_score ?? 5}</span>
        </div>
      </div>

      {/* Finding */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide">รายละเอียดที่พบ *</Label>
        <Textarea
          value={finding}
          onChange={e => setFinding(e.target.value)}
          rows={3}
          placeholder="สิ่งที่สังเกตเห็น, ปัญหา, หรือจุดเด่น..."
          className="resize-none"
        />
      </div>

      {/* Recommended action */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide">แนะนำการแก้ไข <span className="font-normal text-gray-400">(ถ้ามี)</span></Label>
        <Textarea
          value={recommendedAction}
          onChange={e => setRecommendedAction(e.target.value)}
          rows={2}
          placeholder="ข้อเสนอแนะ..."
          className="resize-none"
        />
      </div>

      {/* Root cause */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide">สาเหตุที่แท้จริง <span className="font-normal text-gray-400">(ถ้ามี)</span></Label>
        <Textarea
          value={rootCause}
          onChange={e => setRootCause(e.target.value)}
          rows={2}
          placeholder="root cause..."
          className="resize-none"
        />
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide">ระดับความสำคัญ</Label>
        <div className="flex gap-2">
          {SEVERITY_OPTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                severity === s.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 text-gray-600'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence picker */}
      <div className="space-y-2">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600"
        >
          <FileText className="w-3.5 h-3.5" />
          เลือกหลักฐาน ({evidenceIds.length} selected)
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showEvidence && 'rotate-180')} />
        </button>
        {showEvidence && (
          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/30">
            <EvidenceTimeline events={events} selectedIds={evidenceIds} onToggle={toggleEvidence} />
          </div>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? 'กำลังบันทึก...' : 'บันทึกการประเมิน'}
      </Button>
    </div>
  )
}

// ── Auto-compute panel ────────────────────────────────────────────────────────

function AutoComputePanel({
  drillId,
  scenarioId,
  onDone,
}: {
  drillId: string
  scenarioId: string
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleAutoCompute() {
    startTransition(async () => {
      const res = await autoCalculateMetricsAction(drillId, scenarioId)
      if (res.ok) {
        toast.success(`คำนวณอัตโนมัติ ${res.data.computed} metric(s)`)
        onDone()
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-indigo-800">Auto-compute time-based metrics</p>
        <p className="text-xs text-indigo-600">คำนวณ P1 First Contact, IAP Cycle Time, Safety Violations จาก event log</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleAutoCompute}
        disabled={isPending}
        className="shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
      >
        {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
        <span className="ml-1.5">{isPending ? 'กำลังคำนวณ...' : 'คำนวณ'}</span>
      </Button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EvaluationDashboard({
  scenarioId,
  drillId,
  drillTitle,
  rules,
  initialScores,
  initialObservations,
  initialTeamPerformance,
  initialViolations,
  initialEvents,
  initialMetricScores,
  initialOverallPct,
  userId: _userId,
  userName,
  userRole,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  const {
    metricScores,
    overallPct,
    observations,
    teamPerformance,
    violations,
    events,
    loading,
    refresh,
  } = useEvaluationDashboard(
    scenarioId, drillId, rules,
    initialScores, initialObservations, initialTeamPerformance,
    initialViolations, initialEvents
  )

  // Use initial values until realtime updates
  const displayMetrics = metricScores.length > 0 ? metricScores : initialMetricScores
  const displayPct = overallPct ?? initialOverallPct

  const canScore = ['admin', 'evaluator', 'commander', 'controller'].includes(userRole)
  const nonCritical = displayMetrics.filter(m => !m.rule.is_safety_critical)
  const criticalMetrics = displayMetrics.filter(m => m.rule.is_safety_critical)

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <Link
          href={`/drill/${drillId}/dashboard`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับ
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-600" />
            <h1 className="text-lg font-bold text-gray-900">Evaluation Dashboard</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{drillTitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {displayPct !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{displayPct}%</p>
              <p className="text-xs text-gray-400">คะแนนรวม</p>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { refresh(); router.refresh() }}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span className="ml-1.5 hidden sm:inline">รีเฟรช</span>
          </Button>
        </div>
      </div>

      {/* Safety violation banner */}
      <ViolationBanner violations={violations.length > 0 ? violations : initialViolations} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mx-6 mt-4 w-auto self-start shrink-0">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              ภาพรวม
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              ทีม
            </TabsTrigger>
            <TabsTrigger value="score" className="flex items-center gap-1.5" disabled={!canScore}>
              <ClipboardList className="w-3.5 h-3.5" />
              บันทึกคะแนน
            </TabsTrigger>
            <TabsTrigger value="observations" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              การสังเกต
              {observations.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">{observations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
            <div className="space-y-4">
              <AutoComputePanel drillId={drillId} scenarioId={scenarioId} onDone={refresh} />

              {/* Non-critical metrics */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Metrics</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {nonCritical.map(m => (
                    <MetricCard key={m.rule.metric_code} m={m} />
                  ))}
                </div>
              </div>

              {/* Safety critical metrics */}
              {criticalMetrics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Safety Critical (แสดงแยก ไม่นำไปเฉลี่ย)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {criticalMetrics.map(m => (
                      <MetricCard key={m.rule.metric_code} m={m} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Team tab */}
          <TabsContent value="team" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <TeamPerformanceTab teamPerformance={teamPerformance.length > 0 ? teamPerformance : initialTeamPerformance} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Score entry tab */}
          <TabsContent value="score" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                  Evaluator Observation Form
                </CardTitle>
                <p className="text-xs text-gray-400">บันทึกโดย {userName}</p>
              </CardHeader>
              <CardContent>
                <ScoreEntryForm
                  scenarioId={scenarioId}
                  drillId={drillId}
                  rules={rules}
                  events={events.length > 0 ? events : initialEvents}
                  onDone={refresh}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Observations tab */}
          <TabsContent value="observations" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">การสังเกตทั้งหมด</CardTitle>
              </CardHeader>
              <CardContent>
                <ObservationsTab observations={observations.length > 0 ? observations : initialObservations} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
