'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search, Filter, Plus, RefreshCw, ChevronLeft, ChevronRight,
  Box, AlertCircle, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createObjectAction } from '@/actions/object.actions'
import { cn } from '@/lib/utils'
import type { ObjectRegistryItem, ObjectRegistryPage, ObjectListFilters, CapabilityItem } from '@/contracts/registry.contract'

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100 text-green-700',
  en_route:    'bg-blue-100 text-blue-700',
  on_scene:    'bg-orange-100 text-orange-700',
  standby:     'bg-yellow-100 text-yellow-700',
  unavailable: 'bg-gray-100 text-gray-500',
  maintenance: 'bg-red-100 text-red-700',
  demobilized: 'bg-gray-200 text-gray-500',
}
const STATUS_LABELS: Record<string, string> = {
  available: 'ว่าง', en_route: 'กำลังส่ง', on_scene: 'ที่เกิดเหตุ',
  standby: 'Standby', unavailable: 'ไม่พร้อม', maintenance: 'ซ่อมบำรุง', demobilized: 'ปลดประจำการ',
}
const TYPE_LABELS: Record<string, string> = {
  ambulance: 'รถพยาบาล', boat: 'เรือ', HEMS: 'HEMS', UAV: 'UAV',
  ALS_unit: 'ALS Unit', BLS_unit: 'BLS Unit',
  personnel: 'บุคลากร', unit: 'หน่วย', equipment: 'อุปกรณ์', vehicle: 'ยานพาหนะ', other: 'อื่นๆ',
}

interface Props {
  initialData: ObjectRegistryPage
  capabilities: CapabilityItem[]
  initialFilters: ObjectListFilters
}

