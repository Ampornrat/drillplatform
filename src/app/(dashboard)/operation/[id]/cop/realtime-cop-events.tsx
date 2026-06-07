'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface EventRow {
  id: string
  severity: string
  title: string
  timestamp: string
  event_type: string
}

interface Props {
  drillId: string
  initialEvents: EventRow[]
}

export function RealtimeCOPEvents({ drillId, initialEvents }: Props) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`cop:event_log:${drillId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_log',
          filter: `drill_id=eq.${drillId}`,
        },
        (payload) => {
          const newEvent = payload.new as EventRow
          setEvents(prev => [newEvent, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [drillId])

  if (events.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-2">ยังไม่มี Events</p>
  }

  return (
    <div className="space-y-2">
      {events.slice(0, 6).map((event) => (
        <div key={event.id} className="flex items-start gap-2">
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
            event.severity === 'critical' ? 'bg-red-500' :
            event.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'
          }`} />
          <div className="min-w-0">
            <div className="text-xs text-gray-700 leading-tight line-clamp-2">{event.title}</div>
            <div className="text-xs text-gray-400">
              {format(new Date(event.timestamp), 'HH:mm', { locale: th })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
