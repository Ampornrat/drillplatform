import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { getUserList } from '@/services/registry.service'
import type { Metadata } from 'next'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'จัดการผู้ใช้' }

const roleLabels: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  commander: 'ผู้บังคับบัญชา',
  medical: 'ทีมการแพทย์',
  logistics: 'โลจิสติกส์',
  controller: 'Controller',
  evaluator: 'ผู้ประเมิน',
  observer: 'ผู้สังเกตการณ์',
  participant: 'ผู้เข้าร่วม',
  guest: 'ผู้เยี่ยมชม',
}
const roleColors: Record<UserRole, string> = {
  admin: 'destructive',
  commander: 'default',
  medical: 'secondary',
  logistics: 'secondary',
  controller: 'secondary',
  evaluator: 'secondary',
  observer: 'secondary',
  participant: 'outline',
  guest: 'outline',
}

export default async function UsersPage() {
  const result = await getUserList()
  const profiles = result.ok ? result.data : []

  const roleCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            จัดการผู้ใช้
          </h1>
          <p className="text-gray-500 text-sm mt-1">บริหารจัดการบัญชีผู้ใช้งานและสิทธิ์การเข้าถึง</p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['admin', 'commander', 'observer', 'participant', 'guest'] as UserRole[]).map(role => (
          <Card key={role}>
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold">{roleCounts[role] ?? 0}</p>
              <Badge
                variant={roleColors[role] as 'destructive' | 'default' | 'secondary' | 'outline'}
                className="text-xs mt-1"
              >
                {roleLabels[role]}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">รายชื่อผู้ใช้ ({profiles.length} คน)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">ชื่อ</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">องค์กร</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">ตำแหน่ง</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">วันที่สมัคร</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">ยังไม่มีผู้ใช้</td>
                  </tr>
                ) : (
                  profiles.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-semibold">
                            {p.full_name?.charAt(0) ?? '?'}
                          </div>
                          <span className="font-medium">{p.full_name ?? 'ไม่ระบุ'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={roleColors[p.role] as 'destructive' | 'default' | 'secondary' | 'outline'}
                          className="text-xs"
                        >
                          {roleLabels[p.role]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{p.organizationName ?? '-'}</td>
                      <td className="py-3 px-4 text-gray-500">{p.position ?? '-'}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {format(new Date(p.created_at), 'dd MMM yyyy', { locale: th })}
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm">จัดการ</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
