import { Bell, Search, Plus, Map, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { mockIncident, mockStats, mockSafetyGates } from '@/lib/mock/cop-data'
import COPMapWrapper from '@/components/operation/cop-map-wrapper'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'COP — ภาพรวมสั่งการ' }

const gateStatusColor: Record<string, string> = {
  passed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
}
const gateStatusLabel: Record<string, string> = {
  passed: 'PASSED',
  pending: 'PENDING',
  critical: 'CRITICAL',
}

export default async function COPPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b shrink-0">
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <span>โหมดปฏิบัติการ</span>
          <span>/</span>
          <span className="text-gray-600 font-medium">ภาพรวมสั่งการ</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-700">{mockIncident.id}</span>
          <span className="text-xs text-blue-500">{mockIncident.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            สด · 10 เหตุการณ์
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <Search className="w-4 h-4" />
          </button>
          <div className="relative">
            <button className="text-gray-400 hover:text-gray-600">
              <Bell className="w-4 h-4" />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">4</span>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="flex items-start justify-between px-5 py-3 bg-white border-b shrink-0">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">โหมดปฏิบัติการ · ภาพรวมสั่งการ</div>
          <h1 className="text-xl font-bold text-gray-900">ภาพรวมสถานการณ์ร่วม (COP)</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {mockIncident.id} · {mockIncident.title} · สั่งการแบบ {mockIncident.mode} · {mockIncident.leadAgency}
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
        {/* Responders */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ผู้บัวตัวปฏิบัติการ</div>
          <div className="text-3xl font-bold text-gray-900">{mockStats.responders.total}</div>
          <div className="text-xs text-gray-400 mt-1">
            P1:{mockStats.responders.p1} · P2:{mockStats.responders.p2} · P3:{mockStats.responders.p3} · ■{mockStats.responders.deceased}
          </div>
        </div>
        {/* Teams */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ทีมที่ส่ง</div>
          <div className="text-3xl font-bold text-gray-900">
            {mockStats.teams.sent}
            <span className="text-lg text-gray-400">/{mockStats.teams.total}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            กำลังเดินทาง {mockStats.teams.enroute} · ถึงที่เกิดเหตุ {mockStats.teams.onsite}
          </div>
        </div>
        {/* Hospitals */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">สถานะ รพ.</div>
          <div className="text-3xl font-bold text-gray-900">{mockStats.hospitals.availableBeds}
            <span className="text-sm text-gray-400 ml-1">เตียง</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">{mockStats.hospitals.notes}</div>
        </div>
        {/* Safety gates */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ด่านความปลอดภัย</div>
          <div className="text-3xl font-bold text-red-600">{mockStats.safetyGates.critical}
            <span className="text-sm text-gray-400 ml-1">วิกฤต</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">{mockStats.safetyGates.note}</div>
        </div>
        {/* Response level */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ระดับตอบสนอง</div>
          <div className="text-base font-bold text-orange-600 mt-1">{mockStats.responseLevel.label}</div>
          <div className="text-xs text-gray-400 mt-1">บุกรตัว {mockStats.responseLevel.elapsed}</div>
        </div>
        {/* COP completeness */}
        <div className="bg-white rounded-xl border p-3 col-span-1">
          <div className="text-xs text-gray-500 mb-1">ความครบถ้วน COP</div>
          <div className="text-3xl font-bold text-gray-900">{mockStats.copCompleteness.percent}
            <span className="text-lg text-gray-400">%</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {mockStats.copCompleteness.reported} จาก {mockStats.copCompleteness.total} จุด รายงานแล้ว
          </div>
        </div>
      </div>

      {/* Main content: Map + Right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <COPMapWrapper />
        </div>

        {/* Right panel */}
        <div className="w-72 bg-white overflow-y-auto shrink-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">ศูนย์สั่งการเหตุ</h2>
            <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> แก้ไข
            </button>
          </div>

          <div className="p-4 space-y-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">รูปแบบศูนย์สั่งการ</span>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{mockIncident.mode}</Badge>
            </div>
            <div>
              <div className="text-xs text-gray-500">หน่วยนำ</div>
              <div className="text-xs font-medium text-gray-800 mt-0.5">{mockIncident.leadAgency}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">ห้วงปฏิบัติ</span>
              <span className="text-xs font-medium text-gray-700">{mockIncident.operationPeriod}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">เวอร์ชัน IAP</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">{mockIncident.iapVersion}</Badge>
                <span className="text-xs text-green-600">อนุมัติแล้ว {mockIncident.iapApprovedAt}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">ระดับการตอบสนอง</span>
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{mockIncident.responseLevel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">เริ่มเหตุ</span>
              <span className="text-xs text-gray-600">{mockIncident.startedAt} · {mockIncident.startedAgo}</span>
            </div>
          </div>

          {/* Safety Gates */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700">
                ด่านความปลอดภัย (Safety Gates)
                <span className="ml-1 text-gray-400">{mockSafetyGates.length}</span>
              </h3>
              <button className="text-xs text-blue-600 hover:underline">จัดการ</button>
            </div>
            <div className="space-y-2">
              {mockSafetyGates.map((gate) => (
                <div key={gate.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-700">{gate.id}</div>
                    <div className="text-xs text-gray-400">{gate.label}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${gateStatusColor[gate.status]}`}>
                    {gateStatusLabel[gate.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
