'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/actions/notification.actions'

export interface AppNotification {
  id: string
  type: 'info' | 'warning' | 'critical' | 'success'
  title: string
  body: string | null
  link: string | null
  read: boolean
  drill_id: string | null
  action_code: string | null
  scenario_id: string | null
  created_at: string
}

// Action codes that should fire a special inject toast
const INJECT_CODES = new Set(['INJECT_PUSHED'])
// Action codes that show as critical banner
const CRITICAL_CODES = new Set(['SAFETY_GATE_VIOLATION', 'FACILITY_DIVERSION', 'EXERCISE_PAUSED'])

interface UseNotificationsOptions {
  userId: string
  activeIncidentId?: string | null
  limit?: number
}

interface UseNotificationsReturn {
  notifications: AppNotification[]
  unreadCount: number
  criticalUnread: AppNotification[]
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: (drillId?: string) => Promise<void>
  dismiss: (id: string) => void
  refresh: () => Promise<void>
}

export function useNotifications({
  userId,
  activeIncidentId,
  limit = 50,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const seenIds = useRef(new Set<string>())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (activeIncidentId) {
      query = query.or(`drill_id.eq.${activeIncidentId},drill_id.is.null`)
    }

    const { data } = await query
    const rows = (data ?? []) as AppNotification[]
    setNotifications(rows)
    rows.forEach(n => seenIds.current.add(n.id))
    setLoading(false)
  }, [userId, activeIncidentId, limit])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification
          if (seenIds.current.has(n.id)) return
          seenIds.current.add(n.id)

          setNotifications(prev => [n, ...prev])

          // Inject pushed → special toast with acknowledge button
          if (n.action_code && INJECT_CODES.has(n.action_code)) {
            toast(n.title, {
              description: n.body ?? undefined,
              duration: 15000,
              action: {
                label: 'รับทราบ',
                onClick: () => {
                  void markNotificationReadAction(n.id)
                  setNotifications(prev =>
                    prev.map(x => x.id === n.id ? { ...x, read: true } : x)
                  )
                },
              },
            })
          } else if (n.type === 'critical') {
            // Critical → error toast + banner (banner via criticalUnread state)
            toast.error(n.title, { description: n.body ?? undefined, duration: 10000 })
          } else if (n.type === 'warning') {
            toast.warning(n.title, { description: n.body ?? undefined, duration: 6000 })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification
          setNotifications(prev => prev.map(x => x.id === n.id ? n : x))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  // Initial fetch
  useEffect(() => { void fetchNotifications() }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await markNotificationReadAction(id)
  }, [])

  const markAllRead = useCallback(async (drillId?: string) => {
    setNotifications(prev => prev.map(n =>
      (!drillId || n.drill_id === drillId) ? { ...n, read: true } : n
    ))
    await markAllNotificationsReadAction(drillId)
  }, [])

  // Client-only dismiss (hide from list without marking read on server)
  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const criticalUnread = notifications.filter(
    n => !n.read && (n.type === 'critical' || (n.action_code && CRITICAL_CODES.has(n.action_code)))
  )

  return { notifications, unreadCount, criticalUnread, loading, markRead, markAllRead, dismiss, refresh: fetchNotifications }
}
