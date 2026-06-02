import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileBarChart2, Star, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CreateAARDialog } from './create-aar-dialog'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AAR / LMS' }

const statusConfig = {
  draft: { label: 'ร่าง', color: 'secondary' as const },
  review: { label: 'รออนุมัติ', color: 'default' as const },
  approved: { label: 'อนุมัติแล้ว', color: 'default' as const },
  published: { label: 'เผยแพร่', color: 'default' as const },
}

export default async function AARPage() {
  const supabase = await createClient()

  const [{ data: reports }, { data: drills }] = await Promise.all([
    supabase
      .from('aar_reports')
      .select('*, drills(title, mode)')
      .order('created_at', { ascending: false }),
    supabase
      .from('drills')
      .select('id, title, mode, status')
      .order('created_at', { ascending: false }),
  ])

  const reportList = reports ?? []
  const avgRating = reportList.reduce((sum: number, r: { rating: number | null }) => sum + (r.rating ?? 0), 0) /
    Math.max(reportList.filter((r: { rating: number | null }) => r.rating).length, 1)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-teal-600" />
            AAR / LMS Loop
          </h1>
          <p className="text-gray-500 text-sm mt-1">After Action Review และ Learning Management System</p>
        </div>
        <CreateAARDialog drills={drills ?? []} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center">
              <FileBarChart2 className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">รายงานทั้งหมด</p>
              <p className="text-xl font-bold">{reportList.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">คะแนนเฉลี่ย</p>
              <p className="text-xl font-bold">
                {reportList.filter((r: { rating: number | null }) => r.rating).length > 0
                  ? avgRating.toFixed(1)
                  : '—'}
                <span className="text-sm text-gray-400">/5</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">เผยแพร่แล้ว</p>
              <p className="text-xl font-bold">
                {reportList.filter((r: { status: string }) => r.status === 'published').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      {reportList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <FileBarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มี AAR Reports</p>
            <p className="text-sm mt-1">กดปุ่ม &quot;สร้าง AAR Report&quot; ด้านบนเพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reportList.map((report: {
            id: string
            title: string
            summary: string | null
            status: string
            rating: number | null
            findings: Array<{ category: string }>
            created_at: string
            drills?: { title: string; mode: string } | null
          }) => {
            const statusCfg = statusConfig[report.status as keyof typeof statusConfig] ?? statusConfig.draft
            const strengths = (report.findings ?? []).filter((f: { category: string }) => f.category === 'strength').length
            const improvements = (report.findings ?? []).filter((f: { category: string }) => f.category === 'improvement').length
            const criticals = (report.findings ?? []).filter((f: { category: string }) => f.category === 'critical').length
            return (
              <Card key={report.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{report.title}</h3>
                        <Badge variant={statusCfg.color} className="text-xs">{statusCfg.label}</Badge>
                      </div>
                      {report.drills && (
                        <p className="text-xs text-gray-400 mb-2">
                          Drill: {report.drills.title} · {report.drills.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                        </p>
                      )}
                      {report.summary && (
                        <p className="text-sm text-gray-500 line-clamp-2">{report.summary}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        {strengths > 0 && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />จุดแข็ง {strengths}
                          </span>
                        )}
                        {improvements > 0 && (
                          <span className="flex items-center gap-1 text-xs text-yellow-600">
                            <TrendingUp className="w-3 h-3" />ปรับปรุง {improvements}
                          </span>
                        )}
                        {criticals > 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="w-3 h-3" />วิกฤต {criticals}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {report.rating && (
                        <div className="flex items-center gap-1 text-yellow-500 mb-1">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm font-semibold">{report.rating}/5</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        {format(new Date(report.created_at), 'dd MMM yyyy', { locale: th })}
                      </p>
                    </div>
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
