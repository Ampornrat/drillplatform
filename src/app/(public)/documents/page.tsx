import { FileText, Download, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPublicDocuments } from '@/lib/supabase/queries'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Metadata } from 'next'
import type { DocumentCategory } from '@/types'

export const metadata: Metadata = { title: 'เอกสาร / คู่มือ' }

const categoryLabels: Record<DocumentCategory, string> = {
  manual: 'คู่มือ',
  sop: 'SOP',
  guide: 'แนวทาง',
  form: 'แบบฟอร์ม',
  report: 'รายงาน',
  other: 'อื่นๆ',
}

const categoryColors: Record<DocumentCategory, string> = {
  manual: 'bg-blue-100 text-blue-700',
  sop: 'bg-green-100 text-green-700',
  guide: 'bg-purple-100 text-purple-700',
  form: 'bg-yellow-100 text-yellow-700',
  report: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
}

export default async function DocumentsPage() {
  const documents = await getPublicDocuments().catch(() => [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เอกสาร / คู่มือ</h1>
          <p className="text-gray-500 text-sm mt-1">คู่มือการใช้งาน, SOP, แบบฟอร์ม และเอกสารสำคัญต่างๆ</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีเอกสาร</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc: {
            id: string
            title: string
            description: string | null
            category: DocumentCategory
            file_url: string | null
            tags: string[] | null
            download_count: number
            created_at: string
          }) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="py-5 flex flex-col flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[doc.category] || categoryColors.other}`}>
                      {categoryLabels[doc.category] || doc.category}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-2 leading-snug">{doc.title}</h3>
                {doc.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{doc.description}</p>
                )}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {format(new Date(doc.created_at), 'dd MMM yy', { locale: th })}
                  </span>
                  {doc.file_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={doc.file_url} download>
                        <Download className="w-3 h-3 mr-1" />
                        ดาวน์โหลด
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      ดูออนไลน์
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
