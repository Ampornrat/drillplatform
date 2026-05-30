import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollText, Activity, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Event Log' }

const severityConfig = {
  info: { label: 'ข้อมูล', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'default' as const },
  warning: { label: 'แจ้งเตือน', icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'secondary' as const },
  critical: { label: 'วิกฤต', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'destructive' as const },
}

export default async function EventLogPage() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('event_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100)

  const criticalCount = (events ?? []).filter((e: { severity: string }) => e.severity === 'critical').length
  const warningCount = (events ?? []).filter((e: { severity: string }) => e.severity === 'warning').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-green-600" />
            Event Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">บันทึกเหตุการณ์แบบ Real-time สำหรับทุก session</p>
        </div>
        <Button>
          <Activity className="w-4 h-4 mr-2" />
          บันทึก Event ใหม่
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ทั้งหมด</p>
              <p className="text-xl font-bold">{(events ?? []).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">แจ้งเตือน</p>
              <p className="text-xl font-bold">{warningCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">วิกฤต</p>
              <p className="text-xl font-bold text-red-600">{criticalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">รายการ Events</CardTitle>
        </CardHeader>
        <CardContent>
          {(events ?? []).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>ยังไม่มี Events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(events ?? []).map((event: {
                id: string
                severity: string
                title: string
                description: string | null
                event_type: string
                mode: string
                timestamp: string
              }) => {
                const config = severityConfig[event.severity as keyof typeof severityConfig] ?? severityConfig.info
                return (
                  <div key={event.id} className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}>
                    <config.icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900">{event.title}</span>
                        <Badge variant={config.badge} className="text-xs">{config.label}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {event.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-xs text-gray-500">{event.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {format(new Date(event.timestamp), 'dd MMM HH:mm', { locale: th })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
