'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  FlaskConical, Users, AlertTriangle, Activity,
  CheckCircle2, Clock, XCircle, Map, ChevronRight,
  Radio, Target, Zap, LayoutDashboard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  DrillDashboardSummary,
  ScenarioInstance,
  MselInjectRow,
  ExerciseTeam,
  ControllerEvaluator,
} from '@/contracts/drill.contract'
import type { UserRole } from '@/types'

interface Props {
  drillId: string
  summary: DrillDashboardSummary | null
  scenarios: ScenarioInstance[]
  injects: MselInjectRow[]
  teams: ExerciseTeam[]
  controllers: ControllerEvaluator[]
  userRole: UserRole
}

const triageColor: Record<string, string> = {
  P1: 'bg-red-500',
  P2: 'bg-yellow-400',
  P3: 'bg-green-500',
  BLACK: 'bg-gray-800',
}

const injectStatusIcon = {
  queued:       <Clock className="w-3.5 h-3.5 text-gray-400" />,
  pushed:       <Activity className="w-3.5 h-3.5 text-blue-500" />,
  acknowledged: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  completed:    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  skipped:      <XCircle className="w-3.5 h-3.5 text-gray-300" />,
}

const scenarioStatusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:     { label: 'ร่าง',           variant: 'secondary' },
  ready:     { label: 'พร้อมแล้ว',      variant: 'outline' },
  active:    { label: 'กำลังดำเนินการ', variant: 'default' },
  completed: { label: 'เสร็จสิ้น',      variant: 'outline' },
  cancelled: { label: 'ยกเลิก',         variant: 'destructive' },
}

