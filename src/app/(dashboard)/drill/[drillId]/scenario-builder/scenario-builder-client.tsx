'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FlaskConical, ChevronRight, ChevronLeft, Check,
  Plus, Trash2, Users, Zap, Target, Clock, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  createScenarioFromTemplateAction,
  generateCasualtiesAction,
  createMselInjectAction,
  lockObjectivesAction,
} from '@/actions/scenario.actions'
import type { ScenarioTemplate, CasualtyArchetype, ScenarioInstance, MselInjectRow } from '@/contracts/drill.contract'

interface Props {
  drillId: string
  templates: ScenarioTemplate[]
  archetypes: CasualtyArchetype[]
  existingScenarios: ScenarioInstance[]
}

type Step = 1 | 2 | 3 | 4 | 5

const STEPS = [
  { n: 1 as Step, label: 'เลือก Template' },
  { n: 2 as Step, label: 'ตั้งค่า Scope' },
  { n: 3 as Step, label: 'สร้างผู้บาดเจ็บ' },
  { n: 4 as Step, label: 'MSEL Timeline' },
  { n: 5 as Step, label: 'ยืนยัน' },
]

const triageColor: Record<string, string> = {
  P1:    'bg-red-500 text-white',
  P2:    'bg-yellow-400 text-gray-900',
  P3:    'bg-green-500 text-white',
  BLACK: 'bg-gray-800 text-white',
}

const severityColor: Record<string, string> = {
  info:     'bg-blue-100 text-blue-700',
  warning:  'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
}

