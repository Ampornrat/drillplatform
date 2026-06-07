import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ไม่มีสิทธิ์เข้าถึง' }

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-500 text-sm mt-2">
            คุณไม่มีสิทธิ์เพียงพอในการเข้าถึงหน้านี้
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard">กลับ Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
