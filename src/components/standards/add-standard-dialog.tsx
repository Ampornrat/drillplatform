'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'

export function AddStandardDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    code: '',
    category: '',
    version: '1.0',
    content: '',
    effective_date: '',
  })

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.code || !form.category) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('standards_registry').insert({
        title: form.title,
        code: form.code.toUpperCase(),
        category: form.category,
        version: form.version || '1.0',
        content: form.content || null,
        effective_date: form.effective_date || null,
        is_active: true,
      })

      if (error) {
        console.error('Supabase insert error:', error)
        toast.error('เพิ่มไม่สำเร็จ', { description: error.message ?? error.code })
      } else {
        toast.success('เพิ่มมาตรฐานสำเร็จ')
        setOpen(false)
        setForm({ title: '', code: '', category: '', version: '1.0', content: '', effective_date: '' })
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="w-4 h-4 mr-2" />
        เพิ่มมาตรฐาน
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>เพิ่มมาตรฐานใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">รหัสมาตรฐาน *</Label>
              <Input
                id="code"
                placeholder="STD-004"
                value={form.code}
                onChange={e => handleChange('code', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">เวอร์ชัน</Label>
              <Input
                id="version"
                placeholder="1.0"
                value={form.version}
                onChange={e => handleChange('version', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">ชื่อมาตรฐาน *</Label>
            <Input
              id="title"
              placeholder="ชื่อมาตรฐาน / SOP"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">หมวดหมู่ *</Label>
            <select
              id="category"
              value={form.category}
              onChange={e => handleChange('category', e.target.value)}
              required
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">เลือกหมวดหมู่</option>
              <option value="emergency">ฉุกเฉิน</option>
              <option value="drill">การฝึกซ้อม</option>
              <option value="safety">ความปลอดภัย</option>
              <option value="operation">ปฏิบัติการ</option>
              <option value="admin">บริหาร</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective_date">วันที่มีผลบังคับ</Label>
            <Input
              id="effective_date"
              type="date"
              value={form.effective_date}
              onChange={e => handleChange('effective_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">รายละเอียด</Label>
            <Textarea
              id="content"
              placeholder="รายละเอียดของมาตรฐาน..."
              value={form.content}
              onChange={e => handleChange('content', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
