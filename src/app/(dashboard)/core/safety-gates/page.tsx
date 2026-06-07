import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ShieldCheck, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSafetyGateRules } from '@/services/registry.service'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Safety Gate Rules' }

const actionConfig = {
  block: { label: 'หยุดการดำเนินการ', color: 'destructive' as const, bg: 'bg-red-50 border-red-200' },
  warn: { label: 'แจ้งเตือน', color: 'secondary' as const, bg: 'bg-yellow-50 border-yellow-200' },
  notify: { label: 'แจ้งผู้เกี่ยวข้อง', color: 'default' as const, bg: 'bg-blue-50 border-blue-200' },
}

const conditionLabel: Record<string, string> = {
  pre_check: 'ก่อนเริ่ม',
  during: 'ระหว่างดำเนินการ',
  post_check: 'หลังสิ้นสุด',
}

export default async function SafetyGatesPage() {
  const result = await getSafetyGateRules(true)
  const rules = result.ok ? result.data : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            Safety Gate Rules
          </h1>
          <p className="text-gray-500 text-sm mt-1">กฎความปลอดภัยที่ตรวจสอบอัตโนมัติในทุกขั้นตอน</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่ม Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มี Safety Gate Rules</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => {
            const actionCfg = actionConfig[rule.action] ?? actionConfig.notify
            return (
              <Card key={rule.id} className={`border ${actionCfg.bg}`}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                        <Badge variant={actionCfg.color} className="text-xs">{actionCfg.label}</Badge>
                        <Badge variant="outline" className="text-xs">{conditionLabel[rule.condition_type] ?? rule.condition_type}</Badge>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-gray-500">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">ใช้กับโหมด:</span>
                        {rule.applies_to_modes.map(m => (
                          <Badge key={m} variant="secondary" className="text-xs">
                            {m === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                          </Badge>
                        ))}
                        <span className="text-xs text-gray-400 ml-auto">Priority: {rule.priority}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
