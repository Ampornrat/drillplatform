import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Calendar } from 'lucide-react'
import { AddStandardDialog } from '@/components/standards/add-standard-dialog'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Standards Registry' }

const categoryLabels: Record<string, string> = {
  emergency: 'ฉุกเฉิน',
  drill: 'การฝึกซ้อม',
  safety: 'ความปลอดภัย',
  operation: 'ปฏิบัติการ',
  admin: 'บริหาร',
  other: 'อื่นๆ',
}

export default async function StandardsPage() {
  const supabase = await createClient()
  const { data: standards } = await supabase
    .from('standards_registry')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('title')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-600" />
            Standards Registry
          </h1>
          <p className="text-gray-500 text-sm mt-1">มาตรฐาน ระเบียบปฏิบัติ และ SOP ที่ใช้อ้างอิง</p>
        </div>
        <AddStandardDialog />
      </div>

      {(standards ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มีมาตรฐานที่กำหนด</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(standards ?? []).map((std: {
            id: string
            code: string
            title: string
            category: string
            version: string
            content: string | null
            effective_date: string | null
          }) => (
            <Card key={std.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="text-xs font-mono">{std.code}</Badge>
                  <Badge variant="secondary" className="text-xs">v{std.version}</Badge>
                </div>
                <CardTitle className="text-sm mt-2 leading-snug">{std.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    {categoryLabels[std.category] ?? std.category}
                  </span>
                </div>
                {std.content && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{std.content}</p>
                )}
                {std.effective_date && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    มีผลบังคับ: {format(new Date(std.effective_date), 'dd MMM yyyy', { locale: th })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
