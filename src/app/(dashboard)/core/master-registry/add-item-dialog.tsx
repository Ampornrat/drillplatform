'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'

type Org = { id: string; name: string }

export function AddItemDialog({ organizations }: { organizations: Org[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<string>('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [orgId, setOrgId] = useState<string>('none')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !name || !code) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('master_registry').insert({
        type,
        name,
        code: code.toUpperCase(),
        organization_id: orgId === 'none' ? null : orgId,
        data: {},
      })
      if (error) {
        toast.error('เพิ่มรายการไม่สำเร็จ', { description: error.message })
      } else {
        toast.success('เพิ่มรายการสำเร็จ')
        setOpen(false)
        setType('')
        setName('')
        setCode('')
        setOrgId('none')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มรายการ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มรายการใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>ประเภท</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger>
                <SelectValue placeholder="เลือกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personnel">บุคลากร</SelectItem>
                <SelectItem value="unit">หน่วยงาน</SelectItem>
                <SelectItem value="equipment">ยุทโธปกรณ์</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ</Label>
            <Input
              id="name"
              placeholder="ชื่อรายการ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">รหัส</Label>
            <Input
              id="code"
              placeholder="เช่น UNIT-001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          {organizations.length > 0 && (
            <div className="space-y-2">
              <Label>องค์กร (ถ้ามี)</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกองค์กร" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              เพิ่มรายการ
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
