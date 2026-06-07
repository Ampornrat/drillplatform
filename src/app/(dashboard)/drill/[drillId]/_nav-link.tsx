'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  drillId: string
  drillTitle: string
  userName: string | null
}

export default function DrillSidebarNav({ drillId, drillTitle, userName }: Props) {
  const pathname = usePathname()

  const items = [
    { href: `/drill/${drillId}/dashboard`,        label: 'Dashboard',        Icon: LayoutDashboard },
    { href: `/drill/${drillId}/scenario-builder`, label: 'Scenario Builder', Icon: FlaskConical },
  ]

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {items.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-orange-600' : 'text-gray-400')} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
