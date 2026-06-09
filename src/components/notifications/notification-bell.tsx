'use client'

import { useState } from 'react'
import { Bell, CheckCheck, ExternalLink, X, AlertTriangle, Info, CheckCircle2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { AppNotification } from '@/hooks/use-notifications'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'เมื่อสักครู่'
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
  return `${Math.floor(diff / 86400)} วันที่แล้ว`
}

const typeIcon = {
  critical: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
  warning:  <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0" />,
  info:     <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
  success:  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />,
}

const typeRow = {
  critical: 'bg-red-50 border-red-100',
  warning:  'bg-yellow-50 border-yellow-100',
  info:     '',
  success:  'bg-green-50 border-green-100',
}

// ── Notification item ─────────────────────────────────────────────────────────

function NotifItem({
  n,
  onMarkRead,
  onDismiss,
}: {
  n: AppNotification
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}) {
  return (
    <div className={cn(
      'flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 transition-colors',
      !n.read && 'bg-blue-50/40',
      typeRow[n.type],
    )}>
      <div className="mt-0.5">{typeIcon[n.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs leading-snug', !n.read ? 'font-semibold text-gray-900' : 'text-gray-600')}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>
        )}
        <p className="text-xs text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {n.link && (
          <a href={n.link} className="text-gray-300 hover:text-blue-500 transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {!n.read && (
          <button onClick={() => onMarkRead(n.id)}
            className="text-gray-300 hover:text-blue-500 transition-colors" title="ทำเครื่องหมายว่าอ่านแล้ว">
            <CheckCheck className="w-3 h-3" />
          </button>
        )}
        <button onClick={() => onDismiss(n.id)}
          className="text-gray-200 hover:text-gray-400 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = 'all' | 'unread' | 'critical'

interface Props {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
  activeIncidentId?: string | null
}

export function NotificationBell({
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  activeIncidentId,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'critical') return n.type === 'critical'
    return true
  })

  const criticalCount = notifications.filter(n => !n.read && n.type === 'critical').length

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          criticalCount > 0 && 'text-red-500 hover:text-red-600'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center',
            criticalCount > 0 ? 'bg-red-500' : 'bg-blue-500'
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-80 p-0 max-h-[480px] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
          <span className="font-semibold text-sm text-gray-800">การแจ้งเตือน</span>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> อ่านทั้งหมด
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-100">
          {(['all', 'unread', 'critical'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 text-xs py-1.5 font-medium transition-colors',
                filter === f
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {f === 'all' ? 'ทั้งหมด' : f === 'unread' ? `ยังไม่อ่าน (${unreadCount})` : `Critical (${criticalCount})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
              <p className="text-xs">ไม่มีการแจ้งเตือน</p>
            </div>
          )}
          {!loading && filtered.map(n => (
            <NotifItem key={n.id} n={n} onMarkRead={onMarkRead} onDismiss={onDismiss} />
          ))}
        </div>

        {/* Footer */}
        {activeIncidentId && (
          <div className="border-t border-gray-100 px-3 py-2 text-center">
            <a
              href={`/drill/${activeIncidentId}/dashboard`}
              className="text-xs text-blue-600 hover:underline"
            >
              ดู Drill Dashboard
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
