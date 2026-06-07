'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { COPMap } from './cop-map'
import { StatusBadge, Panel, SafetyGate } from './shared'
import { Icon } from './icon'
import { useAppContextSafe } from '@/components/providers/app-context-provider'
import { useCopDispatch } from '@/lib/iodp/use-cop-dispatch'
import type { DispatchAssignment } from '@/lib/iodp/use-cop-dispatch'
import {
  createAndDispatchTaskForce,
  updateAssignmentStatus,
} from '@/actions/dispatch.actions'

type Data = any
type FireEvent = (e: { severity: string; title: string; body: string }) => void

const PRIORITY_OPTS = [
  { value: 'routine',   label: 'ปกติ (Routine)' },
  { value: 'urgent',    label: 'เร่งด่วน (Urgent)' },
  { value: 'immediate', label: 'ฉุกเฉิน (Immediate)' },
]

const NEXT_STATUS: Record<string, { value: string; label: string; cls: string }> = {
  assigned:  { value: 'en_route',  label: 'เดินทาง',     cls: 'btn sm' },
  en_route:  { value: 'on_scene',  label: 'ถึงที่เกิดเหตุ', cls: 'btn sm primary' },
  on_scene:  { value: 'available', label: 'ว่าง',         cls: 'btn sm ghost' },
  available: { value: 'released',  label: 'คืน',          cls: 'btn sm ghost' },
}

