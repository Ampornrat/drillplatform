import type { Fail } from '@/lib/result'
import { AlertTriangle, ShieldOff, Lock, CircleX, GitMerge, Database } from 'lucide-react'

const CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; tone: string }> = {
  unauthorized:        { icon: Lock,          label: 'ต้องเข้าสู่ระบบก่อน',           tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  forbidden:           { icon: ShieldOff,     label: 'ไม่มีสิทธิ์ดำเนินการ',           tone: 'text-red-600 bg-red-50 border-red-200' },
  validation_error:    { icon: AlertTriangle, label: 'ข้อมูลไม่ถูกต้อง',               tone: 'text-orange-600 bg-orange-50 border-orange-200' },
  not_found:           { icon: CircleX,       label: 'ไม่พบข้อมูล',                    tone: 'text-slate-600 bg-slate-50 border-slate-200' },
  safety_gate_blocked: { icon: ShieldOff,     label: 'ถูกบล็อกโดยด่านความปลอดภัย',    tone: 'text-red-700 bg-red-50 border-red-300' },
  conflict:            { icon: GitMerge,      label: 'ข้อมูลขัดแย้ง',                  tone: 'text-violet-600 bg-violet-50 border-violet-200' },
  database_error:      { icon: Database,      label: 'เกิดข้อผิดพลาดในฐานข้อมูล',     tone: 'text-red-600 bg-red-50 border-red-200' },
}

interface ActionErrorProps {
  error: Fail
  className?: string
}

export function ActionError({ error, className = '' }: ActionErrorProps) {
  const cfg = CONFIG[error.code] ?? CONFIG.database_error
  const Icon = cfg.icon
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${cfg.tone} ${className}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">{cfg.label}</span>
        {error.message && <p className="mt-0.5 font-normal opacity-80">{error.message}</p>}
      </div>
    </div>
  )
}
