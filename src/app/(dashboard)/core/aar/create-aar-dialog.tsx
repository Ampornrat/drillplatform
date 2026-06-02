'use client'

import { useState, useTransition } from 'react'
import { createAARReportAction } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Plus, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'

interface Drill {
  id: string
  title: string
  mode: string
  status: string
}

interface Props {
  drills: Drill[]
}

export function CreateAARDialog({ drills }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [drillId, setDrillId] = useState('')
  const [summary, setSummary] = useState('')
  const [rating, setRating] = useState('')

  function reset() {
    setTitle('')
    setDrillId('')
    setSummary('')
    setRating('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('กรุณาระบุชื่อ AAR Report')
      return
    }
    if (!drillId) {
      toast.error('กรุณาเลือก Drill')
      return
    }

    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('drill_id', drillId)
    if (summary.trim()) fd.append('summary', summary.trim())
    if (rating) fd.append('rating', rating)

    startTransition(async () => {
      const result = await createAARReportAction(fd)
      if (result?.error) {
        toast.error('สร้าง AAR Report ไม่สำเร็จ', { description: result.error })
      } else {
        toast.success('สร้าง AAR Report สำเร็จ')
        reset()
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        สร้าง AAR Report
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>สร้าง AAR Report ใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="aar-title">ชื่อรายงาน *</Label>
            <Input
              id="aar-title"
              placeholder="เช่น AAR การฝึกซ้อมรับมือน้ำท่วม ครั้งที่ 1/2026"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>เลือก Drill *</Label>
            {drills.length === 0 ? (
              <p className="text-xs text-gray-400">ยังไม่มี Drill ที่พร้อมทำ AAR</p>
            ) : (
              <Select value={drillId} onValueChange={v => setDrillId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Drill ที่ต้องการทำ AAR..." />
                </SelectTrigger>
                <SelectContent>
                  {drills.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title} · {d.mode === 'drill' ? 'ฝึกซ้อม' : 'ปฏิบัติการ'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="aar-summary">สรุปภาพรวม</Label>
            <Textarea
              id="aar-summary"
              placeholder="สรุปผลการฝึกซ้อมในภาพรวม..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              คะแนนรวม (1–5)
            </Label>
            <Select value={rating} onValueChange={v => setRating(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="ให้คะแนน..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">ไม่ให้คะแนน</SelectItem>
                <SelectItem value="1">1 — ต้องปรับปรุงมาก</SelectItem>
                <SelectItem value="2">2 — พอใช้</SelectItem>
                <SelectItem value="3">3 — ดี</SelectItem>
                <SelectItem value="4">4 — ดีมาก</SelectItem>
                <SelectItem value="5">5 — ดีเยี่ยม</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending || drills.length === 0} className="flex-1">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              สร้าง AAR Report
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
