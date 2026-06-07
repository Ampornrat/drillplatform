import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react'
import { getAuthorityMatrix } from '@/services/registry.service'
import type { Metadata } from 'next'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'Authority Matrix' }

const roles: UserRole[] = ['admin', 'commander', 'medical', 'logistics', 'controller', 'evaluator', 'observer', 'participant', 'guest']
const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  commander: 'Commander',
  medical: 'Medical',
  logistics: 'Logistics',
  controller: 'Controller',
  evaluator: 'Evaluator',
  observer: 'Observer',
  participant: 'Participant',
  guest: 'Guest',
}
const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  commander: 'bg-blue-100 text-blue-700',
  medical: 'bg-green-100 text-green-700',
  logistics: 'bg-orange-100 text-orange-700',
  controller: 'bg-indigo-100 text-indigo-700',
  evaluator: 'bg-teal-100 text-teal-700',
  observer: 'bg-gray-100 text-gray-700',
  participant: 'bg-gray-100 text-gray-700',
  guest: 'bg-gray-50 text-gray-500',
}

export default async function AuthorityMatrixPage() {
  const result = await getAuthorityMatrix()
  const matrix = result.ok ? result.data : []

  const grouped = matrix.reduce<Record<string, Record<string, boolean>>>((acc, row) => {
    const key = `${row.resource}::${row.action}`
    if (!acc[key]) acc[key] = {}
    acc[key][row.role] = row.allowed
    return acc
  }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          Authority Matrix
        </h1>
        <p className="text-gray-500 text-sm mt-1">เมทริกซ์สิทธิ์การเข้าถึงตาม Role</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Resource / Action</th>
                {roles.map(role => (
                  <th key={role} className="py-3 px-4 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleColors[role]}`}>
                      {roleLabels[role]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([key, permissions], idx) => {
                const [resource, action] = key.split('::')
                return (
                  <tr key={key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{resource}</span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="text-gray-700">{action}</span>
                      </div>
                    </td>
                    {roles.map(role => (
                      <td key={role} className="py-3 px-4 text-center">
                        {permissions[role] === true || permissions['admin'] === true ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {Object.keys(grouped).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    ยังไม่มีข้อมูล Authority Matrix
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
