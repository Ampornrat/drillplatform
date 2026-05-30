import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Radio, Plus, Calendar, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'จัดการ Drills' }

const statusConfig = {
  draft: { label: 'ร่าง', color: 'secondary' as const },
  planned: { label: 'วางแผนแล้ว', color: 'outline' as const },
  active: { label: 'กำลังดำเนินการ', color: 'default' as const },
  paused: { label: 'หยุดชั่วคราว', color: 'secondary' as const },
  completed: { label: 'เสร็จสิ้น', color: 'outline' as const },
  cancelled: { label: 'ยกเลิก', color: 'destructive' as const },
}

const modeConfig = {
  operation: { label: 'ปฏิบัติการ', color: 'bg-blue-100 text-blue-700' },
  drill: { label: 'ฝึกซ้อม', color: 'bg-orange-100 text-orange-700' },
}

export default async function DrillsPage() {
  const supabase = await createClient()
  const { data: drills } = await supabase
    .from('drills')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-blue-600" />
            จัดการ Drills
          </h1>
          <p className="text-gray-500 text-sm mt-1">วางแผนและจัดการ session การฝึกซ้อมและปฏิบัติการ</p>
        </div>
        <Button asChild>
          <Link href="/planner/drills/new">
            <Plus className="w-4 h-4 mr-2" />
            สร้าง Drill ใหม่
          </Link>
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = (drills ?? []).filter((d: { status: string }) => d.status === status).length
          return (
            <Card key={status}>
              <CardContent className="py-3 text-center">
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <Badge variant={cfg.color} className="text-xs mt-1">{cfg.label}</Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Drills List */}
      {(drills ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มี Drills</p>
            <Button className="mt-4" asChild>
              <Link href="/planner/drills/new">สร้าง Drill แรก</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(drills ?? []).map((drill: {
            id: string
            title: string
            description: string | null
            mode: 'operation' | 'drill'
            status: string
            start_date: string | null
            end_date: string | null
            location: string | null
            max_participants: number | null
            organizations?: { name: string } | null
          }) => {
            const statusCfg = statusConfig[drill.status as keyof typeof statusConfig] ?? statusConfig.draft
            const modeCfg = modeConfig[drill.mode] ?? modeConfig.drill
            return (
              <Card key={drill.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{drill.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modeCfg.color}`}>
                          {modeCfg.label}
                        </span>
                        <Badge variant={statusCfg.color} className="text-xs">{statusCfg.label}</Badge>
                      </div>
                      {drill.description && (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{drill.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        {drill.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(drill.start_date), 'dd MMM yyyy', { locale: th })}
                          </span>
                        )}
                        {drill.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {drill.location}
                          </span>
                        )}
                        {drill.max_participants && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            สูงสุด {drill.max_participants} คน
                          </span>
                        )}
                        {drill.organizations && (
                          <span className="text-gray-300">|</span>
                        )}
                        {drill.organizations && (
                          <span>{drill.organizations.name}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/planner/drills/${drill.id}`}>รายละเอียด</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
