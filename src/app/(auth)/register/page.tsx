'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน')
      return
    }
    if (password.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: 'participant' },
          emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        },
      })
      if (error) {
        toast.error('สมัครไม่สำเร็จ', { description: error.message })
      } else if (data.session) {
        // Email confirmation disabled — logged in immediately
        toast.success('สมัครและเข้าสู่ระบบสำเร็จ')
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.success('สมัครใช้งานสำเร็จ', {
          description: 'กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ',
        })
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-0">
      <CardHeader className="text-center pb-2">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-2xl">สมัครใช้งาน</CardTitle>
        <CardDescription>สร้างบัญชีใหม่สำหรับ Drill Platform</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="ชื่อ นามสกุล"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            สมัครใช้งาน
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          มีบัญชีแล้ว?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
