import Link from 'next/link'
import { Shield, Zap, Users, BookOpen, ChevronRight, CheckCircle, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAnnouncements } from '@/lib/supabase/queries'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

const features = [
  {
    icon: Zap,
    title: 'สองโหมดในระบบเดียว',
    description: 'รองรับทั้งโหมดปฏิบัติการจริง (Operation Mode) และโหมดฝึกซ้อม (Drill Mode) บน Core เดียวกัน',
  },
  {
    icon: Users,
    title: 'บริหารจัดการผู้ใช้ตาม Role',
    description: 'กำหนดสิทธิ์ตาม Authority Matrix — Admin, Commander, Observer, Participant',
  },
  {
    icon: Shield,
    title: 'Safety Gate Rules',
    description: 'กฎความปลอดภัยอัตโนมัติที่ตรวจสอบทุกขั้นตอน ป้องกันความผิดพลาดก่อนเกิด',
  },
  {
    icon: BookOpen,
    title: 'AAR / LMS Loop',
    description: 'บันทึกบทเรียน ประเมินผล และสร้างฐานความรู้จาก After Action Review',
  },
]

const stats = [
  { label: 'Core Modules', value: '6' },
  { label: 'User Roles', value: '5' },
  { label: 'System Modes', value: '2' },
  { label: 'Real-time Events', value: '∞' },
]

export default async function HomePage() {
  const announcements = await getAnnouncements(3).catch(() => [])

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 bg-blue-500/30 text-blue-100 border-blue-400/50">
              Version 1.0 MVP
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              ระบบบริหารจัดการ<br />การฝึกซ้อมและปฏิบัติการ
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Drill Platform รองรับทั้งการฝึกซ้อม (Drill Mode) และการปฏิบัติการจริง (Operation Mode)
              ด้วย Core เดียวกัน พร้อม Master Registry, Safety Gates และ AAR/LMS Loop
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">
                  เข้าสู่ระบบ
                  <ChevronRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10" asChild>
                <Link href="/documents">ดูเอกสาร / คู่มือ</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-blue-600">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">ความสามารถหลักของระบบ</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            ออกแบบมาให้รองรับทั้งองค์กรเดียวและหลายองค์กร ด้วยสถาปัตยกรรมที่ยืดหยุ่นและปลอดภัย
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">{f.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Dual Mode Section */}
      <section className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader>
                <Badge className="w-fit bg-blue-600">Operation Mode</Badge>
                <CardTitle className="text-xl mt-2">โหมดปฏิบัติการจริง</CardTitle>
                <CardDescription>สำหรับการปฏิบัติงานจริง บันทึก event ที่เกิดขึ้นจริง</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {['บันทึก Event Log แบบ Real-time', 'ติดตามสถานะทีมงานและทรัพยากร', 'Safety Gate ป้องกันข้อผิดพลาด'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardHeader>
                <Badge className="w-fit bg-orange-500">Drill Mode</Badge>
                <CardTitle className="text-xl mt-2">โหมดฝึกซ้อม / Simulation</CardTitle>
                <CardDescription>สำหรับการฝึกซ้อม ทดสอบ และพัฒนาศักยภาพ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {['จำลองสถานการณ์ตาม Scenario', 'ประเมินผลการปฏิบัติตาม Standards', 'สร้าง AAR Report เพื่อบทเรียน'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-600" />
              ข่าวสารล่าสุด
            </h2>
            <Link href="/news" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
              ดูทั้งหมด <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {announcements.map((a: { id: string; title: string; content: string; pinned: boolean; published_at: string | null }) => (
              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4 flex items-start gap-4">
                  {a.pinned && <Badge variant="destructive" className="mt-0.5 shrink-0">ปักหมุด</Badge>}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{a.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {a.published_at ? formatDistanceToNow(new Date(a.published_at), { addSuffix: true, locale: th }) : ''}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
