'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/news', label: 'ข่าวสาร' },
  { href: '/documents', label: 'เอกสาร / คู่มือ' },
]

export function PublicNavbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg">Drill Platform</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-blue-600',
                  pathname === link.href ? 'text-blue-600' : 'text-gray-600'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild>
              <Link href="/register">สมัครใช้งาน</Link>
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'block py-2 text-sm font-medium transition-colors',
                pathname === link.href ? 'text-blue-600' : 'text-gray-700'
              )}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/login">เข้าสู่ระบบ</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/register">สมัครใช้งาน</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}
