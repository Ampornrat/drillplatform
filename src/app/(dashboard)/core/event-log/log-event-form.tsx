'use client'

import { useState, useTransition } from 'react'
import { logEventAction } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface Drill {
  id: string
  title: string
  mode: string
  status: string
}

interface Props {
  drills: Drill[]
  defaultDrillId?: string
  onClose?: () => void
}

export function LogEventForm({ drills, defaultDrillId, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('info')
  const [eventType, setEventType] = useState('observation')
  const [drillId, setDrillId] = useState(defaultDrillId ?? '')

  function reset() {
    setTitle('')
    setDescription('')
    setSeverity('info')
    setEventType('observation')
    setDrillId(defaultDrillId ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('กรุณาระบุชื่อ Event')
      return
    }

    const fd = new FormData()
    fd.append('title', title.trim())
    if (description.trim()) fd.append('description', description.trim())
    fd.append('severity', severity)
    fd.append('event_type', eventType)
    if (drillId) fd.append('drill_id', drillId)

    startTransition(async () => {
      const result = await logEventAction(fd)
      if (result?.error) {
        toast.error('บันทึก Event ไม่สำเร็จ', { description: result.error })
      } else {
        toast.success('บันทึก Event สำเร็จ')
        reset()
        onClose?.()
      }
    })
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            บันทึก Event ใหม่
          </CardTitle>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="event-title" className="text-xs">ชื่อ Event *</Label>
              <Input
                id="event-title"
                placeholder="เช่น ทีม Alpha ถึงพื้นที่เกิดเหตุแล้ว"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ระดับความรุนแรง</Label>
              <Select value={severity} onValueChange={v => v && setSeverity(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ข้อมูล</SelectItem>
                  <SelectItem value="warning">แจ้งเตือน</SelectItem>
                  <SelectItem value="critical">วิกฤต</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ประเภท Event</Label>
              <Select value={eventType} onValueChange={v => v && setEventType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation">สังเกตการณ์</SelectItem>
                  <SelectItem value="inject">Inject</SelectItem>
                  <SelectItem value="decision">การตัดสินใจ</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="communication">การสื่อสาร</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="medical">การแพทย์</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {drills.length > 0 && (
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">เชื่อมกับ Drill (ไม่บังคับ)</Label>
                <Select value={drillId} onValueChange={v => setDrillId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก Drill..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ไม่ระบุ</SelectItem>
                    {drills.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title} · {d.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">รายละเอียด (ไม่บังคับ)</Label>
              <Textarea
                placeholder="รายละเอียดเพิ่มเติม..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending} size="sm">
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              บันทึก Event
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              ล้างฟอร์ม
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
