import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Package, Building2 } from 'lucide-react'
import { AddItemDialog } from './add-item-dialog'
import { getObjectPassports, getOrganizationList } from '@/services/registry.service'
import type { ObjectPassport } from '@/contracts/registry.contract'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Master Registry' }

const typeConfig = {
  personnel: { label: 'บุคลากร', icon: Users, color: 'bg-blue-100 text-blue-700' },
  unit: { label: 'หน่วยงาน', icon: Building2, color: 'bg-green-100 text-green-700' },
  equipment: { label: 'ยุทโธปกรณ์', icon: Package, color: 'bg-orange-100 text-orange-700' },
}

export default async function MasterRegistryPage() {
  const [itemsResult, orgsResult] = await Promise.all([
    getObjectPassports(),
    getOrganizationList(),
  ])
  const items: ObjectPassport[] = itemsResult.ok ? itemsResult.data : []
  const organizations = orgsResult.ok ? orgsResult.data : []

  const byType = items.reduce<Record<string, ObjectPassport[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type]!.push(item)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Master Registry
          </h1>
          <p className="text-gray-500 text-sm mt-1">ทะเบียนหลักของบุคลากร หน่วยงาน และยุทโธปกรณ์</p>
        </div>
        <AddItemDialog organizations={organizations} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(typeConfig).map(([type, config]) => (
          <Card key={type}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
                <config.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{config.label}</p>
                <p className="text-2xl font-bold">{byType[type]?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lists by type */}
      {Object.entries(typeConfig).map(([type, config]) => {
        const records = byType[type] ?? []
        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <config.icon className="w-4 h-4" />
                {config.label}
                <Badge variant="secondary">{records.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">ยังไม่มีรายการ</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 pr-4 font-medium">รหัส</th>
                        <th className="text-left py-2 pr-4 font-medium">ชื่อ</th>
                        <th className="text-left py-2 font-medium">องค์กร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(item => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-mono text-xs text-gray-500">{item.code}</td>
                          <td className="py-2 pr-4 font-medium">{item.name}</td>
                          <td className="py-2 text-gray-500">{item.organizationName ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
