import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Plus, Mail } from 'lucide-react'
import { getOrganizationList } from '@/services/registry.service'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'จัดการองค์กร' }

export default async function OrganizationsPage() {
  const result = await getOrganizationList()
  const orgs = result.ok ? result.data : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            จัดการองค์กร
          </h1>
          <p className="text-gray-500 text-sm mt-1">บริหารจัดการองค์กรและหน่วยงานในระบบ</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มองค์กร
        </Button>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มีองค์กร</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(org => (
            <Card key={org.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{org.name}</h3>
                      {!org.is_active && <Badge variant="outline" className="text-xs text-red-500 shrink-0">ปิดใช้งาน</Badge>}
                    </div>
                    <p className="text-xs font-mono text-gray-400 mb-2">{org.code}</p>
                    {org.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{org.description}</p>
                    )}
                    {org.contact_email && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="w-3 h-3" />
                        {org.contact_email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <Button variant="ghost" size="sm">แก้ไข</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
