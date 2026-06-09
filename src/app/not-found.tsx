import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-200">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl font-black mb-4 text-slate-600">404</div>
        <h1 className="text-xl font-semibold mb-2">ไม่พบหน้าที่ต้องการ</h1>
        <p className="text-sm text-slate-400 mb-6">หน้านี้ไม่มีอยู่ หรืออาจถูกลบไปแล้ว</p>
        <Link href="/dashboard" className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
          กลับสู่แดชบอร์ด
        </Link>
      </div>
    </div>
  )
}
