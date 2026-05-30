'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Radio, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewDrillPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    mode: 'drill' as 'operation' | 'drill',
    location: '',
    start_date: '',
    end_date: '',
    max_participants: '',
    objectives: '',
  })

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('กรุณาระบุชื่อ Drill')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('drills').insert({
        title: form.title,
        description: form.description || null,
        mode: form.mode,
        status: 'draft',
        location: form.location || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        max_participants: form.max_participants ? parseInt(form.max_participants) : null,
        objectives: form.objectives ? form.objectives.split('\n').filter(Boolean) : null,
        created_by: user?.id,
      })
      if (error) {
        toast.error('สร้าง Drill ไม่สำเร็จ', { description: error.message })
      } else {
        toast.success('สร้าง Drill สำเร็จ')
        router.push('/planner/drills')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/planner/drills"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Radio className="w-6 h-6 text-blue-600" />
          สร้าง Drill ใหม่
        </h1>
        <p className="text-gray-500 text-sm mt-1">กำหนดรายละเอียดสำหรับ session การฝึกซ้อมหรือปฏิบัติการ</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">ข้อมูลพื้นฐาน</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="title">ชื่อ Drill *</Label>
                <Input id="title" placeholder="เช่น การฝึกซ้อมรับมือเหตุฉุกเฉิน ครั้งที่ 1/2026"
                  value={form.title} onChange={e => handleChange('title', e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">โหมด *</Label>
                <Select value={form.mode} onValueChange={v => handleChange('mode', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drill">ฝึกซ้อม (Drill Mode)</SelectItem>
                    <SelectItem value="operation">ปฏิบัติการจริง (Operation Mode)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">สถานที่</Label>
                <Input id="location" placeholder="เช่น ห้องประชุมหลัก, สนามฝึก A"
                  value={form.location} onChange={e => handleChange('location', e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">วันเริ่มต้น</Label>
                <Input id="start_date" type="datetime-local"
                  value={form.start_date} onChange={e => handleChange('start_date', e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">วันสิ้นสุด</Label>
                <Input id="end_date" type="datetime-local"
                  value={form.end_date} onChange={e => handleChange('end_date', e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_participants">จำนวนผู้เข้าร่วมสูงสุด</Label>
                <Input id="max_participants" type="number" min="1" placeholder="เช่น 50"
                  value={form.max_participants} onChange={e => handleChange('max_participants', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea id="description" placeholder="รายละเอียดของ Drill นี้..."
                rows={3} value={form.description} onChange={e => handleChange('description', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives">วัตถุประสงค์ (หนึ่งข้อต่อบรรทัด)</Label>
              <Textarea id="objectives" placeholder={'ฝึกการสื่อสารในภาวะวิกฤต\nทดสอบแผนการอพยพ\nประเมินความพร้อมของทีม'}
                rows={4} value={form.objectives} onChange={e => handleChange('objectives', e.target.value)} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                สร้าง Drill
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/planner/drills">ยกเลิก</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
