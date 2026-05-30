import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, Calendar, BookOpen, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ภารกิจของฉัน' }

export default async function ParticipantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myDrills } = await supabase
    .from('drill_participants')
    .select('*, drills(title, mode, status, start_date, end_date, location)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const activeDrills = (myDrills ?? []).filter((m: { drills?: { status: string } | null }) => m.drills?.status === 'active')
  const upcomingDrills = (myDrills ?? []).filter((m: { drills?: { status: string } | null }) => m.drills?.status === 'planned')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          ภารกิจของฉัน
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          สวัสดี {profile?.full_name ?? 'ผู้ใช้งาน'} — รายการ Drills ที่คุณเข้าร่วม
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">{activeDrills.length}</p>
            <p className="text-xs text-gray-500 mt-1">กำลังดำเนินการ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{upcomingDrills.length}</p>
            <p className="text-xs text-gray-500 mt-1">กำลังจะมาถึง</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{(myDrills ?? []).length}</p>
            <p className="text-xs text-gray-500 mt-1">ทั้งหมด</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Drills */}
      {activeDrills.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Drills ที่กำลังดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeDrills.map((m: {
                id: string
                status: string
                drills?: { title: string; mode: string; status: string; start_date: string | null; location: string | null } | null
              }) => m.drills && (
                <div key={m.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{m.drills.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {m.drills.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                        </Badge>
                        {m.drills.location && (
                          <span className="text-xs text-gray-500">{m.drills.location}</span>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Drills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Drills ทั้งหมดของฉัน</CardTitle>
        </CardHeader>
        <CardContent>
          {(myDrills ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>คุณยังไม่ได้เข้าร่วม Drill ใดๆ</p>
              <p className="text-xs mt-1">ติดต่อ Commander เพื่อรับเชิญเข้าร่วม</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(myDrills ?? []).map((m: {
                id: string
                status: string
                role_in_drill: string | null
                drills?: {
                  title: string
                  mode: string
                  status: string
                  start_date: string | null
                  end_date: string | null
                  location: string | null
                } | null
              }) => m.drills && (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{m.drills.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {m.drills.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                      </Badge>
                    </div>
                    {m.role_in_drill && (
                      <p className="text-xs text-blue-600">บทบาท: {m.role_in_drill}</p>
                    )}
                    {m.drills.start_date && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(m.drills.start_date), 'dd MMM yyyy HH:mm', { locale: th })}
                      </p>
                    )}
                  </div>
                  <Badge variant={m.drills.status === 'active' ? 'default' :
                    m.drills.status === 'completed' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                    {m.drills.status === 'active' ? 'Active' :
                     m.drills.status === 'completed' ? 'เสร็จสิ้น' :
                     m.drills.status === 'planned' ? 'วางแผนแล้ว' : m.drills.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:shadow-sm transition-shadow cursor-pointer">
          <CardContent className="py-4">
            <Link href="/core/standards" className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-sm">Standards & SOP</p>
                <p className="text-xs text-gray-400">มาตรฐานและระเบียบปฏิบัติ</p>
              </div>
            </Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow cursor-pointer">
          <CardContent className="py-4">
            <Link href="/core/aar" className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-teal-600" />
              <div>
                <p className="font-medium text-sm">AAR Reports</p>
                <p className="text-xs text-gray-400">รายงานหลังการฝึกซ้อม</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
