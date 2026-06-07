import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity, AlertTriangle, BookOpen,
  Radio, TrendingUp, Users, Map, FlaskConical,
} from 'lucide-react'
import Link from 'next/link'
import { resolveFullContext } from '@/services/context.service'
import { getDrillsList } from '@/services/drill.service'
import { getEvents } from '@/services/event.service'
import { getStandards } from '@/services/registry.service'
import type { UserRole } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

const drillStatusLabel: Record<string, string> = {
  draft: 'ร่าง', planned: 'วางแผนแล้ว', active: 'กำลังดำเนินการ',
  paused: 'หยุดชั่วคราว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
}
const drillStatusColor: Record<string, string> = {
  draft: 'secondary', planned: 'outline', active: 'default',
  paused: 'secondary', completed: 'outline', cancelled: 'destructive',
}

export default async function DashboardPage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const [drillsResult, eventsResult, standardsResult] = await Promise.all([
    getDrillsList({ limit: 5 }),
    getEvents({ limit: 5 }),
    getStandards(true),
  ])

  const recentDrills = drillsResult.ok ? drillsResult.data : []
  const recentEvents = eventsResult.ok ? eventsResult.data : []
  const standardsCount = standardsResult.ok ? standardsResult.data.length : 0

  const roleLabel: Record<UserRole, string> = {
    admin: 'ผู้ดูแลระบบ', commander: 'ผู้บังคับบัญชา',
    medical: 'ทีมการแพทย์', logistics: 'โลจิสติกส์',
    controller: 'Controller', evaluator: 'ผู้ประเมิน',
    observer: 'ผู้สังเกตการณ์', participant: 'ผู้เข้าร่วม', guest: 'ผู้เยี่ยมชม',
  }

  const quickLinks = [
    { href: '/planner/drills/new', label: 'สร้าง Drill ใหม่', icon: Radio, roles: ['admin', 'commander', 'controller'] as UserRole[] },
    { href: '/core/event-log', label: 'บันทึก Event', icon: Activity, roles: ['admin', 'commander', 'controller', 'medical', 'logistics', 'observer'] as UserRole[] },
    { href: '/core/master-registry', label: 'Master Registry', icon: Users, roles: ['admin', 'commander', 'controller', 'medical', 'logistics', 'observer'] as UserRole[] },
    { href: '/core/standards', label: 'Standards', icon: BookOpen, roles: ['admin', 'commander', 'controller', 'medical', 'evaluator', 'observer', 'participant'] as UserRole[] },
    { href: '/core/aar', label: 'AAR Reports', icon: TrendingUp, roles: ['admin', 'commander', 'evaluator', 'observer'] as UserRole[] },
    { href: '/core/safety-gates', label: 'Safety Gates', icon: AlertTriangle, roles: ['admin', 'commander', 'controller'] as UserRole[] },
    ...(ctx.activeIncidentId ? [{ href: `/operation/${ctx.activeIncidentId}/cop`, label: 'เปิด COP', icon: Map, roles: ['admin', 'commander', 'medical', 'logistics', 'observer'] as UserRole[] }] : []),
  ].filter(l => l.roles.includes(ctx.role))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ยินดีต้อนรับ{ctx.profile.full_name ? `, ${ctx.profile.full_name}` : ''}</h1>
          <p className="text-gray-500 text-sm mt-1">
            <Badge variant="outline">{roleLabel[ctx.role]}</Badge>
            {' '}· Drill Platform Dashboard
          </p>
        </div>
      </div>

      {/* Active context summary */}
      {(ctx.activeIncident || ctx.activeScenario) && (
        <div className="flex flex-wrap gap-3">
          {ctx.activeIncident && (
            <Card className="flex-1 min-w-48 border-blue-200 bg-blue-50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Radio className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-blue-600 font-medium">Active {ctx.activeIncident.mode === 'drill' ? 'Drill' : 'Operation'}</p>
                  <p className="text-sm font-semibold text-blue-900 truncate">{ctx.activeIncident.title}</p>
                </div>
                <Badge variant="default" className="ml-auto shrink-0 text-xs">
                  {drillStatusLabel[ctx.activeIncident.status] ?? ctx.activeIncident.status}
                </Badge>
              </CardContent>
            </Card>
          )}
          {ctx.activeScenario && (
            <Card className="flex-1 min-w-48 border-purple-200 bg-purple-50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-purple-600 font-medium">Active Scenario</p>
                  <p className="text-sm font-semibold text-purple-900 truncate">[{ctx.activeScenario.code}] {ctx.activeScenario.title}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{link.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                Drills ล่าสุด
              </CardTitle>
              <Link href="/planner/drills" className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentDrills.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Drill</p>
            ) : (
              <div className="space-y-3">
                {recentDrills.map(drill => (
                  <div key={drill.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate">{drill.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {drill.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                      </Badge>
                      <Badge
                        variant={(drillStatusColor[drill.status] as 'secondary' | 'outline' | 'default' | 'destructive') ?? 'secondary'}
                        className="text-xs"
                      >
                        {drillStatusLabel[drill.status] ?? drill.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-600" />
                Event Log ล่าสุด
              </CardTitle>
              <Link href="/core/event-log" className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Events</p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      event.severity === 'critical' ? 'bg-red-500' :
                      event.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.timestamp).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Standards Registry ที่ใช้งาน</p>
            <p className="text-2xl font-bold text-gray-900">{standardsCount} รายการ</p>
          </div>
          <Link href="/core/standards" className="ml-auto text-sm text-blue-600 hover:underline">
            จัดการ →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
