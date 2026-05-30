'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield, LayoutDashboard, Users, Building2, BookOpen,
  ClipboardList, AlertTriangle, ScrollText, FileBarChart2,
  Radio, Zap, ChevronDown, LogOut, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  roles?: UserRole[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'ภาพรวม',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Core Modules',
    items: [
      { href: '/core/master-registry', label: 'Master Registry', icon: Users, roles: ['admin', 'commander', 'observer'] },
      { href: '/core/standards', label: 'Standards Registry', icon: BookOpen, roles: ['admin', 'commander', 'observer'] },
      { href: '/core/authority-matrix', label: 'Authority Matrix', icon: ClipboardList, roles: ['admin'] },
      { href: '/core/safety-gates', label: 'Safety Gate Rules', icon: AlertTriangle, roles: ['admin', 'commander'] },
      { href: '/core/event-log', label: 'Event Log', icon: ScrollText, roles: ['admin', 'commander', 'observer'] },
      { href: '/core/aar', label: 'AAR / LMS', icon: FileBarChart2, roles: ['admin', 'commander', 'observer'] },
    ],
  },
  {
    title: 'การดำเนินงาน',
    items: [
      { href: '/planner/drills', label: 'จัดการ Drills', icon: Radio, roles: ['admin', 'commander'] },
      { href: '/observer', label: 'สังเกตการณ์', icon: Zap, roles: ['admin', 'commander', 'observer'] },
      { href: '/participant', label: 'ภารกิจของฉัน', icon: ClipboardList, roles: ['participant'] },
    ],
  },
  {
    title: 'การจัดการ',
    items: [
      { href: '/admin/users', label: 'จัดการผู้ใช้', icon: Users, roles: ['admin'] },
      { href: '/admin/organizations', label: 'จัดการองค์กร', icon: Building2, roles: ['admin'] },
    ],
  },
]

interface SidebarProps {
  userRole: UserRole
  userName: string | null
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
    router.refresh()
  }

  const roleLabel: Record<UserRole, string> = {
    admin: 'ผู้ดูแลระบบ',
    commander: 'ผู้บังคับบัญชา',
    observer: 'ผู้สังเกตการณ์',
    participant: 'ผู้เข้าร่วม',
    guest: 'ผู้เยี่ยมชม',
  }

  const roleBadgeColor: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-700',
    commander: 'bg-blue-100 text-blue-700',
    observer: 'bg-green-100 text-green-700',
    participant: 'bg-gray-100 text-gray-700',
    guest: 'bg-gray-100 text-gray-500',
  }

  return (
    <aside className="w-64 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Drill Platform</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.roles || item.roles.includes(userRole)
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.title}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className={cn('w-4 h-4', isActive ? 'text-blue-600' : 'text-gray-400')} />
                        {item.label}
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">{item.badge}</Badge>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 mb-1">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm">
            {userName?.charAt(0) ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName ?? 'ผู้ใช้งาน'}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[userRole]}`}>
              {roleLabel[userRole]}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
