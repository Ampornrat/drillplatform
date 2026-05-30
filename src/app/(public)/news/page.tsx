import { Bell, Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getAnnouncements } from '@/lib/supabase/queries'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'ข่าวสาร' }

export default async function NewsPage() {
  const announcements = await getAnnouncements(50).catch(() => [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Bell className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ข่าวสารและประกาศ</h1>
          <p className="text-gray-500 text-sm mt-1">ข้อมูลข่าวสาร ประกาศ และกิจกรรมต่างๆ</p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีข่าวสาร</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a: {
            id: string
            title: string
            content: string
            pinned: boolean
            published_at: string | null
          }) => (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  {a.pinned && (
                    <Pin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="font-semibold text-gray-900">{a.title}</h2>
                      {a.pinned && <Badge variant="destructive" className="text-xs">ปักหมุด</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{a.content}</p>
                    {a.published_at && (
                      <p className="text-xs text-gray-400 mt-3">
                        เผยแพร่: {format(new Date(a.published_at), 'dd MMMM yyyy', { locale: th })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
