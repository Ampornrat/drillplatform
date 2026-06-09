'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Wifi, WifiOff, RefreshCw, Home, UserCheck, Activity, Package, ClipboardList } from 'lucide-react'
import { useFieldQueueGlobal } from '@/hooks/use-field-queue'
import { cn } from '@/lib/utils'

interface FieldShellProps {
  children: React.ReactNode
  title: string
  backHref?: string
}

const NAV_ITEMS = [
  { href: '/field', label: 'หน้าหลัก', icon: Home },
  { href: '/field/check-in', label: 'Check-in', icon: UserCheck },
  { href: '/field/triage', label: 'คัดแยก', icon: Activity },
  { href: '/field/supply-request', label: 'สนับสนุน', icon: Package },
  { href: '/field/evaluator-observation', label: 'ผู้ประเมิน', icon: ClipboardList },
]

export function FieldShell({ children, title, backHref }: FieldShellProps) {
  const pathname = usePathname()
  const { pendingCount, isOnline } = useFieldQueueGlobal()

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {backHref ? (
          <Link href={backHref} className="p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : null}
        <span className="flex-1 font-semibold text-gray-900 text-base truncate">{title}</span>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <RefreshCw className="w-3 h-3" />
              {pendingCount} รอ
            </span>
          )}
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-center text-xs font-medium text-red-700">
          ออฟไลน์ — ข้อมูลจะถูกส่งเมื่อเชื่อมต่ออีกครั้ง
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 bg-white border-t border-gray-200 pb-safe">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 px-1 text-[10px] font-medium transition-colors',
                  active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'text-blue-600')} />
                <span className="truncate leading-tight">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
