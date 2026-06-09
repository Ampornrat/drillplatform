'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileBarChart2, Plus, RefreshCw, BookOpen, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAARDetail } from '@/lib/iodp/use-aar-detail'
import {
  generateAARAction,
  createImprovementActionAction,
  assignLMSCourseAction,
  closeImprovementActionAction,
  proposeSopUpdateAction,
  submitScenarioBankUpdateAction,
} from '@/actions/aar.actions'
import type {
  AARDetailData, AARFinding, LMSCourse, AAREventItem,
} from '@/contracts/aar.contract'

// ── Helpers ───────────────────────────────────────────────────────────────────

const severityBorder = {
  info:     'border-blue-200 bg-blue-50 text-blue-900',
  warning:  'border-yellow-200 bg-yellow-50 text-yellow-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
}

const statusColor = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-100 text-gray-600',
  cancelled:   'bg-gray-50 text-gray-400',
}

const statusLabel = {
  open:        'เปิด',
  in_progress: 'กำลังดำเนินการ',
  resolved:    'แก้ไขแล้ว',
  closed:      'ปิด',
  cancelled:   'ยกเลิก',
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Finding Card ──────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  events,
  lmsCourses,
  canEdit,
  onRefresh,
}: {
  finding: AARFinding
  events: AAREventItem[]
  lmsCourses: LMSCourse[]
  canEdit: boolean
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [lmsOpen, setLmsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [courseCode, setCourseCode] = useState('')
  const [deadline, setDeadline] = useState('')

  const evidenceEvents = events.filter(e => finding.evidence_event_ids.includes(e.id))
  const suggestedCourse = lmsCourses.find(c => c.finding_type === finding.finding_type)

  function handleClose() {
    startTransition(async () => {
      const res = await closeImprovementActionAction(finding.id)
      if (res.ok) { toast.success('ปิด Action แล้ว'); onRefresh() }
      else toast.error(res.message)
    })
  }

  function handleAssignLMS() {
    if (!courseCode) return
    startTransition(async () => {
      const res = await assignLMSCourseAction({
        finding_id: finding.id,
        lms_course: courseCode,
        deadline: deadline || undefined,
      })
      if (res.ok) { toast.success('กำหนด LMS Course แล้ว'); setLmsOpen(false); onRefresh() }
      else toast.error(res.message)
    })
  }

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', severityBorder[finding.severity])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor[finding.status])}>
              {statusLabel[finding.status]}
            </span>
            {finding.finding_type && (
              <span className="text-xs px-2 py-0.5 bg-white/70 rounded border font-mono">{finding.finding_type}</span>
            )}
            <span className="text-xs text-gray-500">{finding.priority.toUpperCase()}</span>
          </div>
          <p className="font-medium text-sm leading-snug">{finding.description}</p>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-700 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-1 border-t border-current/10">
          {finding.recommendation && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-0.5">ข้อเสนอแนะ</p>
              <p className="text-sm">{finding.recommendation}</p>
            </div>
          )}
          {finding.root_cause && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-0.5">Root Cause</p>
              <p className="text-sm">{finding.root_cause}</p>
            </div>
          )}
          {finding.owner_name && (
            <p className="text-xs text-gray-500">เจ้าของ: <span className="font-medium text-gray-700">{finding.owner_name}</span></p>
          )}
          {finding.due_date && (
            <p className="text-xs text-gray-500">กำหนดเสร็จ: <span className="font-medium text-gray-700">{finding.due_date}</span></p>
          )}

          {evidenceEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Evidence ({evidenceEvents.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {evidenceEvents.map(e => (
                  <div key={e.id} className="flex items-start gap-2 bg-white/60 rounded p-1.5 text-xs">
                    <span className="text-gray-400 shrink-0">{fmt(e.occurred_at)}</span>
                    <span className="font-medium text-gray-700 truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {finding.assignments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">LMS ({finding.assignments.length})</p>
              <div className="space-y-1">
                {finding.assignments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-white/60 rounded p-1.5 text-xs">
                    <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span className="font-mono text-indigo-700">{a.course_code}</span>
                    {a.assignee_name && <span className="text-gray-500">→ {a.assignee_name}</span>}
                    <span className="ml-auto text-gray-400">{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedCourse && (
            <div className="bg-indigo-50 rounded p-2 text-xs text-indigo-700">
              แนะนำ: <span className="font-medium">{suggestedCourse.course_name_th ?? suggestedCourse.course_name}</span>
              {' '}(<span className="font-mono">{suggestedCourse.course_code}</span>)
            </div>
          )}

          {canEdit && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setLmsOpen(true)}
                className="h-7 text-xs gap-1">
                <BookOpen className="w-3 h-3" /> กำหนด LMS
              </Button>
              {finding.status === 'open' && (
                <Button size="sm" variant="outline" onClick={handleClose} disabled={isPending}
                  className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50">
                  <CheckCircle2 className="w-3 h-3" /> Resolve
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* LMS assign dialog */}
      <Dialog open={lmsOpen} onOpenChange={setLmsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>กำหนด LMS Course</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Course</Label>
              <Select value={courseCode} onValueChange={v => setCourseCode(v ?? '')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="เลือกหลักสูตร" />
                </SelectTrigger>
                <SelectContent>
                  {suggestedCourse && (
                    <SelectItem value={suggestedCourse.course_code}>
                      ⭐ {suggestedCourse.course_code} — {suggestedCourse.course_name_th ?? suggestedCourse.course_name}
                    </SelectItem>
                  )}
                  {lmsCourses
                    .filter(c => c.course_code !== suggestedCourse?.course_code)
                    .map(c => (
                      <SelectItem key={c.course_code} value={c.course_code}>
                        {c.course_code} — {c.course_name_th ?? c.course_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">กำหนดเสร็จ</Label>
              <Input type="date" className="mt-1 h-8 text-sm" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <Button onClick={handleAssignLMS} disabled={!courseCode || isPending} className="w-full">
              กำหนด LMS Course
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── New Improvement Action Dialog ─────────────────────────────────────────────

function NewFindingDialog({
  aarReportId,
  events,
  onSuccess,
}: {
  aarReportId: string
  events: AAREventItem[]
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [description, setDescription] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [findingType, setFindingType] = useState('')
  const [category, setCategory] = useState('area_for_improvement')
  const [priority, setPriority] = useState('medium')
  const [severity, setSeverity] = useState('warning')
  const [responsibleParty, setResponsibleParty] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const filteredEvents = events.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.event_type.toLowerCase().includes(search.toLowerCase())
  )

  function toggleEvent(id: string) {
    setSelectedEventIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await createImprovementActionAction({
        aar_report_id:      aarReportId,
        finding_type:       findingType || undefined,
        category,
        description,
        recommendation:     recommendation || undefined,
        root_cause:         rootCause || undefined,
        priority,
        severity,
        responsible_party:  responsibleParty || undefined,
        due_date:           dueDate || undefined,
        evidence_event_ids: selectedEventIds,
      })
      if (res.ok) {
        toast.success('บันทึก Improvement Action แล้ว')
        setOpen(false)
        onSuccess()
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="w-4 h-4" /> เพิ่ม Finding
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เพิ่ม Improvement Action</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ประเภท Finding</Label>
                <Input className="mt-1 h-8 text-sm" value={findingType}
                  onChange={e => setFindingType(e.target.value)} placeholder="triage_accuracy_low" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={v => v && setCategory(v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="area_for_improvement">Area for Improvement</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="sustain">Sustain</SelectItem>
                    <SelectItem value="improve">Improve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">รายละเอียด *</Label>
              <Textarea className="mt-1 text-sm" rows={2} value={description}
                onChange={e => setDescription(e.target.value)} placeholder="อธิบาย finding ที่พบ" />
            </div>
            <div>
              <Label className="text-xs">ข้อเสนอแนะ</Label>
              <Textarea className="mt-1 text-sm" rows={2} value={recommendation}
                onChange={e => setRecommendation(e.target.value)} placeholder="วิธีแก้ไข / ปรับปรุง" />
            </div>
            <div>
              <Label className="text-xs">Root Cause</Label>
              <Textarea className="mt-1 text-sm" rows={2} value={rootCause}
                onChange={e => setRootCause(e.target.value)} placeholder="สาเหตุที่แท้จริง" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={v => v && setPriority(v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Severity</Label>
                <Select value={severity} onValueChange={v => v && setSeverity(v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">กำหนดเสร็จ</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={dueDate}
                  onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">ผู้รับผิดชอบ</Label>
              <Input className="mt-1 h-8 text-sm" value={responsibleParty}
                onChange={e => setResponsibleParty(e.target.value)} placeholder="ทีม / บุคคล" />
            </div>
            <div>
              <Label className="text-xs">Evidence Events ({selectedEventIds.length} selected)</Label>
              <Input className="mt-1 h-8 text-sm" value={search}
                onChange={e => setSearch(e.target.value)} placeholder="ค้นหา event..." />
              <div className="mt-2 border rounded max-h-40 overflow-y-auto divide-y">
                {filteredEvents.slice(0, 50).map(e => (
                  <button key={e.id} type="button" onClick={() => toggleEvent(e.id)}
                    className={cn('w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50',
                      selectedEventIds.includes(e.id) && 'bg-blue-50'
                    )}>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', {
                      'bg-blue-500': e.severity === 'info',
                      'bg-yellow-500': e.severity === 'warning',
                      'bg-red-500': e.severity === 'critical',
                    })} />
                    <span className="text-gray-400 shrink-0">{fmt(e.occurred_at)}</span>
                    <span className="truncate font-medium">{e.title}</span>
                    {selectedEventIds.includes(e.id) && <CheckCircle2 className="w-3 h-3 text-blue-500 ml-auto shrink-0" />}
                  </button>
                ))}
                {filteredEvents.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">ไม่พบ Event</p>
                )}
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={!description || isPending} className="w-full">
              บันทึก Improvement Action
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── SOP Update Dialog ─────────────────────────────────────────────────────────

function SOPUpdateDialog({
  drillId,
  aarReportId,
  onSuccess,
}: {
  drillId: string
  aarReportId: string | null
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [sopCode, setSopCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [changeType, setChangeType] = useState('update')
  const [priority, setPriority] = useState('medium')

  function handleSubmit() {
    startTransition(async () => {
      const res = await proposeSopUpdateAction({
        drill_id:      drillId,
        aar_report_id: aarReportId ?? undefined,
        sop_code:      sopCode || undefined,
        title,
        description,
        change_type:   changeType,
        priority,
      })
      if (res.ok) { toast.success('เสนอ SOP Update แล้ว'); setOpen(false); onSuccess() }
      else toast.error(res.message)
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="w-4 h-4" /> เสนอ SOP Update
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>เสนอการเปลี่ยนแปลง SOP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SOP Code</Label>
                <Input className="mt-1 h-8 text-sm" value={sopCode}
                  onChange={e => setSopCode(e.target.value)} placeholder="SOP-MED-001" />
              </div>
              <div>
                <Label className="text-xs">ประเภท</Label>
                <Select value={changeType} onValueChange={v => v && setChangeType(v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="retire">Retire</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">ชื่อ SOP *</Label>
              <Input className="mt-1 h-8 text-sm" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="ชื่อ SOP ที่ต้องการเปลี่ยนแปลง" />
            </div>
            <div>
              <Label className="text-xs">รายละเอียด *</Label>
              <Textarea className="mt-1 text-sm" rows={3} value={description}
                onChange={e => setDescription(e.target.value)} placeholder="อธิบายสิ่งที่ต้องการเปลี่ยนแปลง" />
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => v && setPriority(v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} disabled={!title || !description || isPending} className="w-full">
              เสนอ SOP Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Scenario Bank Dialog ──────────────────────────────────────────────────────

function ScenarioBankDialog({
  drillId,
  aarReportId,
  findingCodes,
  onSuccess,
}: {
  drillId: string
  aarReportId: string | null
  findingCodes: string[]
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')
  const [difficultyAdj, setDifficultyAdj] = useState('')

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitScenarioBankUpdateAction({
        drill_id:        drillId,
        aar_report_id:   aarReportId ?? undefined,
        title,
        summary:         summary || undefined,
        lessons_learned: lessonsLearned || undefined,
        difficulty_adj:  difficultyAdj || undefined,
        finding_codes:   findingCodes,
      })
      if (res.ok) { toast.success('ส่งข้อมูลไปยัง Scenario Bank แล้ว'); setOpen(false); onSuccess() }
      else toast.error(res.message)
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <ExternalLink className="w-4 h-4" /> ส่ง Scenario Bank
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ส่งผลกลับ Scenario Bank</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ชื่อ *</Label>
              <Input className="mt-1 h-8 text-sm" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="ชื่อ lesson / scenario update" />
            </div>
            <div>
              <Label className="text-xs">สรุปผลการฝึก</Label>
              <Textarea className="mt-1 text-sm" rows={2} value={summary}
                onChange={e => setSummary(e.target.value)} placeholder="ผลโดยรวม" />
            </div>
            <div>
              <Label className="text-xs">Lessons Learned</Label>
              <Textarea className="mt-1 text-sm" rows={3} value={lessonsLearned}
                onChange={e => setLessonsLearned(e.target.value)} placeholder="สิ่งที่เรียนรู้จากการฝึกนี้" />
            </div>
            <div>
              <Label className="text-xs">ปรับระดับความยาก</Label>
              <Select value={difficultyAdj} onValueChange={v => setDifficultyAdj(v ?? '')}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="เลือก (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easier">ง่ายลง</SelectItem>
                  <SelectItem value="same">เท่าเดิม</SelectItem>
                  <SelectItem value="harder">ยากขึ้น</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {findingCodes.length > 0 && (
              <p className="text-xs text-gray-500">Finding codes: {findingCodes.join(', ')}</p>
            )}
            <Button onClick={handleSubmit} disabled={!title || isPending} className="w-full">
              ส่ง Scenario Bank Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  data: AARDetailData
  canEdit: boolean
}

export default function AARDetail({ data, canEdit }: Props) {
  const [isGenerating, startGenerating] = useTransition()
  const [activeTab, setActiveTab] = useState('overview')

  const { findings, allAssignments, sopUpdates, scenarioBankUpdates, loading, refresh } = useAARDetail(
    data.drillId,
    data.aarReportId,
    {
      findings:            data.findings,
      allAssignments:      data.allAssignments,
      sopUpdates:          data.sopUpdates,
      scenarioBankUpdates: data.scenarioBankUpdates,
    }
  )

  const openFindings   = findings.filter(f => f.status === 'open')
  const closedFindings = findings.filter(f => ['resolved', 'closed'].includes(f.status))
  const totalCompleted = allAssignments.filter(a => a.status === 'completed').length
  const findingCodes   = findings.map(f => f.finding_code ?? f.finding_type ?? '').filter(Boolean)

  function handleGenerate() {
    startGenerating(async () => {
      const res = await generateAARAction(data.drillId)
      if (res.ok) { toast.success(`สร้าง AAR แล้ว — ${res.data.finding_count} findings`); refresh() }
      else toast.error(res.message)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileBarChart2 className="w-5 h-5 text-indigo-600" />
              <h1 className="text-lg font-bold text-gray-900">AAR / Improvement Plan</h1>
            </div>
            <p className="text-sm text-gray-500">{data.drillTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {data.aarStatus && <Badge variant="outline" className="capitalize">{data.aarStatus}</Badge>}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isGenerating} className="gap-1.5">
                <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
                Generate AAR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <span className="text-gray-500">
            Findings: <strong className="text-gray-900">{findings.length}</strong>
            <span className="text-red-600 ml-1">({openFindings.length} เปิด)</span>
            <span className="text-green-600 ml-1">({closedFindings.length} ปิดแล้ว)</span>
          </span>
          <span className="text-gray-500">
            LMS: <strong className="text-gray-900">{allAssignments.length}</strong>
            <span className="text-green-600 ml-1">({totalCompleted} เสร็จ)</span>
          </span>
          <span className="text-gray-500">SOP: <strong className="text-gray-900">{sopUpdates.length}</strong></span>
          {loading && <span className="text-xs text-gray-400 animate-pulse ml-auto">กำลังโหลด...</span>}
        </div>
      </div>

      <div className="p-6">
        {!data.aarReportId && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex flex-col items-center py-12">
              <FileBarChart2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium mb-1">ยังไม่มี AAR Report</p>
              <p className="text-sm text-gray-400 mb-4">คลิก Generate AAR เพื่อสร้าง findings อัตโนมัติจากผล Evaluation</p>
              {canEdit && (
                <Button onClick={handleGenerate} disabled={isGenerating} className="gap-1.5">
                  <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
                  Generate AAR
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={v => v && setActiveTab(v)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
            <TabsTrigger value="findings">
              Findings
              {openFindings.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{openFindings.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="lms">LMS</TabsTrigger>
            <TabsTrigger value="sop">SOP / Scenario Bank</TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Open Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">{openFindings.length}</p>
                  <p className="text-xs text-gray-400 mt-1">{findings.length} ทั้งหมด</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" /> LMS Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-indigo-600">{allAssignments.length}</p>
                  <p className="text-xs text-gray-400 mt-1">{totalCompleted} เสร็จแล้ว</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Resolved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{closedFindings.length}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {findings.length > 0 ? Math.round(closedFindings.length / findings.length * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {data.events.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Event Timeline ({data.events.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto space-y-0 pr-1">
                  {data.events.map(e => (
                    <div key={e.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50 last:border-0">
                      <span className={cn('w-2 h-2 rounded-full mt-0.5 shrink-0', {
                        'bg-blue-400':   e.severity === 'info',
                        'bg-yellow-400': e.severity === 'warning',
                        'bg-red-400':    e.severity === 'critical',
                      })} />
                      <span className="text-gray-400 shrink-0 w-28">{fmt(e.occurred_at)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-700">{e.title}</span>
                        {e.description && <p className="text-gray-400 truncate">{e.description}</p>}
                      </div>
                      <span className="font-mono text-gray-300 text-xs shrink-0">{e.event_type}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Findings ─────────────────────────────────────────────── */}
          <TabsContent value="findings" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{findings.length} findings</p>
              {canEdit && data.aarReportId && (
                <NewFindingDialog aarReportId={data.aarReportId} events={data.events} onSuccess={refresh} />
              )}
            </div>

            {findings.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">ยังไม่มี Findings — คลิก Generate AAR หรือเพิ่มเอง</p>
              </div>
            )}

            {(['critical', 'warning', 'info'] as const).map(sev => {
              const group = findings.filter(f => f.severity === sev)
              if (group.length === 0) return null
              return (
                <div key={sev}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {sev} ({group.length})
                  </p>
                  <div className="space-y-2">
                    {group.map(f => (
                      <FindingCard key={f.id} finding={f} events={data.events}
                        lmsCourses={data.lmsCourses} canEdit={canEdit} onRefresh={refresh} />
                    ))}
                  </div>
                </div>
              )
            })}
          </TabsContent>

          {/* ── LMS ──────────────────────────────────────────────────── */}
          <TabsContent value="lms" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">หลักสูตรที่พร้อมใช้ ({data.lmsCourses.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.lmsCourses.map(c => (
                  <div key={c.course_code} className="flex items-start gap-3 p-2 rounded bg-gray-50 text-sm">
                    <BookOpen className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{c.course_name_th ?? c.course_name}</p>
                      <p className="text-xs text-gray-400">{c.course_code} · {c.duration_hours}h · {c.provider}</p>
                    </div>
                    {c.finding_type && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono shrink-0">
                        {c.finding_type}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">การมอบหมายหลักสูตร ({allAssignments.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allAssignments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีการมอบหมาย — ไปที่ Findings เพื่อกำหนด LMS</p>
                )}
                {allAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                    <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-medium">{a.course_code}</p>
                      {a.course_name && <p className="text-xs text-gray-500">{a.course_name}</p>}
                      {a.assignee_name && <p className="text-xs text-gray-400">→ {a.assignee_name}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('text-xs px-2 py-0.5 rounded', {
                        'bg-green-100 text-green-700':  a.status === 'completed',
                        'bg-yellow-100 text-yellow-700': a.status === 'in_progress',
                        'bg-blue-50 text-blue-600':     a.status === 'assigned',
                        'bg-gray-100 text-gray-500':    ['expired', 'cancelled'].includes(a.status),
                      })}>{a.status}</span>
                      {a.deadline && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" /> {a.deadline}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SOP / Scenario Bank ──────────────────────────────────── */}
          <TabsContent value="sop" className="space-y-4">
            {canEdit && (
              <div className="flex items-center gap-2 flex-wrap">
                <SOPUpdateDialog drillId={data.drillId} aarReportId={data.aarReportId} onSuccess={refresh} />
                <ScenarioBankDialog drillId={data.drillId} aarReportId={data.aarReportId}
                  findingCodes={findingCodes} onSuccess={refresh} />
              </div>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">SOP Updates ({sopUpdates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sopUpdates.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อเสนอ SOP</p>
                )}
                {sopUpdates.map(s => (
                  <div key={s.id} className="rounded border p-3 text-sm space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {s.sop_code && <p className="font-mono text-xs text-gray-400">{s.sop_code}</p>}
                        <p className="font-medium text-gray-800">{s.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">{s.change_type}</Badge>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', {
                          'bg-green-100 text-green-700':  ['approved', 'implemented'].includes(s.status),
                          'bg-yellow-100 text-yellow-700': s.status === 'under_review',
                          'bg-blue-50 text-blue-600':     s.status === 'proposed',
                          'bg-red-100 text-red-600':      s.status === 'rejected',
                        })}>{s.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{s.description}</p>
                    <p className="text-xs text-gray-400">
                      เสนอโดย {s.proposer_name ?? 'ไม่ทราบ'} · {fmt(s.proposed_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scenario Bank Updates ({scenarioBankUpdates.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenarioBankUpdates.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีการส่งข้อมูลกลับ Scenario Bank</p>
                )}
                {scenarioBankUpdates.map(b => (
                  <div key={b.id} className="rounded border p-3 text-sm space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-800">{b.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {b.difficulty_adj && <Badge variant="outline" className="text-xs">{b.difficulty_adj}</Badge>}
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', {
                          'bg-green-100 text-green-700':   b.status === 'merged',
                          'bg-yellow-100 text-yellow-700': b.status === 'submitted',
                          'bg-gray-100 text-gray-600':     b.status === 'draft',
                          'bg-red-100 text-red-600':       b.status === 'rejected',
                        })}>{b.status}</span>
                      </div>
                    </div>
                    {b.summary && <p className="text-xs text-gray-600">{b.summary}</p>}
                    {b.lessons_learned && (
                      <p className="text-xs text-gray-500 border-l-2 border-indigo-200 pl-2">{b.lessons_learned}</p>
                    )}
                    {b.finding_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {b.finding_codes.map(code => (
                          <span key={code} className="text-xs font-mono bg-gray-50 border rounded px-1.5 py-0.5">{code}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      โดย {b.submitter_name ?? 'ไม่ทราบ'} · {fmt(b.submitted_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
