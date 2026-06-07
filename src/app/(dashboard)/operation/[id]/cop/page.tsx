import { notFound, redirect } from 'next/navigation'
import { getDrillCOPData } from '@/lib/supabase/queries'
import { resolveUserContext } from '@/services/context.service'
import { Bell, Search, Plus, Map, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import COPMapWrapper from '@/components/operation/cop-map-wrapper'
import { CopSafetyGates } from './cop-safety-gates'
import { RealtimeCOPEvents } from './realtime-cop-events'
import type { Metadata } from 'next'
import { format, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

export const metadata: Metadata = { title: 'COP — ภาพรวมสั่งการ' }

const drillStatusLabel: Record<string, string> = {
  draft: 'ร่าง',
  planned: 'วางแผนแล้ว',
  active: 'กำลังดำเนินการ',
  paused: 'หยุดชั่วคราว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

export default async function COPPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  const data = await getDrillCOPData(id)
  if (!data) notFound()

  const canManage = ctx.canManage
  const { drill, events, stats, gates } = data

  const elapsedText = drill.start_date
    ? formatDistanceToNow(new Date(drill.start_date), { locale: th })
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b shrink-0">
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <span>{drill.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'}</span>
          <span>/</span>
          <span className="text-gray-600 font-medium">ภาพรวมสั่งการ</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-700 font-mono">
            {drill.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-blue-500 truncate max-w-[200px]">{drill.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            สด · {stats.eventCount} เหตุการณ์
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <Search className="w-4 h-4" />
          </button>
          <div className="relative">
            <button className="text-gray-400 hover:text-gray-600">
              <Bell className="w-4 h-4" />
            </button>
            {stats.criticalEvents > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {stats.criticalEvents}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="flex items-start justify-between px-5 py-3 bg-white border-b shrink-0">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">
            {drill.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'} · ภาพรวมสั่งการ
          </div>
          <h1 className="text-xl font-bold text-gray-900">ภาพรวมสถานการณ์ร่วม (COP)</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {drill.title}
            {drill.location ? ` · ${drill.location}` : ''}
            {drill.organizations ? ` · ${drill.organizations.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            เปิดเหตุใหม่ (METHANE)
          </Button>
          <Button size="sm" className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
            <Map className="w-3.5 h-3.5" />
            เปิดแผนที่ COP
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 border-b shrink-0">
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ผู้เข้าร่วม</div>
          <div className="text-3xl font-bold text-gray-900">{stats.activeParticipants}</div>
          <div className="text-xs text-gray-400 mt-1">จากทั้งหมด {stats.totalParticipants} คน</div>
        </div>
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">Events ทั้งหมด</div>
          <div className="text-3xl font-bold text-gray-900">{stats.eventCount}</div>
          <div className="text-xs text-gray-400 mt-1">วิกฤต {stats.criticalEvents} รายการ</div>
        </div>
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ด่านความปลอดภัย</div>
          <div className={`text-3xl font-bold ${stats.gatesCritical > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.gatesCritical}
            <span className="text-sm text-gray-400 ml-1">วิกฤต</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ผ่าน {stats.gatesPassed} · ไม่ผ่าน {stats.gatesFailed}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">โหมด</div>
          <div className="text-base font-bold text-blue-600 mt-1">
            {drill.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'}
          </div>
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              {drillStatusLabel[drill.status] ?? drill.status}
            </Badge>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">เวลาที่ผ่านมา</div>
          <div className="text-base font-bold text-orange-600 mt-1">{elapsedText ?? '—'}</div>
          {drill.start_date && (
            <div className="text-xs text-gray-400 mt-1">
              เริ่ม {format(new Date(drill.start_date), 'dd MMM HH:mm', { locale: th })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ความพร้อม Gate</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.gatesTotal > 0
              ? Math.round((stats.gatesPassed / stats.gatesTotal) * 100)
              : 0}
            <span className="text-lg text-gray-400">%</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats.gatesPassed}/{stats.gatesTotal} Gate ผ่าน
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <COPMapWrapper />
        </div>

        {/* Right panel */}
        <div className="w-72 bg-white overflow-y-auto shrink-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">ข้อมูลปฏิบัติการ</h2>
            <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> แก้ไข
            </button>
          </div>

          <div className="p-4 space-y-3 border-b">
            <div>
              <div className="text-xs text-gray-500">ชื่อ</div>
              <div className="text-xs font-medium text-gray-800 mt-0.5 leading-relaxed">{drill.title}</div>
            </div>
            {drill.description && (
              <div>
                <div className="text-xs text-gray-500">คำอธิบาย</div>
                <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{drill.description}</div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">โหมด</span>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                {drill.mode === 'operation' ? 'ปฏิบัติการ' : 'ฝึกซ้อม'}
              </Badge>
            </div>
            {drill.location && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">สถานที่</span>
                <span className="text-xs text-gray-700">{drill.location}</span>
              </div>
            )}
            {drill.start_date && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">เริ่มต้น</span>
                <span className="text-xs text-gray-600">
                  {format(new Date(drill.start_date), 'dd MMM yyyy HH:mm', { locale: th })}
                </span>
              </div>
            )}
            {drill.end_date && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">สิ้นสุด</span>
                <span className="text-xs text-gray-600">
                  {format(new Date(drill.end_date), 'dd MMM yyyy HH:mm', { locale: th })}
                </span>
              </div>
            )}
            {drill.organizations && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">หน่วยงาน</span>
                <span className="text-xs text-gray-700">{drill.organizations.name}</span>
              </div>
            )}
          </div>

          {/* Safety Gates */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700">
                ด่านความปลอดภัย
                <span className="ml-1 text-gray-400">{gates.length}</span>
              </h3>
            </div>
            <CopSafetyGates drillId={id} gates={gates} canManage={canManage} />
          </div>

          {/* Recent Events — live */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">Events ล่าสุด</h3>
            <RealtimeCOPEvents drillId={id} initialEvents={events} />
          </div>
        </div>
      </div>
    </div>
  )
}
