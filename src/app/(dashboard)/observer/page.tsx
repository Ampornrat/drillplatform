import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Eye, Activity, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'สังเกตการณ์' }

export default async function ObserverPage() {
  const supabase = await createClient()
  const [{ data: activeDrills }, { data: recentEvents }] = await Promise.all([
    supabase.from('drills').select('*').eq('status', 'active').order('start_date'),
    supabase.from('event_log').select('*').order('timestamp', { ascending: false }).limit(10),
  ])

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
            <Badge>{(activeDrills ?? []).length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(activeDrills ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ไม่มี Drill ที่กำลังดำเนินการ</p>
          ) : (
            <div className="space-y-3">
              {(activeDrills ?? []).map((drill: {
                id: string
                title: string
                mode: string
                start_date: string | null
              }) => (
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
                      <Link href={`/core/event-log?drill=${drill.id}`}>สังเกตการณ์</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Log Event */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            บันทึก Event ด่วน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">บันทึกเหตุการณ์ที่สังเกตเห็นระหว่าง Drill</p>
          <Button asChild>
            <Link href="/core/event-log">
              <Activity className="w-4 h-4 mr-2" />
              ไปที่ Event Log
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Events ล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentEvents ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Events</p>
          ) : (
            <div className="space-y-2">
              {(recentEvents ?? []).map((event: {
                id: string
                severity: string
                title: string
                timestamp: string
              }) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <AlertCircle className={`w-4 h-4 shrink-0 ${
                    event.severity === 'critical' ? 'text-red-500' :
                    event.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                  }`} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{event.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString('th-TH')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
