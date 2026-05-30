import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold">Drill Platform</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
