import { PublicNavbar } from '@/components/layout/public-navbar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <footer className="bg-gray-900 text-gray-400 text-sm py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p>© 2026 Drill Platform — ระบบบริหารจัดการการฝึกซ้อมและปฏิบัติการ</p>
        </div>
      </footer>
    </div>
  )
}
