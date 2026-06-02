'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'

interface EventRow {
  id: string
  severity: string
  title: string
  timestamp: string
}

interface Props {
  initialEvents: EventRow[]
}

export function RealtimeEvents({ initialEvents }: Props) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('observer:event_log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_log' },
        (payload) => {
          const newEvent = payload.new as EventRow
          setEvents(prev => [newEvent, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (events.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">ยังไม่มี Events</p>
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
          <AlertCircle className={`w-4 h-4 shrink-0 ${
            event.severity === 'critical' ? 'text-red-500' :
            event.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
          }`} />
          <span className="text-sm text-gray-700 flex-1 truncate">{event.title}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(event.timestamp).toLocaleTimeString('th-TH')}
          </span>
        </div>
      ))}
    </div>
  )
}
