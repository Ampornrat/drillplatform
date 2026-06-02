import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Radio, ArrowLeft, Calendar, MapPin, Users,
  Activity, Target, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { DrillStatusActions } from './drill-status-actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'รายละเอียด Drill' }

const statusConfig: Record<string, { label: string; color: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'ร่าง', color: 'secondary' },
  planned: { label: 'วางแผนแล้ว', color: 'outline' },
  active: { label: 'กำลังดำเนินการ', color: 'default' },
  paused: { label: 'หยุดชั่วคราว', color: 'secondary' },
  completed: { label: 'เสร็จสิ้น', color: 'outline' },
  cancelled: { label: 'ยกเลิก', color: 'destructive' },
}

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: drill }, { data: profile }, { data: events }, { data: participants }] = await Promise.all([
    supabase.from('drills')
      .select('*, organizations(name)')
      .eq('id', id)
      .single(),
    supabase.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
    supabase.from('event_log')
      .select('id, severity, title, timestamp, event_type')
      .eq('drill_id', id)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase.from('drill_participants')
      .select('id, status, role_in_drill')
      .eq('drill_id', id),
  ])

  if (!drill) notFound()

  const statusCfg = statusConfig[drill.status] ?? statusConfig.draft
  const org = drill.organizations as { name: string } | null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/planner/drills">
            <ArrowLeft className="w-4 h-4 mr-1" />
            จัดการ Drills
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Radio className="w-6 h-6 text-blue-600 shrink-0" />
              {drill.title}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              drill.mode === 'operation'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {drill.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'}
            </span>
            <Badge variant={statusCfg.color}>{statusCfg.label}</Badge>
          </div>
          {drill.description && (
            <p className="text-gray-500 text-sm mt-1">{drill.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
            {drill.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(drill.start_date), 'dd MMM yyyy HH:mm', { locale: th })}
              </span>
            )}
            {drill.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {drill.location}
              </span>
            )}
            {org && <span>{org.name}</span>}
          </div>
        </div>
        <DrillStatusActions
          drillId={drill.id}
          currentStatus={drill.status}
          userRole={profile?.role ?? 'participant'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Participants card */}
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ผู้เข้าร่วม</p>
              <p className="text-xl font-bold">{(participants ?? []).length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Events card */}
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Events</p>
              <p className="text-xl font-bold">{(events ?? []).length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Max participants */}
        {drill.max_participants && (
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">รับสูงสุด</p>
                <p className="text-xl font-bold">{drill.max_participants} คน</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Objectives */}
      {drill.objectives && (drill.objectives as string[]).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              วัตถุประสงค์
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {(drill.objectives as string[]).map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-purple-400 shrink-0 mt-0.5">•</span>
                  {obj}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              Events ล่าสุด
            </CardTitle>
            <Link
              href={`/core/event-log?drill=${drill.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี Events</p>
          ) : (
            <div className="space-y-2">
              {(events ?? []).map((event: {
                id: string
                severity: string
                title: string
                timestamp: string
                event_type: string
              }) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <AlertCircle className={`w-4 h-4 shrink-0 ${
                    event.severity === 'critical' ? 'text-red-500' :
                    event.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                  }`} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{event.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {format(new Date(event.timestamp), 'dd MMM HH:mm', { locale: th })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* COP link for active drills */}
      {drill.status === 'active' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">Drill กำลังดำเนินการอยู่</p>
              <p className="text-sm text-blue-700 mt-0.5">เปิด Common Operating Picture เพื่อติดตามแบบ Real-time</p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/operation/${drill.id}/cop`}>เปิด COP</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
