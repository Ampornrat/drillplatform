'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield, LayoutDashboard, Users, Building2, BookOpen, Box,
  ClipboardList, AlertTriangle, ScrollText, FileBarChart2,
  Radio, Eye, LogOut, Map, FlaskConical,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { AppCtx, UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  exact?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

function buildNavGroups(ctx: AppCtx): NavGroup[] {
  const { role, activeIncidentId } = ctx

  const dashboardGroup: NavGroup = {
    title: 'ภาพรวม',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  }

  const copItem: NavItem | null = activeIncidentId
    ? { href: `/operation/${activeIncidentId}/cop`, label: 'COP', icon: Map }
    : null

  const drillDashItem: NavItem | null = activeIncidentId
    ? { href: `/drill/${activeIncidentId}/dashboard`, label: 'Drill Dashboard', icon: FlaskConical }
    : null

  switch (role) {
    case 'admin':
      return [
        dashboardGroup,
        {
          title: 'Core Modules',
          items: [
            { href: '/core/master-registry', label: 'Master Registry', icon: Users },
            { href: '/core/standards', label: 'Standards Registry', icon: BookOpen },
            { href: '/core/authority-matrix', label: 'Authority Matrix', icon: ClipboardList },
            { href: '/core/safety-gates', label: 'Safety Gate Rules', icon: AlertTriangle },
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/core/aar', label: 'AAR / LMS', icon: FileBarChart2 },
          ],
        },
        {
          title: 'การดำเนินงาน',
          items: [
            { href: '/planner/drills', label: 'จัดการ Drills / Ops', icon: Radio },
            { href: '/observer', label: 'สังเกตการณ์', icon: Eye },
            ...(copItem ? [copItem] : []),
            ...(drillDashItem ? [drillDashItem] : []),
          ],
        },
        {
          title: 'การจัดการ',
          items: [
            { href: '/admin/users', label: 'จัดการผู้ใช้', icon: Users },
            { href: '/admin/organizations', label: 'จัดการองค์กร', icon: Building2 },
            { href: '/admin/registry', label: 'Object Registry', icon: Box },
          ],
        },
      ]

    case 'commander':
      return [
        dashboardGroup,
        {
          title: 'ปฏิบัติการ',
          items: [
            { href: '/planner/drills', label: 'Drills / Operations', icon: Radio },
            ...(copItem ? [copItem] : []),
            ...(drillDashItem ? [drillDashItem] : []),
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/observer', label: 'สังเกตการณ์', icon: Eye },
          ],
        },
        {
          title: 'การจัดการ',
          items: [
            { href: '/core/safety-gates', label: 'Safety Gates', icon: AlertTriangle },
            { href: '/core/aar', label: 'AAR / LMS', icon: FileBarChart2 },
            { href: '/core/master-registry', label: 'Master Registry', icon: Users },
          ],
        },
      ]

    case 'controller':
      return [
        dashboardGroup,
        {
          title: 'ควบคุม Drill',
          items: [
            { href: '/planner/drills', label: 'จัดการ Drills', icon: Radio },
            { href: '/core/safety-gates', label: 'Safety Gates', icon: AlertTriangle },
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/observer', label: 'สังเกตการณ์', icon: Eye },
          ],
        },
        {
          title: 'ข้อมูล',
          items: [
            { href: '/core/master-registry', label: 'Master Registry', icon: Users },
            { href: '/core/standards', label: 'Standards', icon: BookOpen },
          ],
        },
      ]

    case 'evaluator':
      return [
        dashboardGroup,
        {
          title: 'การประเมิน',
          items: [
            { href: '/observer', label: 'สังเกตการณ์', icon: Eye },
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/core/aar', label: 'AAR / LMS', icon: FileBarChart2 },
          ],
        },
        {
          title: 'ข้อมูลอ้างอิง',
          items: [
            { href: '/core/standards', label: 'Standards', icon: BookOpen },
          ],
        },
      ]

    case 'medical':
      return [
        dashboardGroup,
        {
          title: 'ปฏิบัติการสนาม',
          items: [
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            ...(copItem ? [copItem] : []),
          ],
        },
        {
          title: 'ทรัพยากร',
          items: [
            { href: '/core/master-registry', label: 'Master Registry', icon: Users },
            { href: '/core/standards', label: 'Standards', icon: BookOpen },
          ],
        },
      ]

    case 'logistics':
      return [
        dashboardGroup,
        {
          title: 'โลจิสติกส์',
          items: [
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/core/master-registry', label: 'Master Registry', icon: Truck },
          ],
        },
      ]

    case 'observer':
      return [
        dashboardGroup,
        {
          title: 'ติดตาม',
          items: [
            { href: '/observer', label: 'สังเกตการณ์ Realtime', icon: Eye },
            { href: '/core/event-log', label: 'Event Log', icon: ScrollText },
            { href: '/core/aar', label: 'AAR / LMS', icon: FileBarChart2 },
          ],
        },
        {
          title: 'ข้อมูล',
          items: [
            { href: '/core/master-registry', label: 'Master Registry', icon: Users },
            { href: '/core/standards', label: 'Standards', icon: BookOpen },
          ],
        },
      ]

    case 'participant':
      return [
        dashboardGroup,
        {
          title: 'ภารกิจ',
          items: [
            { href: '/participant', label: 'ภารกิจของฉัน', icon: ClipboardList },
            { href: '/core/standards', label: 'Standards', icon: BookOpen },
          ],
        },
      ]

    default: // guest
      return [dashboardGroup]
  }
}

const roleLabel: Record<UserRole, string> = {
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

const roleBadgeColor: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  commander: 'bg-blue-100 text-blue-700',
  medical: 'bg-green-100 text-green-700',
  logistics: 'bg-orange-100 text-orange-700',
  controller: 'bg-indigo-100 text-indigo-700',
  evaluator: 'bg-teal-100 text-teal-700',
  observer: 'bg-gray-100 text-gray-700',
  participant: 'bg-gray-100 text-gray-600',
  guest: 'bg-gray-50 text-gray-500',
}

interface SidebarProps {
  ctx: AppCtx
}

export function Sidebar({ ctx }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navGroups = buildNavGroups(ctx)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
    router.refresh()
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
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')
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
                      <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-blue-600' : 'text-gray-400')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs shrink-0">{item.badge}</Badge>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 mb-1">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
            {ctx.userName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{ctx.userName ?? 'ผู้ใช้งาน'}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[ctx.role]}`}>
              {roleLabel[ctx.role]}
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
