'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface FieldQueueItem {
  id: string
  queueKey: string
  payload: Record<string, string>
  createdAt: string
  retryCount: number
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error?: string
}

const STORAGE_KEY = 'field_queue_v1'

function readQueue(): FieldQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(items: FieldQueueItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function useFieldQueue(
  queueKey: string,
  action?: (payload: Record<string, string>) => Promise<{ ok: boolean; message?: string }>
) {
  const [items, setItems] = useState<FieldQueueItem[]>([])
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const actionRef = useRef(action)
  actionRef.current = action

  useEffect(() => {
    setItems(readQueue().filter(i => i.queueKey === queueKey))

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [queueKey])

  const enqueue = useCallback(
    (payload: Record<string, string>): string => {
      const item: FieldQueueItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        queueKey,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
      }
      const all = [...readQueue(), item]
      writeQueue(all)
      setItems(all.filter(i => i.queueKey === queueKey))
      return item.id
    },
    [queueKey]
  )

  const retryAll = useCallback(async () => {
    const handler = actionRef.current
    if (!handler) return

    const all = readQueue()
    const pending = all.filter(
      i => i.queueKey === queueKey && (i.status === 'pending' || i.status === 'failed')
    )

    for (const item of pending) {
      const sending = readQueue().map(i =>
        i.id === item.id ? { ...i, status: 'sending' as const } : i
      )
      writeQueue(sending)
      setItems(sending.filter(i => i.queueKey === queueKey))

      try {
        const result = await handler(item.payload)
        const done = readQueue().map(i =>
          i.id === item.id
            ? {
                ...i,
                status: result.ok ? ('sent' as const) : ('failed' as const),
                error: result.ok ? undefined : (result.message ?? 'ส่งไม่สำเร็จ'),
                retryCount: i.retryCount + 1,
              }
            : i
        )
        writeQueue(done)
        setItems(done.filter(i => i.queueKey === queueKey))
      } catch (err) {
        const done = readQueue().map(i =>
          i.id === item.id
            ? {
                ...i,
                status: 'failed' as const,
                error: String(err),
                retryCount: i.retryCount + 1,
              }
            : i
        )
        writeQueue(done)
        setItems(done.filter(i => i.queueKey === queueKey))
      }
    }
  }, [queueKey])

  const clearSent = useCallback(() => {
    const next = readQueue().filter(i => !(i.queueKey === queueKey && i.status === 'sent'))
    writeQueue(next)
    setItems(next.filter(i => i.queueKey === queueKey))
  }, [queueKey])

  const remove = useCallback(
    (id: string) => {
      const next = readQueue().filter(i => i.id !== id)
      writeQueue(next)
      setItems(next.filter(i => i.queueKey === queueKey))
    },
    [queueKey]
  )

  // Auto-retry when coming online
  useEffect(() => {
    if (isOnline) retryAll()
  }, [isOnline, retryAll])

  const pendingCount = items.filter(
    i => i.status === 'pending' || i.status === 'failed' || i.status === 'sending'
  ).length

  return { items, isOnline, pendingCount, enqueue, retryAll, clearSent, remove }
}

/** Global pending count across all queue keys */
export function useFieldQueueGlobal() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const update = () => {
      const all = readQueue()
      setPendingCount(
        all.filter(i => i.status === 'pending' || i.status === 'failed' || i.status === 'sending').length
      )
    }
    update()
    const handleOnline = () => { setIsOnline(true); update() }
    const handleOffline = () => { setIsOnline(false); update() }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('storage', update)
    }
  }, [])

  return { pendingCount, isOnline }
}
