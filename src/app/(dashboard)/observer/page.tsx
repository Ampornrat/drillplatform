import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Eye, Activity } from 'lucide-react'
import Link from 'next/link'
import { LogEventForm } from '../core/event-log/log-event-form'
import { RealtimeEvents } from './realtime-events'
import { getDrillsList } from '@/services/drill.service'
import { getEvents } from '@/services/event.service'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'สังเกตการณ์' }

export default async function ObserverPage() {
  const [activeDrillsResult, recentEventsResult, allDrillsResult] = await Promise.all([
    getDrillsList({ status: 'active' }),
    getEvents({ limit: 20 }),
    getDrillsList({ status: ['planned', 'active', 'paused'] }),
  ])
  const activeDrills = activeDrillsResult.ok ? activeDrillsResult.data : []
  const recentEvents = recentEventsResult.ok ? recentEventsResult.data : []
  const allDrills = allDrillsResult.ok ? allDrillsResult.data : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-green-600" />
          สังเกตการณ์ (Observer)
        </h1>
        <p className="text-gray-500 text-sm mt-1">ติดตาม Drills ที่กำลังดำเนินการและบันทึก Events</p>
      </div>

      {/* Active Drills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-green-600" />
            Drills ที่กำลังดำเนินการ
            <Badge>{activeDrills.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeDrills.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ไม่มี Drill ที่กำลังดำเนินการ</p>
          ) : (
            <div className="space-y-3">
              {activeDrills.map(drill => (
                <div key={drill.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div>
                    <h3 className="font-medium text-gray-900">{drill.title}</h3>
                    <Badge variant="outline" className="text-xs mt-1">
                      {drill.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Live
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/operation/${drill.id}/cop`}>เปิด COP</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/core/event-log?drill=${drill.id}`}>Event Log</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Log Event */}
      <LogEventForm
        drills={allDrills}
        defaultDrillId={activeDrills[0]?.id}
      />

      {/* Recent Events — realtime */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Events ล่าสุด
            <span className="text-xs text-green-600 font-normal flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              อัปเดตอัตโนมัติ
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RealtimeEvents initialEvents={recentEvents} />
        </CardContent>
      </Card>
    </div>
  )
}
