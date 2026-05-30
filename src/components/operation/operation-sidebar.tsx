'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LayoutDashboard, Map, ClipboardList, Building2,
  Database, BookOpen, Activity, FileText,
  Settings, LogOut, Radio,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navItems = [
  { href: 'cop', label: 'ภาพรวมสั่งการ', icon: LayoutDashboard },
  { href: 'map', label: 'แผนที่ COP', icon: Map },
  { href: 'iap', label: 'แผน IAP', icon: ClipboardList, badge: 'v2.1' },
  { href: 'hospital', label: 'โรงพยาบาล', icon: Building2, badge: '2' },
  { href: 'registry', label: 'ทะเบียนกลาง', icon: Database },
  { href: 'aar', label: 'AAR', icon: BookOpen },
]

const actionItems = [
  { href: 'joint', label: 'การกระทำร่วม', icon: Activity },
  { href: 'methane', label: 'รายงาน METHANE ใหม่', icon: FileText },
]

interface OperationSidebarProps {
  incidentId: string
  mode: 'operation' | 'drill'
  userName: string | null
  userRole: string
}

export function OperationSidebar({ incidentId, mode, userName, userRole }: OperationSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/operation/${incidentId}`

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="w-56 bg-gray-900 text-white flex flex-col h-full shrink-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider">IODP</div>
            <div className="text-xs text-gray-400">OPERATION + DRILL</div>
          </div>
        </div>
        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
          <Link
            href={base + '/cop'}
            className={cn('flex-1 text-center py-1.5 font-medium transition-colors',
              mode === 'operation' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white')}
          >
            ปฏิการ
          </Link>
          <Link
            href="/planner/drills"
            className="flex-1 text-center py-1.5 font-medium text-gray-400 hover:text-white transition-colors"
          >
            ฝึก
          </Link>
        </div>
      </div>

      {/* Commander label */}
      <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
        ผู้บัญชาการ · ปฏิบัติการ
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.includes(`/${item.href}`)
          return (
            <Link
              key={item.href}
              href={`${base}/${item.href}`}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-gray-700 text-gray-300 border-0">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )
        })}

        <div className="border-t border-gray-700 my-2" />

        {actionItems.map((item) => (
          <Link
            key={item.href}
            href={`${base}/${item.href}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}

        <div className="border-t border-gray-700 my-2" />

        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>ระบบ / ตั้งค่า</span>
        </Link>
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
            {userName?.slice(0, 2).toUpperCase() ?? 'SP'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{userName ?? 'ผู้ใช้'}</div>
            <div className="text-xs text-gray-400 truncate">{userRole}</div>
          </div>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