export function RegistryList({ initialData, capabilities, initialFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState(initialFilters)
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  const applyFilters = useCallback((newFilters: ObjectListFilters) => {
    const params = new URLSearchParams()
    if (newFilters.search)       params.set('search', newFilters.search)
    if (newFilters.type)         params.set('type', newFilters.type)
    if (newFilters.status)       params.set('status', newFilters.status)
    if (newFilters.minReadiness) params.set('minReadiness', String(newFilters.minReadiness))
    if (newFilters.capability)   params.set('cap', newFilters.capability)
    if (newFilters.page && newFilters.page > 1) params.set('page', String(newFilters.page))
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router])

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    applyFilters({ ...filters, page: 1 })
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createObjectAction(fd)
      if (!result.ok) { toast.error(result.message); return }
      toast.success('เพิ่ม Object เรียบร้อย')
      setShowCreate(false)
      router.push(`/admin/registry/${result.data.id}`)
    })
  }

  const totalPages = Math.ceil(data.total / data.pageSize)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b shrink-0">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Admin · ทะเบียนทรัพยากร</div>
          <h1 className="text-xl font-bold text-gray-900">Object Registry</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data.total} รายการ</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4" />
          เพิ่ม Object
        </Button>
      </header>

      {/* Create form */}
      {showCreate && (
        <div className="bg-blue-50 border-b px-5 py-3 shrink-0">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Object Code *</label>
              <Input name="object_code" placeholder="UAV-RECON-2026-0011" className="h-8 text-sm w-48" required />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">ชื่อ *</label>
              <Input name="name" placeholder="ชื่อ Object" className="h-8 text-sm w-48" required />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Type *</label>
              <Select name="type" required>
                <SelectTrigger className="h-8 text-sm w-36">
                  <SelectValue placeholder="เลือก Type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">เจ้าของ</label>
              <Input name="owner" placeholder="หน่วยงาน/บุคคล" className="h-8 text-sm w-36" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">ฐานที่ตั้ง</label>
              <Input name="home_location" placeholder="สถานที่" className="h-8 text-sm w-36" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-8" disabled={isPending}>
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'สร้าง'}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>
                ยกเลิก
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b shrink-0 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={filters.search ?? ''}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="ค้นหา Object Code / ชื่อ"
              className="pl-8 h-8 text-sm w-56"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
            <Filter className="w-3.5 h-3.5" />
          </Button>
        </form>

        <Select
          value={filters.type ?? ''}
          onValueChange={v => applyFilters({ ...filters, type: v as ObjectListFilters['type'], page: 1 })}
        >
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue placeholder="ทุก Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุก Type</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? ''}
          onValueChange={v => applyFilters({ ...filters, status: v as ObjectListFilters['status'], page: 1 })}
        >
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue placeholder="ทุก Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุก Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.minReadiness != null ? String(filters.minReadiness) : ''}
          onValueChange={v => applyFilters({ ...filters, minReadiness: v ? Number(v) : undefined, page: 1 })}
        >
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue placeholder="Readiness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุก Readiness</SelectItem>
            <SelectItem value="80">≥ 80%</SelectItem>
            <SelectItem value="50">≥ 50%</SelectItem>
            <SelectItem value="0">ทุกระดับ</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.capability ?? ''}
          onValueChange={v => applyFilters({ ...filters, capability: v || undefined, page: 1 })}
        >
          <SelectTrigger className="h-8 text-sm w-40">
            <SelectValue placeholder="Capability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุก Capability</SelectItem>
            {capabilities.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filters.search || filters.type || filters.status || filters.minReadiness || filters.capability) && (
          <Button
            size="sm" variant="ghost" className="h-8 text-xs text-gray-500"
            onClick={() => applyFilters({ page: 1, pageSize: 20 })}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            ล้าง
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b z-10">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-48">Object Code</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">ชื่อ</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-24">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-28">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-24">Readiness</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Capabilities</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-28">เจ้าของ</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  <Box className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">ไม่พบ Object</div>
                  {(filters.search || filters.type || filters.status) && (
                    <div className="text-xs mt-1">ลองล้าง Filter แล้วค้นหาใหม่</div>
                  )}
                </td>
              </tr>
            )}
            {data.items.map(item => (
              <ObjectRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-white shrink-0">
          <span className="text-xs text-gray-500">
            หน้า {data.page} / {totalPages} ({data.total} รายการ)
          </span>
          <div className="flex gap-1">
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={data.page <= 1}
              onClick={() => applyFilters({ ...filters, page: data.page - 1 })}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={data.page >= totalPages}
              onClick={() => applyFilters({ ...filters, page: data.page + 1 })}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ObjectRow({ item }: { item: ObjectRegistryItem }) {
  const readinessColor = item.readiness >= 80 ? 'text-green-600' : item.readiness >= 50 ? 'text-orange-500' : 'text-red-500'

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        <Link
          href={`/admin/registry/${item.id}`}
          className="font-mono text-xs font-semibold text-blue-700 hover:underline"
        >
          {item.object_code}
        </Link>
        {item.drill_id && (
          <div className="flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-orange-600">ประจำการ</span>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="text-sm text-gray-900 font-medium">{item.name}</div>
        {item.home_location && (
          <div className="text-xs text-gray-400">{item.home_location}</div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-gray-600">{TYPE_LABELS[item.type] ?? item.type}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[item.status])}>
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-16 bg-gray-200 rounded-full h-1.5 shrink-0">
            <div
              className={cn('h-1.5 rounded-full', item.readiness >= 80 ? 'bg-green-500' : item.readiness >= 50 ? 'bg-orange-400' : 'bg-red-500')}
              style={{ width: `${item.readiness}%` }}
            />
          </div>
          <span className={cn('text-xs font-medium', readinessColor)}>{item.readiness}%</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {item.capability.slice(0, 3).map(c => (
            <Badge key={c} variant="secondary" className="text-xs h-4 px-1 py-0">{c}</Badge>
          ))}
          {item.capability.length > 3 && (
            <Badge variant="outline" className="text-xs h-4 px-1 py-0">+{item.capability.length - 3}</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">{item.owner ?? '—'}</td>
      <td className="px-4 py-2.5 text-right">
        <Link href={`/admin/registry/${item.id}`}>
          <Button size="sm" variant="ghost" className="h-7 text-xs">เปิด</Button>
        </Link>
      </td>
    </tr>
  )
}