export function ScenarioBuilderClient({ drillId, templates, archetypes, existingScenarios }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Wizard state
  const [step, setStep] = useState<Step>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<ScenarioTemplate | null>(null)

  // Created scenario state (set after step 2 submit)
  const [createdScenarioId, setCreatedScenarioId] = useState<string | null>(null)

  // Step 3 state
  const [casualtyCount, setCasualtyCount] = useState(20)
  const [distribution, setDistribution] = useState({ p1: 20, p2: 35, p3: 35, black: 10 })
  const [casualtiesGenerated, setCasualtiesGenerated] = useState(false)

  // Step 4 state
  const [injects, setInjects] = useState<Omit<MselInjectRow, 'id' | 'scenario_id' | 'pushed_at'>[]>([])
  const [showInjectForm, setShowInjectForm] = useState(false)

  // Form refs for step 2
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const objectivesRef = useRef<HTMLTextAreaElement>(null)
  const durationRef = useRef<HTMLInputElement>(null)
  const offsetRef = useRef<HTMLInputElement>(null)

  // Inject form state
  const [injectForm, setInjectForm] = useState({
    code: '', title: '', description: '', type: 'event',
    severity: 'info' as 'info' | 'warning' | 'critical',
    team: '', action: '', offset: '0',
  })

  const distSum = distribution.p1 + distribution.p2 + distribution.p3 + distribution.black
  const distValid = distSum === 100

  function goNext() { setStep(s => Math.min(5, s + 1) as Step) }
  function goPrev() { setStep(s => Math.max(1, s - 1) as Step) }

  // ── Step 2: Create scenario ──────────────────────────────────────
  async function handleCreateScenario() {
    if (!selectedTemplate) return

    const fd = new FormData()
    fd.append('drill_id', drillId)
    fd.append('template_id', selectedTemplate.id)
    fd.append('title', titleRef.current?.value ?? selectedTemplate.title)
    fd.append('description', descRef.current?.value ?? '')
    fd.append('start_offset_minutes', offsetRef.current?.value ?? '0')
    fd.append('duration_minutes', durationRef.current?.value ?? String(selectedTemplate.default_duration_minutes))
    fd.append('objectives', objectivesRef.current?.value ?? selectedTemplate.default_objectives.join('\n'))

    startTransition(async () => {
      const result = await createScenarioFromTemplateAction(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setCreatedScenarioId(result.data.id)
      toast.success('สร้าง Scenario สำเร็จ')
      goNext()
    })
  }

  // ── Step 3: Generate casualties ──────────────────────────────────
  async function handleGenerateCasualties() {
    if (!createdScenarioId || !distValid) return

    const fd = new FormData()
    fd.append('scenario_id', createdScenarioId)
    fd.append('count', String(casualtyCount))
    fd.append('p1_pct', String(distribution.p1))
    fd.append('p2_pct', String(distribution.p2))
    fd.append('p3_pct', String(distribution.p3))
    fd.append('black_pct', String(distribution.black))

    startTransition(async () => {
      const result = await generateCasualtiesAction(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setCasualtiesGenerated(true)
      toast.success(`สร้างผู้บาดเจ็บ ${result.data.count} ราย`)
    })
  }

  // ── Step 4: Add inject ───────────────────────────────────────────
  async function handleAddInject() {
    if (!createdScenarioId || !injectForm.code || !injectForm.title) {
      toast.error('ระบุรหัสและชื่อ inject')
      return
    }

    const fd = new FormData()
    fd.append('scenario_id', createdScenarioId)
    fd.append('inject_code', injectForm.code.toUpperCase())
    fd.append('title', injectForm.title)
    fd.append('description', injectForm.description)
    fd.append('inject_type', injectForm.type)
    fd.append('severity', injectForm.severity)
    fd.append('target_team', injectForm.team)
    fd.append('expected_action', injectForm.action)
    fd.append('offset_minutes', injectForm.offset)

    startTransition(async () => {
      const result = await createMselInjectAction(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setInjects(prev => [...prev, {
        inject_code: injectForm.code.toUpperCase(),
        title: injectForm.title,
        description: injectForm.description || null,
        inject_type: injectForm.type,
        severity: injectForm.severity,
        target_team: injectForm.team || null,
        expected_action: injectForm.action || null,
        offset_minutes: Number(injectForm.offset),
        status: 'queued',
      }])
      setInjectForm({ code: '', title: '', description: '', type: 'event', severity: 'info', team: '', action: '', offset: '0' })
      setShowInjectForm(false)
      toast.success('เพิ่ม inject แล้ว')
    })
  }

  // ── Step 5: Lock & finish ────────────────────────────────────────
  async function handleLockAndFinish() {
    if (!createdScenarioId) return

    const fd = new FormData()
    fd.append('scenario_id', createdScenarioId)

    startTransition(async () => {
      const result = await lockObjectivesAction(fd)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Scenario พร้อมแล้ว!')
      router.push(`/drill/${drillId}/dashboard`)
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-orange-600" />
            <h1 className="font-semibold text-gray-900">Scenario Builder</h1>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {STEPS.map(({ n, label }) => (
              <div key={n} className="flex items-center gap-1">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  step === n ? 'bg-orange-600 text-white' :
                  step > n   ? 'bg-green-500 text-white' :
                  'bg-gray-100 text-gray-400'
                )}>
                  {step > n ? <Check className="w-3 h-3" /> : n}
                </div>
                <span className={cn('text-xs hidden sm:block', step === n ? 'text-orange-700 font-medium' : 'text-gray-400')}>
                  {label}
                </span>
                {n < 5 && <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Step 1: Choose template ── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">เลือก Scenario Template</h2>
              <p className="text-sm text-gray-500">เลือกประเภทสถานการณ์เพื่อใช้เป็นฐาน</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {templates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all',
                    selectedTemplate?.id === tmpl.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        selectedTemplate?.id === tmpl.id ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                      )}>
                        {selectedTemplate?.id === tmpl.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tmpl.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tmpl.description}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">{tmpl.scenario_type}</span>
                        <span className="text-xs text-gray-400">{tmpl.default_duration_minutes} นาที</span>
                        <span className="text-xs text-gray-400">{tmpl.default_objectives.length} วัตถุประสงค์</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {templates.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-gray-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ไม่พบ Template — กรุณาตรวจสอบ migration 011</p>
                </CardContent>
              </Card>
            )}

            {/* Existing scenarios */}
            {existingScenarios.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Scenarios ที่มีอยู่แล้ว</p>
                <div className="space-y-1.5">
                  {existingScenarios.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50">
                      <span className="font-medium text-gray-700">{s.title}</span>
                      <Badge variant="secondary">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                disabled={!selectedTemplate}
                onClick={() => setStep(2)}
                className="gap-2"
              >
                ถัดไป
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Configure scope ── */}
        {step === 2 && selectedTemplate && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">ตั้งค่า Scenario</h2>
              <p className="text-sm text-gray-500">แก้ไขชื่อ, ระยะเวลา และวัตถุประสงค์ได้ตามต้องการ</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">ชื่อ Scenario *</Label>
                <Input
                  id="title"
                  ref={titleRef}
                  defaultValue={selectedTemplate.title}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="desc">คำอธิบาย</Label>
                <Textarea
                  id="desc"
                  ref={descRef}
                  defaultValue={selectedTemplate.description ?? ''}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">ระยะเวลา (นาที)</Label>
                  <Input
                    id="duration"
                    type="number"
                    ref={durationRef}
                    defaultValue={selectedTemplate.default_duration_minutes}
                    min={1}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="offset">เริ่มหลังจาก (นาที)</Label>
                  <Input
                    id="offset"
                    type="number"
                    ref={offsetRef}
                    defaultValue={0}
                    min={0}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="objectives">วัตถุประสงค์ (1 บรรทัด = 1 ข้อ)</Label>
                <Textarea
                  id="objectives"
                  ref={objectivesRef}
                  defaultValue={selectedTemplate.default_objectives.join('\n')}
                  rows={5}
                  className="mt-1 text-sm"
                />
              </div>

              {/* Template sites preview */}
              {selectedTemplate.default_sites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sites จาก Template</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.default_sites.map((s, i) => (
                      <div key={i} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        {s.site_code} — {s.site_name} ({s.role})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={goPrev} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                ย้อนกลับ
              </Button>
              <Button onClick={handleCreateScenario} disabled={isPending} className="gap-2">
                {isPending ? 'กำลังสร้าง...' : 'สร้าง Scenario'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* ── Step 3: Generate casualties ── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">สร้างผู้บาดเจ็บ (Casualties)</h2>
              <p className="text-sm text-gray-500">กำหนดจำนวนและสัดส่วนการบาดเจ็บ</p>
            </div>

            <Card>
              <CardContent className="py-5 space-y-4">
                <div>
                  <Label>จำนวนผู้บาดเจ็บทั้งหมด</Label>
                  <Input
                    type="number"
                    value={casualtyCount}
                    onChange={e => setCasualtyCount(Number(e.target.value))}
                    min={1}
                    max={200}
                    className="mt-1 w-36"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>สัดส่วนตาม Triage Level (%)</Label>
                    <span className={cn('text-xs font-medium', distValid ? 'text-green-600' : 'text-red-500')}>
                      รวม: {distSum}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'p1', label: 'P1 – Immediate', color: 'border-red-300' },
                      { key: 'p2', label: 'P2 – Delayed',   color: 'border-yellow-300' },
                      { key: 'p3', label: 'P3 – Minor',     color: 'border-green-300' },
                      { key: 'black', label: 'BLACK – Expect.', color: 'border-gray-400' },
                    ] as const).map(({ key, label, color }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                        <Input
                          type="number"
                          value={distribution[key]}
                          onChange={e => setDistribution(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          min={0}
                          max={100}
                          className={cn('border-2', color)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">ตัวอย่างจำนวนจริง:</p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { level: 'P1', count: Math.round(casualtyCount * distribution.p1 / 100), color: 'bg-red-100 text-red-700' },
                      { level: 'P2', count: Math.round(casualtyCount * distribution.p2 / 100), color: 'bg-yellow-100 text-yellow-700' },
                      { level: 'P3', count: Math.round(casualtyCount * distribution.p3 / 100), color: 'bg-green-100 text-green-700' },
                      { level: 'BLACK', count: casualtyCount - Math.round(casualtyCount * distribution.p1 / 100) - Math.round(casualtyCount * distribution.p2 / 100) - Math.round(casualtyCount * distribution.p3 / 100), color: 'bg-gray-100 text-gray-700' },
                    ].map(({ level, count, color }) => (
                      <div key={level} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', color)}>
                        {level}: {count} ราย
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {casualtiesGenerated && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                <Check className="w-4 h-4" />
                สร้างผู้บาดเจ็บแล้ว — สามารถสร้างใหม่เพื่อปรับได้
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goPrev} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                ย้อนกลับ
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateCasualties}
                  disabled={isPending || !distValid || !createdScenarioId}
                >
                  {isPending ? 'กำลังสร้าง...' : casualtiesGenerated ? 'สร้างใหม่' : 'สร้างผู้บาดเจ็บ'}
                </Button>
                <Button onClick={goNext} className="gap-2">
                  ถัดไป
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 4: MSEL Timeline ── */}
        {step === 4 && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">MSEL Timeline</h2>
                <p className="text-sm text-gray-500">เพิ่ม inject events เข้าไปใน timeline ของ scenario</p>
              </div>
              <Button size="sm" onClick={() => setShowInjectForm(true)} className="gap-2">
                <Plus className="w-3.5 h-3.5" />
                เพิ่ม Inject
              </Button>
            </div>

            {/* Inject form */}
            {showInjectForm && (
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Inject ใหม่</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">รหัส Inject *</Label>
                      <Input
                        value={injectForm.code}
                        onChange={e => setInjectForm(p => ({ ...p, code: e.target.value }))}
                        placeholder="เช่น INJ-001"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">เวลา T+ (นาที)</Label>
                      <Input
                        type="number"
                        value={injectForm.offset}
                        onChange={e => setInjectForm(p => ({ ...p, offset: e.target.value }))}
                        min={0}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">ชื่อ Inject *</Label>
                    <Input
                      value={injectForm.title}
                      onChange={e => setInjectForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="เช่น ผู้บาดเจ็บเพิ่มเติมถึงจุด CCP"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">ประเภท</Label>
                      <Input
                        value={injectForm.type}
                        onChange={e => setInjectForm(p => ({ ...p, type: e.target.value }))}
                        placeholder="event"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Severity</Label>
                      <select
                        value={injectForm.severity}
                        onChange={e => setInjectForm(p => ({ ...p, severity: e.target.value as 'info' | 'warning' | 'critical' }))}
                        className="mt-1 w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">ทีมเป้าหมาย</Label>
                      <Input
                        value={injectForm.team}
                        onChange={e => setInjectForm(p => ({ ...p, team: e.target.value }))}
                        placeholder="เช่น Alpha Team"
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">การกระทำที่คาดหวัง</Label>
                    <Textarea
                      value={injectForm.action}
                      onChange={e => setInjectForm(p => ({ ...p, action: e.target.value }))}
                      rows={2}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowInjectForm(false)}>ยกเลิก</Button>
                    <Button size="sm" onClick={handleAddInject} disabled={isPending}>
                      {isPending ? 'กำลังบันทึก...' : 'เพิ่ม'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Inject list */}
            {injects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มี Inject — กด "เพิ่ม Inject" เพื่อเริ่ม</p>
                  <p className="text-xs mt-1">(ข้ามขั้นตอนนี้ได้หากยังไม่ต้องการ MSEL)</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {[...injects].sort((a, b) => a.offset_minutes - b.offset_minutes).map((inj, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white">
                    <div className="shrink-0 text-xs text-gray-400 font-mono w-14 text-right mt-0.5">
                      T+{inj.offset_minutes}m
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{inj.inject_code}</span>
                        <span className="text-sm font-medium text-gray-800">{inj.title}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', severityColor[inj.severity])}>
                          {inj.severity}
                        </span>
                      </div>
                      {inj.target_team && (
                        <p className="text-xs text-gray-400 mt-0.5">→ {inj.target_team}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goPrev} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                ย้อนกลับ
              </Button>
              <Button onClick={goNext} className="gap-2">
                ถัดไป
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* ── Step 5: Review & lock ── */}
        {step === 5 && selectedTemplate && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">ยืนยัน Scenario</h2>
              <p className="text-sm text-gray-500">ตรวจสอบข้อมูลแล้วกด "Lock & เสร็จสิ้น" เพื่อล็อค objectives</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <SummaryCard
                icon={<FlaskConical className="w-4 h-4 text-orange-600" />}
                label="Template"
                value={selectedTemplate.title}
                bg="bg-orange-50"
              />
              <SummaryCard
                icon={<Users className="w-4 h-4 text-red-600" />}
                label="Casualties"
                value={`${casualtyCount} ราย`}
                bg="bg-red-50"
                sub={casualtiesGenerated ? 'สร้างแล้ว' : 'ยังไม่ได้สร้าง'}
              />
              <SummaryCard
                icon={<Zap className="w-4 h-4 text-blue-600" />}
                label="MSEL Injects"
                value={`${injects.length} injects`}
                bg="bg-blue-50"
              />
            </div>

            {!casualtiesGenerated && (
              <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                คุณยังไม่ได้สร้างผู้บาดเจ็บ — สามารถกลับไปสร้างได้ในขั้นตอนที่ 3
              </div>
            )}

            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-gray-600">
                  การล็อค objectives จะ:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500 shrink-0" />เปลี่ยน status ของ Scenario เป็น <strong>Ready</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500 shrink-0" />ล็อคการแก้ไข Objectives</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500 shrink-0" />บันทึก Platform Event: <code className="text-xs bg-gray-100 px-1 rounded">SCENARIO_OBJECTIVES_LOCKED</code></li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goPrev} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                ย้อนกลับ
              </Button>
              <Button
                onClick={handleLockAndFinish}
                disabled={isPending || !createdScenarioId}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {isPending ? 'กำลังบันทึก...' : ''}
                <Check className="w-4 h-4" />
                Lock & เสร็จสิ้น
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, bg, sub }: {
  icon: React.ReactNode; label: string; value: string; bg: string; sub?: string
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
