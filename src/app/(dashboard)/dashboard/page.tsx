import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity, AlertTriangle, BookOpen, ClipboardList,
  Radio, TrendingUp, Users, Zap
} from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardStats(userId: string) {
  const supabase = await createClient()

  const [drillsRes, eventsRes, standardsRes] = await Promise.all([
    supabase.from('drills').select('id, status, mode').order('created_at', { ascending: false }).limit(5),
    supabase.from('event_log').select('id, severity, title, timestamp').order('timestamp', { ascending: false }).limit(5),
    supabase.from('standards_registry').select('id').eq('is_active', true),
  ])

  return {
    recentDrills: drillsRes.data ?? [],
    recentEvents: eventsRes.data ?? [],
    standardsCount: standardsRes.data?.length ?? 0,
  }
}

const drillStatusLabel: Record<string, string> = {
  draft: 'ร่าง',
  planned: 'วางแผนแล้ว',
  active: 'กำลังดำเนินการ',
  paused: 'หยุดชั่วคราว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

const drillStatusColor: Record<string, string> = {
  draft: 'secondary',
  planned: 'outline',
  active: 'default',
  paused: 'secondary',
  completed: 'outline',
  cancelled: 'destructive',
}

const severityColor: Record<string, string> = {
  info: 'text-blue-600',
  warning: 'text-yellow-600',
  critical: 'text-red-600',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'participant') as UserRole
  const { recentDrills, recentEvents, standardsCount } = await getDashboardStats(user.id)

  const greeting = profile?.full_name ? `สวัสดี, ${profile.full_name}` : 'ยินดีต้อนรับ'

  const roleLabel: Record<UserRole, string> = {
    admin: 'ผู้ดูแลระบบ',
    commander: 'ผู้บังคับบัญชา',
    observer: 'ผู้สังเกตการณ์',
    participant: 'ผู้เข้าร่วม',
    guest: 'ผู้เยี่ยมชม',
  }

  const quickLinks = [
    { href: '/planner/drills/new', label: 'สร้าง Drill ใหม่', icon: Radio, roles: ['admin', 'commander'] as UserRole[] },
    { href: '/core/event-log', label: 'บันทึก Event', icon: Activity, roles: ['admin', 'commander', 'observer'] as UserRole[] },
    { href: '/core/master-registry', label: 'Master Registry', icon: Users, roles: ['admin', 'commander', 'observer'] as UserRole[] },
    { href: '/core/standards', label: 'Standards', icon: BookOpen, roles: ['admin', 'commander', 'observer', 'participant'] as UserRole[] },
    { href: '/core/aar', label: 'AAR Reports', icon: TrendingUp, roles: ['admin', 'commander', 'observer'] as UserRole[] },
    { href: '/core/safety-gates', label: 'Safety Gates', icon: AlertTriangle, roles: ['admin', 'commander'] as UserRole[] },
  ].filter(l => l.roles.includes(role))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-500 text-sm mt-1">
            <Badge variant="outline">{roleLabel[role]}</Badge>
            {' '}· Drill Platform Dashboard
          </p>
        </div>
      </div>

      {/* Quick Links */}
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
        {/* Recent Drills */}
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
                {recentDrills.map((drill: { id: string; status: string; mode: string }) => (
                  <div key={drill.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate">{drill.id.slice(0, 8)}...</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
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

        {/* Recent Events */}
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
                {recentEvents.map((event: { id: string; severity: string; title: string; timestamp: string }) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
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

      {/* Standards count card */}
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
