'use client'

import { useState } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/hooks/use-notifications'

interface Props {
  criticalUnread: AppNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export function CriticalAlertBanner({ criticalUnread, onMarkRead, onMarkAllRead }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (criticalUnread.length === 0 || dismissed) return null

  const first = criticalUnread[0]!
  const hasMore = criticalUnread.length > 1

  return (
    <div className="bg-red-600 text-white px-4 py-2 border-b border-red-700">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />

        <div className="flex-1 min-w-0">
          {/* Primary alert */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{first.title}</p>
            {first.link && (
              <a href={first.link} className="text-red-200 hover:text-white shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => { onMarkRead(first.id) }}
              className="text-xs text-red-200 hover:text-white shrink-0 underline"
            >
              รับทราบ
            </button>
          </div>
          {first.body && !expanded && (
            <p className="text-xs text-red-100 mt-0.5 truncate">{first.body}</p>
          )}

          {/* Expanded alerts */}
          {expanded && (
            <div className="mt-2 space-y-2 border-t border-red-500 pt-2">
              {criticalUnread.map(n => (
                <div key={n.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-red-200 truncate">{n.body}</p>}
                  </div>
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="text-xs text-red-200 hover:text-white shrink-0 underline"
                  >
                    รับทราบ
                  </button>
                </div>
              ))}
              <button
                onClick={() => { onMarkAllRead(); setDismissed(true) }}
                className="text-xs text-red-200 hover:text-white underline"
              >
                รับทราบทั้งหมด ({criticalUnread.length})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-red-200 hover:text-white"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <>
                  <span>+{criticalUnread.length - 1}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className={cn(
              'text-red-200 hover:text-white transition-colors',
              hasMore && 'ml-1'
            )}
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