export function CopDispatch({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  const appCtx = useAppContextSafe()
  const drillId = appCtx?.activeIncidentId ?? null

  const { resources, assignments, gates, copMarkers, sites, loading, error, refresh } =
    useCopDispatch(drillId)

  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const [tfName, setTfName]             = useState('')
  const [tfCapability, setTfCapability] = useState('')
  const [tfDestination, setTfDest]      = useState('')
  const [tfPriority, setTfPriority]     = useState<'routine' | 'urgent' | 'immediate'>('routine')
  const [selectedIds, setSelectedIds]   = useState<string[]>([])
  const [dispatching, setDispatching]   = useState(false)
  const [dispatchErr, setDispatchErr]   = useState<string | null>(null)
  const [filter, setFilter]             = useState('all')
  const [updatingId, setUpdatingId]     = useState<string | null>(null)

  // Build COP map data from real Supabase sources, fall back to demo
  const copMapData = useMemo(() => {
    const siteItems = sites.map(s => ({
      id: s.id, lat: s.lat ?? undefined, lng: s.lng ?? undefined,
      type: s.type, name: s.name, site_code: s.code, status: 'active',
    }))
    const teamItems = copMarkers
      .filter(m => m.marker_type === 'team' && m.lat && m.lng)
      .map(m => ({
        id: m.marker_id, lat: m.lat!, lng: m.lng!,
        type: 'team', name: m.name, site_code: m.code, status: m.status,
      }))
    const patientMarkers = copMarkers
      .filter(m => m.marker_type === 'patient' && m.lat && m.lng)
      .map(m => ({ lat: m.lat!, lng: m.lng!, lvl: m.triage_level ?? 'P3', triage_level: m.triage_level ?? undefined }))
    if (siteItems.length === 0 && teamItems.length === 0) {
      return { sites: data?.sites ?? [], patient_markers: data?.patient_markers ?? [] }
    }
    return { sites: [...siteItems, ...teamItems], patient_markers: patientMarkers }
  }, [sites, copMarkers, data])

  const filteredResources = useMemo(() => resources.filter(r => {
    if (filter === 'available') return !r.active_assignment_id
    if (filter === 'all') return true
    return r.type === filter
  }), [resources, filter])

  const uniqueTypes = useMemo(
    () => Array.from(new Set(resources.map(r => r.type))).filter(Boolean),
    [resources]
  )
  const capabilities = useMemo(
    () => Array.from(new Set(resources.map(r => r.capability).filter(Boolean) as string[])),
    [resources]
  )
  const destOptions = useMemo(
    () => sites.map(s => ({ value: s.code, label: `${s.code} — ${s.name}` })),
    [sites]
  )

  const toggleResource = useCallback((id: string) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }, [])

  const handleDispatch = useCallback(async () => {
    if (!drillId || selectedIds.length === 0 || !tfName.trim()) {
      setDispatchErr('กรอกชื่อและเลือกทรัพยากรก่อน')
      return
    }
    setDispatching(true); setDispatchErr(null)
    const res = await createAndDispatchTaskForce({
      drillId, name: tfName.trim(), capability: tfCapability,
      destination: tfDestination, priority: tfPriority, memberIds: selectedIds,
    })
    setDispatching(false)
    if (!res.ok) {
      setDispatchErr(res.message)
      if (res.code === 'safety_gate_blocked')
        fireEvent({ severity: 'critical', title: 'SAFETY_GATE_BLOCKED', body: res.message })
      return
    }
    fireEvent({
      severity: 'info', title: `DISPATCH_ASSIGNED · ${tfName}`,
      body: `${selectedIds.length} ทรัพยากร → ${tfDestination || 'ปลายทางไม่ระบุ'} · ${tfPriority}`,
    })
    setTfName(''); setTfCapability(''); setTfDest(''); setSelectedIds([])
    refresh()
  }, [drillId, tfName, tfCapability, tfDestination, tfPriority, selectedIds, fireEvent, refresh])

  const handleStatusUpdate = useCallback(async (a: DispatchAssignment, newStatus: string) => {
    if (!drillId) return
    setUpdatingId(a.id)
    const res = await updateAssignmentStatus(a.id, drillId, newStatus)
    setUpdatingId(null)
    if (!res.ok) return
    fireEvent({
      severity: 'info',
      title: newStatus === 'on_scene' ? 'TEAM_ON_SCENE' : 'STATUS_UPDATED',
      body: `${a.resource_code ?? a.assigned_to} → ${newStatus.replace('_', ' ')}`,
    })
    refresh()
  }, [drillId, fireEvent, refresh])

  if (!drillId) {
    return (
      <div className="content">
        <div style={{ display: 'grid', placeItems: 'center', height: 400, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center', gap: 8 }}>
          <Icon name="map" size={32} color="var(--text-4)" />
          <div>ยังไม่ได้เลือกเหตุการณ์ที่ใช้งาน</div>
          <div style={{ fontSize: 11 }}>เลือกเหตุการณ์จาก Active Context Bar ด้านบน</div>
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · COP + ส่งกำลัง</div>
          <h1>ภาพรวมสถานการณ์ · บอร์ดส่งกำลัง</h1>
          <div className="sub">เลือกทรัพยากร · สร้างชุดเฉพาะกิจ · ส่งพร้อมตรวจ Safety Gate</div>
        </div>
        <div className="actions">
          <span className="badge cyan">
            <span className="dot" />{assignments.filter(a => a.status !== 'released').length} active
          </span>
          <button className="btn ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={14} /> รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* COP Map + TF Builder */}
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <Panel
          title="แผนที่ COP · สด"
          actions={
            <span className="badge cyan">
              <span className="dot" />{sites.length} จุด · {copMarkers.filter(m => m.marker_type === 'team').length} ทีม
            </span>
          }
          flush
        >
          <COPMap data={copMapData} height={520} selected={selectedSite} onMarkerClick={setSelectedSite} />
        </Panel>

        <div className="col">
          <Panel
            title="สร้างชุดเฉพาะกิจ"
            actions={
              <button className="btn sm primary" onClick={handleDispatch} disabled={dispatching || selectedIds.length === 0}>
                <Icon name="arrow" size={12} /> {dispatching ? 'กำลังส่ง…' : 'ส่ง'}
              </button>
            }
          >
            <div className="grid" style={{ gap: 10 }}>
              <div className="field">
                <label>ชื่อชุดเฉพาะกิจ</label>
                <input className="input" placeholder="เช่น TF-Alpha" value={tfName} onChange={e => setTfName(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="field">
                  <label>ขีดความสามารถ</label>
                  <select className="select" value={tfCapability} onChange={e => setTfCapability(e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {capabilities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>ความเร่งด่วน</label>
                  <select className="select" value={tfPriority} onChange={e => setTfPriority(e.target.value as any)}>
                    {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>ปลายทาง</label>
                <select className="select" value={tfDestination} onChange={e => setTfDest(e.target.value)}>
                  <option value="">— เลือกปลายทาง —</option>
                  {destOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="field">
                <label>ทรัพยากรที่เลือก <span className="hint">{selectedIds.length}</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px dashed var(--border-strong)', minHeight: 60 }}>
                  {selectedIds.length === 0
                    ? <span style={{ color: 'var(--text-4)', fontSize: 11.5, alignSelf: 'center' }}>เลือกจากตารางด้านล่าง</span>
                    : selectedIds.map(id => {
                        const r = resources.find(x => x.id === id)
                        return (
                          <span key={id} className="chip active" style={{ cursor: 'default' }}>
                            {r?.code ?? id}
                            <button onClick={() => toggleResource(id)} style={{ background: 'transparent', border: 0, color: 'inherit', padding: 0, marginLeft: 2, display: 'flex', cursor: 'pointer' }}>
                              <Icon name="x" size={10} />
                            </button>
                          </span>
                        )
                      })
                  }
                </div>
              </div>

              {/* Safety gate status */}
              <div style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>ด่านความปลอดภัย</div>
                {gates.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--text-4)' }}>ยังไม่มีด่าน</span>
                  : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {gates.map(g => (
                        <SafetyGate key={g.id} status={g.status}
                          code={`${g.code} ${g.status === 'passed' ? '✓' : g.status === 'failed' ? '✗' : '?'}`} />
                      ))}
                    </div>
                }
                {gates.some(g => g.status === 'failed') && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8, display: 'flex', gap: 6 }}>
                    <Icon name="incident" size={12} />
                    <span>{gates.filter(g => g.status === 'failed').map(g => g.title).join(', ')} · ถูกบล็อก</span>
                  </div>
                )}
              </div>

              {dispatchErr && (
                <div style={{ fontSize: 11, color: 'var(--red)', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                  {dispatchErr}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Assignment Queue */}
      <Panel title="คิวการมอบหมาย" count={assignments.length} style={{ marginBottom: 12 }}>
        {assignments.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>ยังไม่มีการมอบหมาย</div>
          : (
            <table className="tbl">
              <thead>
                <tr><th>รหัส</th><th>ทรัพยากร</th><th>ปลายทาง</th><th>ความเร่งด่วน</th><th>สถานะ</th><th>เวลา</th><th></th></tr>
              </thead>
              <tbody>
                {assignments.map(a => {
                  const next = NEXT_STATUS[a.status]
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{a.resource_code ?? '—'}</td>
                      <td style={{ fontWeight: 500 }}>{a.resource_name ?? a.assigned_to}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{a.location ?? '—'}</td>
                      <td>
                        <span className={`badge ${a.priority === 'immediate' ? 'red' : a.priority === 'urgent' ? 'amber' : 'gray'}`}>
                          {a.priority === 'immediate' ? 'ฉุกเฉิน' : a.priority === 'urgent' ? 'เร่งด่วน' : 'ปกติ'}
                        </span>
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                        {new Date(a.assigned_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        {next && (
                          <button className={next.cls} disabled={updatingId === a.id}
                            onClick={() => handleStatusUpdate(a, next.value)}>
                            {updatingId === a.id ? '…' : next.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        }
      </Panel>

      {/* Resource Registry table */}
      <Panel
        title="ทะเบียนทรัพยากร"
        count={filteredResources.length}
        actions={
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', 'available', ...uniqueTypes].map(t => (
              <span key={t} className={'chip' + (filter === t ? ' active' : '')}
                onClick={() => setFilter(t)}
                style={{ textTransform: 'capitalize', fontSize: 11, cursor: 'pointer' }}>
                {t === 'all' ? 'ทั้งหมด' : t === 'available' ? 'ว่าง' : t}
              </span>
            ))}
          </div>
        }
        flush
      >
        {loading && resources.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>กำลังโหลด…</div>
          : (
            <table className="tbl">
              <thead>
                <tr><th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>ขีดความสามารถ</th><th>ความพร้อม</th><th>สถานะ</th><th>ที่ตั้ง</th><th></th></tr>
              </thead>
              <tbody>
                {filteredResources.map(r => {
                  const inTf = selectedIds.includes(r.id)
                  const busy = !!r.active_assignment_id
                  return (
                    <tr key={r.id} className={inTf ? 'selected' : ''} style={busy && !inTf ? { opacity: 0.55 } : undefined}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-2)' }}>{r.code}</td>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{r.type}</td>
                      <td style={{ fontSize: 12 }}>{r.capability ?? '—'}</td>
                      <td><ReadinessBar percent={r.readiness} /></td>
                      <td>
                        {busy
                          ? <StatusBadge status={r.assignment_status ?? 'assigned'} />
                          : <span className="badge green"><span className="dot" />ว่าง</span>
                        }
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.location_text ?? '—'}</td>
                      <td>
                        {inTf
                          ? <button className="btn sm ghost" onClick={() => toggleResource(r.id)}>นำออก</button>
                          : <button className="btn sm" disabled={busy} onClick={() => !busy && toggleResource(r.id)}><Icon name="plus" size={11} /> เพิ่ม</button>
                        }
                      </td>
                    </tr>
                  )
                })}
                {filteredResources.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '20px 0' }}>ไม่พบทรัพยากร</td></tr>
                )}
              </tbody>
            </table>
          )
        }
      </Panel>
    </div>
  )
}

function ReadinessBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0))
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>{pct}%</span>
    </div>
  )
}
