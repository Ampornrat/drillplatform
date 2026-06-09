import { redirect } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import { resolveUserContext } from '@/services/context.service'

export const metadata: Metadata = {
  title: { default: 'Field | Drill Platform', template: '%s | Field' },
  description: 'Mobile field operations',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const ctx = await resolveUserContext()
  if (!ctx.ok) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative">
      {children}
    </div>
  )
}
