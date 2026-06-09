'use client'

import Link from 'next/link'
import { UserCheck, Activity, Package, ClipboardList, MapPin, Radio, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { FieldShell } from './field-shell'
import type { AppCtx } from '@/types'

interface AssignmentRow {
  id: string
  status: string
  role_in_drill: string | null
  drills: { id: string; title: string; mode: string; status: string; location: string | null } | null
}

interface RecentEvent {
  id: string
  event_type: string
  title: string
  description: string | null
  severity: string
  timestamp: string
}

interface FieldHomeProps {
  appCtx: AppCtx
  assignments: AssignmentRow[]
  recentEvents: RecentEvent[]
}

const QUICK_ACTIONS: {
  href: string
  label: string
  sublabel: string
  icon: React.ElementType
  color: string
  bg: string
  roles?: string[]
}[] = [
  {
    href: '/field/check-in',
    label: 'Team Check-in',
    sublabel: 'บันทึกสถานะ + GPS',
    icon: UserCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  {
    href: '/field/triage',
    label: 'คัดแยกผู้ป่วย',
    sublabel: 'P1 / P2 / P3 / Black',
    icon: Activity,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    roles: ['medical', 'admin', 'commander', 'controller', 'participant'],
  },
  {
    href: '/field/supply-request',
    label: 'ขอสนับสนุน',
    sublabel: 'วัสดุ / อุปกรณ์',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
  },
  {
    href: '/field/evaluator-observation',
    label: 'บันทึกการประเมิน',
    sublabel: 'Metric + Finding',
    icon: ClipboardList,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    roles: ['evaluator', 'admin', 'commander', 'controller'],
  },
]

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'critical') return <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
  if (severity === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
  return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function FieldHome({ appCtx, assignments, recentEvents }: FieldHomeProps) {
  const visibleActions = QUICK_ACTIONS.filter(
    a => !a.roles || a.roles.includes(appCtx.role)
  )

  return (
    <FieldShell title="ภาคสนาม">
      <div className="p-4 space-y-5">
        {/* User greeting */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ยินดีต้อนรับ</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{appCtx.userName ?? 'ผู้ใช้'}</p>
              <p className="text-sm text-gray-500 capitalize">{appCtx.role}</p>
            </div>
            {appCtx.activeIncidentTitle && (
              <div className="text-right">
                <p className="text-xs text-gray-400">ปฏิบัติการ</p>
                <p className="text-xs font-semibold text-blue-600 mt-0.5 max-w-32 truncate">
                  {appCtx.activeIncidentTitle}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active assignments */}
        {assignments.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
              งานที่ได้รับมอบหมาย
            </h2>
            <div className="space-y-2">
              {assignments.map(a => a.drills && (
                <div key={a.id} className="bg-white rounded-xl border border-green-200 p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{a.drills.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.role_in_drill && (
                          <span className="text-xs text-blue-600 font-medium">{a.role_in_drill}</span>
                        )}
                        {a.drills.location && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400">
                            <MapPin className="w-3 h-3" />{a.drills.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.drills.mode === 'operation' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {a.drills.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
            การดำเนินการ
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {visibleActions.map(({ href, label, sublabel, icon: Icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col gap-2 p-4 rounded-2xl border ${bg} active:scale-95 transition-transform`}
              >
                <Icon className={`w-7 h-7 ${color}`} />
                <div>
                  <p className={`font-semibold text-sm ${color}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent events / inject inbox */}
        {recentEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Radio className="w-3 h-3" /> เหตุการณ์ล่าสุด
              </h2>
            </div>
            <div className="space-y-2">
              {recentEvents.slice(0, 5).map(ev => (
                <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex gap-2.5">
                    <SeverityIcon severity={ev.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{ev.title}</p>
                      {ev.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ev.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatTime(ev.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {assignments.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">ยังไม่มีงานที่ได้รับมอบหมาย</p>
            <p className="text-xs mt-1">ติดต่อ Commander เพื่อรับ assignment</p>
          </div>
        )}
      </div>
    </FieldShell>
  )
}