export function DrillDashboard({
  drillId, summary, scenarios, injects, teams, controllers, userRole,
}: Props) {
  const canManage = ['admin', 'commander'].includes(userRole)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-orange-600" />
              Drill Dashboard
            </h1>
            {summary && (
              <p className="text-sm text-gray-500 mt-0.5">{summary.drill_title}</p>
            )}
          </div>
          {canManage && (
            <Button asChild className="gap-2">
              <Link href={`/drill/${drillId}/scenario-builder`}>
                <FlaskConical className="w-4 h-4" />
                Scenario Builder
              </Link>
            </Button>
          )}
        </div>

        {/* No summary fallback */}
        {!summary && (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีข้อมูล Drill — กรุณาสร้าง Scenario ก่อน</p>
              {canManage && (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={`/drill/${drillId}/scenario-builder`}>สร้าง Scenario</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {summary && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Scenarios"
                value={summary.scenario_count}
                icon={<FlaskConical className="w-5 h-5 text-orange-600" />}
                bg="bg-orange-50"
              />
              <KpiCard
                label="Casualties"
                value={summary.total_casualties}
                icon={<Users className="w-5 h-5 text-red-600" />}
                bg="bg-red-50"
              />
              <KpiCard
                label="MSEL Injects"
                value={`${summary.inject_pushed}/${summary.inject_total}`}
                icon={<Zap className="w-5 h-5 text-blue-600" />}
                bg="bg-blue-50"
                sub={`${summary.inject_pending} คงค้าง`}
              />
              <KpiCard
                label="Teams"
                value={summary.team_count}
                icon={<Target className="w-5 h-5 text-purple-600" />}
                bg="bg-purple-50"
                sub={`${summary.participant_count} คน`}
              />
            </div>

            {/* Active scenario highlight */}
            {summary.active_scenario_id ? (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-0.5">
                      Scenario กำลังดำเนินการ
                    </p>
                    <p className="font-semibold text-orange-900">{summary.active_scenario_title}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="border-orange-300 shrink-0">
                    <Link href={`/operation/${drillId}/cop`}>
                      <Map className="w-4 h-4 mr-1.5" />
                      เปิด COP
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-4 text-center text-gray-400 text-sm">
                  ยังไม่มี Scenario ที่กำลังดำเนินการ
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Casualty distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-500" />
                    การกระจายผู้บาดเจ็บ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { level: 'P1', count: summary.p1_count, label: 'Immediate' },
                    { level: 'P2', count: summary.p2_count, label: 'Delayed' },
                    { level: 'P3', count: summary.p3_count, label: 'Minor' },
                    { level: 'BLACK', count: summary.black_count, label: 'Expectant/DOA' },
                  ].map(({ level, count, label }) => (
                    <div key={level} className="flex items-center gap-3">
                      <div className={cn('w-12 h-5 rounded text-white text-xs font-bold flex items-center justify-center shrink-0', triageColor[level])}>
                        {level}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                          <span>{label}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', triageColor[level])}
                            style={{ width: summary.total_casualties > 0 ? `${Math.round(count / summary.total_casualties * 100)}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {summary.total_casualties === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีผู้บาดเจ็บที่สร้างแล้ว</p>
                  )}
                </CardContent>
              </Card>

              {/* MSEL inject timeline */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    MSEL Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {injects.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">ยังไม่มี inject ใน scenario ที่ active</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {injects.map(inj => (
                        <div key={inj.id} className="flex items-start gap-2.5 text-xs">
                          <div className="mt-0.5 shrink-0">{injectStatusIcon[inj.status]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 truncate">{inj.title}</span>
                              <span className={cn(
                                'shrink-0 px-1.5 py-0.5 rounded text-xs font-medium',
                                inj.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                inj.severity === 'warning'  ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-500'
                              )}>{inj.severity}</span>
                            </div>
                            <p className="text-gray-400">T+{inj.offset_minutes} นาที{inj.target_team ? ` · ${inj.target_team}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Scenario list */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-orange-500" />
                    Scenarios
                  </CardTitle>
                  {canManage && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/drill/${drillId}/scenario-builder`} className="flex items-center gap-1 text-xs">
                        เพิ่ม Scenario
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {scenarios.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี Scenario</p>
                ) : (
                  <div className="space-y-2">
                    {scenarios.map(s => {
                      const cfg = scenarioStatusBadge[s.status] ?? scenarioStatusBadge.draft
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                              <Badge variant={cfg.variant} className="text-xs shrink-0">{cfg.label}</Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {s.scenario_type} · {s.duration_minutes} นาที
                              {' · '}ผู้บาดเจ็บ {s.casualty_count} ราย
                              {' · '}Injects {s.inject_count}
                            </p>
                          </div>
                          {s.objectives_locked && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-label="Objectives locked" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Teams & Controllers */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-500" />
                    Exercise Teams ({teams.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teams.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีทีม</p>
                  ) : (
                    <div className="space-y-1.5">
                      {teams.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1">
                          <div>
                            <span className="font-medium text-gray-700">{t.team_name}</span>
                            {t.organization && <span className="text-gray-400 ml-1">({t.organization})</span>}
                          </div>
                          <span className="text-gray-400">{t.member_count} คน · {t.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-indigo-500" />
                    Controllers & Evaluators ({controllers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {controllers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีการมอบหมาย</p>
                  ) : (
                    <div className="space-y-1.5">
                      {controllers.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs py-1">
                          <span className="font-medium text-gray-700">{c.user_name ?? c.user_id.slice(0, 8)}</span>
                          <div className="flex items-center gap-1.5">
                            {c.assigned_team && <span className="text-gray-400">{c.assigned_team}</span>}
                            <span className={cn(
                              'px-1.5 py-0.5 rounded font-medium',
                              c.assignment_type === 'controller' ? 'bg-indigo-100 text-indigo-700' :
                              c.assignment_type === 'evaluator'  ? 'bg-teal-100 text-teal-700' :
                              'bg-purple-100 text-purple-700'
                            )}>
                              {c.assignment_type === 'both' ? 'Controller+Eval' : c.assignment_type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label, value, icon, bg, sub,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  bg: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bg)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

