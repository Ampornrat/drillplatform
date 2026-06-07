'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icon'
import { Panel } from './shared'
import { useAppContextSafe } from '@/components/providers/app-context-provider'
import { useIapWorkspace } from '@/lib/iodp/use-iap-workspace'
import type { IapVersion, IapSection, IapGate } from '@/lib/iodp/use-iap-workspace'
import {
  createIapVersion, saveIapSection,
  submitForSafetyBrief, submitForApproval, approveIap, activateIap,
} from '@/actions/iap.actions'

type FireEvent = (e: { severity: string; title: string; body: string }) => void

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: 'ร่าง',            color: 'var(--text-3)' },
  safety_brief:     { label: 'Safety Brief',     color: 'var(--amber)' },
  pending_approval: { label: 'รอการอนุมัติ',     color: 'var(--blue)' },
  approved:         { label: 'อนุมัติแล้ว',      color: 'var(--green)' },
  active:           { label: 'ใช้งานอยู่',        color: 'var(--cyan)' },
  reviewed:         { label: 'ทบทวนแล้ว',        color: 'var(--text-3)' },
  superseded:       { label: 'เวอร์ชันเก่า',      color: 'var(--text-4)' },
}

const SECTION_CODES: Record<string, string> = {
  objectives: 'objectives',
  organization: 'organization',
  comms: 'communications',
  medical_plan: 'medical_plan',
  safety_plan: 'safety_plan',
  resources: 'assignment_of_resources',
}

const DEFAULT_CONTENT: Record<string, any> = {
  objectives:    { items: [] },
  organization:  { ic: '', deputy_ic: '', safety_officer: '', public_info: '', liaison: '', operations: '', logistics: '', planning: '', finance: '', medical_branch: '' },
  communications: { channels: [], primary_contact: '', ptt_group: '' },
  medical_plan:  { medical_officer: '', mass_casualty_plan: '', triage_officer: '', facilities: [], notes: '' },
  safety_plan:   { safety_officer: '', hazards: [], ppe_required: [], emergency_action: '', rally_point: '' },
  assignment_of_resources: { teams: [] },
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

// ─── Gate status dot ─────────────────────────────────────────────────────────
function GateDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    passed: 'var(--green)', failed: 'var(--red)', pending: 'var(--text-3)', waived: 'var(--amber)',
  }
  return <span style={{ width: 8, height: 8, borderRadius: 50, background: colors[status] ?? 'var(--text-4)', display: 'inline-block', flexShrink: 0 }} />
}

// ─── Objectives Tab ───────────────────────────────────────────────────────────
function ObjectivesTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const items: any[] = content.items ?? []
  const add = () => onChange({ ...content, items: [...items, { id: Date.now().toString(), code: `OBJ-${items.length + 1}`, title: '', body: '' }] })
  const remove = (id: string) => onChange({ ...content, items: items.filter((i: any) => i.id !== id) })
  const update = (id: string, field: string, val: string) =>
    onChange({ ...content, items: items.map((i: any) => i.id === id ? { ...i, [field]: val } : i) })

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((o: any) => (
        <div key={o.id} style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input className="input" placeholder="OBJ-1" value={o.code}
              onChange={e => update(o.id, 'code', e.target.value)}
              style={{ width: 72, fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase' }} />
            <input className="input" placeholder="หัวข้อวัตถุประสงค์" value={o.title}
              onChange={e => update(o.id, 'title', e.target.value)} style={{ flex: 1, fontWeight: 600 }} />
            <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => remove(o.id)}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <textarea className="textarea" rows={2} placeholder="รายละเอียด..." value={o.body}
            onChange={e => update(o.id, 'body', e.target.value)} />
        </div>
      ))}
      <button className="btn" style={{ width: 'max-content' }} onClick={add}>
        <Icon name="plus" size={12} /> เพิ่มวัตถุประสงค์
      </button>
    </div>
  )
}

// ─── Organization Tab ─────────────────────────────────────────────────────────
function OrganizationTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fields: [string, string][] = [
    ['ic', 'Incident Commander (IC)'], ['deputy_ic', 'รอง IC'], ['safety_officer', 'Safety Officer'],
    ['public_info', 'Public Information Officer'], ['liaison', 'Liaison Officer'],
    ['operations', 'Operations Section Chief'], ['logistics', 'Logistics Section Chief'],
    ['planning', 'Planning Section Chief'], ['finance', 'Finance/Admin Chief'], ['medical_branch', 'Medical Branch Director'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {fields.map(([key, label]) => (
        <div key={key} className="field">
          <label style={{ fontSize: 11 }}>{label}</label>
          <input className="input" value={content[key] ?? ''} onChange={e => onChange({ ...content, [key]: e.target.value })} />
        </div>
      ))}
    </div>
  )
}

// ─── Comms Tab ─────────────────────────────────────────────────────────────────
function CommsTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const channels: any[] = content.channels ?? []
  const add = () => onChange({ ...content, channels: [...channels, { id: Date.now().toString(), name: '', freq: '', purpose: '' }] })
  const remove = (id: string) => onChange({ ...content, channels: channels.filter((c: any) => c.id !== id) })
  const update = (id: string, f: string, v: string) =>
    onChange({ ...content, channels: channels.map((c: any) => c.id === id ? { ...c, [f]: v } : c) })

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field"><label>หมายเลขติดต่อหลัก</label><input className="input" value={content.primary_contact ?? ''} onChange={e => onChange({ ...content, primary_contact: e.target.value })} /></div>
        <div className="field"><label>PTT Group / Radio ID</label><input className="input" value={content.ptt_group ?? ''} onChange={e => onChange({ ...content, ptt_group: e.target.value })} /></div>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ชื่อช่องทาง', 'ความถี่ / ช่องทาง', 'วัตถุประสงค์', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((ch: any) => (
              <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 8px' }}><input className="input" value={ch.name} onChange={e => update(ch.id, 'name', e.target.value)} style={{ fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}><input className="input" value={ch.freq} onChange={e => update(ch.id, 'freq', e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}><input className="input" value={ch.purpose} onChange={e => update(ch.id, 'purpose', e.target.value)} style={{ fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" style={{ padding: '2px 6px' }} onClick={() => remove(ch.id)}><Icon name="x" size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" style={{ width: 'max-content' }} onClick={add}><Icon name="plus" size={12} /> เพิ่มช่องทาง</button>
    </div>
  )
}

// ─── Medical Plan Tab ──────────────────────────────────────────────────────────
function MedicalPlanTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const facilities: any[] = content.facilities ?? []
  const addFac = () => onChange({ ...content, facilities: [...facilities, { id: Date.now().toString(), name: '', role: 'Role 2', capacity: 0, status: 'available' }] })
  const removeFac = (id: string) => onChange({ ...content, facilities: facilities.filter((f: any) => f.id !== id) })
  const updateFac = (id: string, fld: string, val: any) =>
    onChange({ ...content, facilities: facilities.map((f: any) => f.id === id ? { ...f, [fld]: val } : f) })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="field"><label>Medical Officer</label><input className="input" value={content.medical_officer ?? ''} onChange={e => onChange({ ...content, medical_officer: e.target.value })} /></div>
        <div className="field"><label>Triage Officer</label><input className="input" value={content.triage_officer ?? ''} onChange={e => onChange({ ...content, triage_officer: e.target.value })} /></div>
        <div className="field"><label>Mass Casualty Plan</label><input className="input" value={content.mass_casualty_plan ?? ''} onChange={e => onChange({ ...content, mass_casualty_plan: e.target.value })} /></div>
      </div>
      <div className="field">
        <label>หมายเหตุ / Medical Intent</label>
        <textarea className="textarea" rows={2} value={content.notes ?? ''} onChange={e => onChange({ ...content, notes: e.target.value })} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>สถานพยาบาล</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['ชื่อ', 'Role', 'ความจุ', 'สถานะ', ''].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {facilities.map((f: any) => (
              <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 8px' }}><input className="input" value={f.name} onChange={e => updateFac(f.id, 'name', e.target.value)} style={{ fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}><input className="input" value={f.role} onChange={e => updateFac(f.id, 'role', e.target.value)} style={{ fontSize: 12, width: 80 }} /></td>
                <td style={{ padding: '4px 8px' }}><input className="input" type="number" min={0} value={f.capacity} onChange={e => updateFac(f.id, 'capacity', +e.target.value)} style={{ fontSize: 12, width: 72, fontFamily: 'var(--font-mono)' }} /></td>
                <td style={{ padding: '4px 8px' }}>
                  <select className="input" value={f.status} onChange={e => updateFac(f.id, 'status', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
                    {['available','surge','critical','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" style={{ padding: '2px 6px' }} onClick={() => removeFac(f.id)}><Icon name="x" size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn" style={{ marginTop: 8, width: 'max-content' }} onClick={addFac}><Icon name="plus" size={12} /> เพิ่มสถานพยาบาล</button>
      </div>
    </div>
  )
}

// ─── Safety Plan Tab ───────────────────────────────────────────────────────────
function SafetyPlanTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const hazards: any[] = content.hazards ?? []
  const ppe: string[] = content.ppe_required ?? []
  const ppeOptions = ['หมวกนิรภัย', 'เสื้อชูชีพ', 'ถุงมือ', 'รองเท้านิรภัย', 'หน้ากาก N95', 'ชุด PPE Level C']
  const add = () => onChange({ ...content, hazards: [...hazards, { id: Date.now().toString(), item: '', risk: 'medium', control: '' }] })
  const remove = (id: string) => onChange({ ...content, hazards: hazards.filter((h: any) => h.id !== id) })
  const update = (id: string, f: string, v: string) =>
    onChange({ ...content, hazards: hazards.map((h: any) => h.id === id ? { ...h, [f]: v } : h) })
  const togglePpe = (p: string) =>
    onChange({ ...content, ppe_required: ppe.includes(p) ? ppe.filter(x => x !== p) : [...ppe, p] })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field"><label>Safety Officer</label><input className="input" value={content.safety_officer ?? ''} onChange={e => onChange({ ...content, safety_officer: e.target.value })} /></div>
        <div className="field"><label>Rally Point</label><input className="input" value={content.rally_point ?? ''} onChange={e => onChange({ ...content, rally_point: e.target.value })} /></div>
      </div>
      <div className="field">
        <label>Emergency Action Plan</label>
        <textarea className="textarea" rows={2} value={content.emergency_action ?? ''} onChange={e => onChange({ ...content, emergency_action: e.target.value })} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>PPE ที่จำเป็น</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ppeOptions.map(p => (
            <span key={p} className={'chip' + (ppe.includes(p) ? ' active' : '')} onClick={() => togglePpe(p)}>
              {ppe.includes(p) && <Icon name="check" size={11} />}{p}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>อันตราย / มาตรการควบคุม</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['อันตราย', 'ความเสี่ยง', 'มาตรการควบคุม', ''].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {hazards.map((h: any) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 8px' }}><input className="input" value={h.item} onChange={e => update(h.id, 'item', e.target.value)} style={{ fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}>
                  <select className="input" value={h.risk} onChange={e => update(h.id, 'risk', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
                    {['low','medium','high','critical'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 8px' }}><input className="input" value={h.control} onChange={e => update(h.id, 'control', e.target.value)} style={{ fontSize: 12 }} /></td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" style={{ padding: '2px 6px' }} onClick={() => remove(h.id)}><Icon name="x" size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn" style={{ marginTop: 8, width: 'max-content' }} onClick={add}><Icon name="plus" size={12} /> เพิ่มอันตราย</button>
      </div>
    </div>
  )
}

// ─── Resources Tab ─────────────────────────────────────────────────────────────
function ResourcesTab({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const teams: any[] = content.teams ?? []
  const add = () => onChange({ ...content, teams: [...teams, { id: Date.now().toString(), name: '', leader: '', assignment: '', status: 'assigned' }] })
  const remove = (id: string) => onChange({ ...content, teams: teams.filter((t: any) => t.id !== id) })
  const update = (id: string, f: string, v: string) =>
    onChange({ ...content, teams: teams.map((t: any) => t.id === id ? { ...t, [f]: v } : t) })

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
          {['ทีม / ทรัพยากร', 'ผู้นำ', 'ภารกิจ', 'สถานะ', ''].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {teams.map((t: any) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 8px' }}><input className="input" value={t.name} onChange={e => update(t.id, 'name', e.target.value)} style={{ fontSize: 12 }} /></td>
              <td style={{ padding: '4px 8px' }}><input className="input" value={t.leader} onChange={e => update(t.id, 'leader', e.target.value)} style={{ fontSize: 12 }} /></td>
              <td style={{ padding: '4px 8px' }}><input className="input" value={t.assignment} onChange={e => update(t.id, 'assignment', e.target.value)} style={{ fontSize: 12 }} /></td>
              <td style={{ padding: '4px 8px' }}>
                <select className="input" value={t.status} onChange={e => update(t.id, 'status', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
                  {['assigned','en_route','on_scene','available','released'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={{ padding: '4px 8px' }}><button className="btn ghost" style={{ padding: '2px 6px' }} onClick={() => remove(t.id)}><Icon name="x" size={11} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" style={{ width: 'max-content' }} onClick={add}><Icon name="plus" size={12} /> เพิ่มทีม</button>
    </div>
  )
}

// ─── Approval Tab ──────────────────────────────────────────────────────────────
function ApprovalTab({
  version, gates, userMap, drillId, role, submitting, onWorkflow,
}: {
  version: IapVersion; gates: IapGate[]; userMap: Record<string, string>
  drillId: string; role: string; submitting: boolean; onWorkflow: (action: string) => void
}) {
  const [comments, setComments] = useState('')
  const criticalGates = gates.filter(g => g.status === 'failed')
  const pendingGates = gates.filter(g => g.status === 'pending')
  const s = version.status

  const canSubmitSafetyBrief = s === 'draft'
  const canSubmitApproval = s === 'safety_brief'
  const canApprove = s === 'pending_approval' && ['admin', 'commander'].includes(role)
  const canActivate = s === 'approved' && ['admin', 'commander'].includes(role)

  const trail = [
    version.created_by   && { who: userMap[version.created_by]   ?? '—', action: 'ร่างแผน',         time: version.created_at },
    version.submitted_by && { who: userMap[version.submitted_by] ?? '—', action: 'ส่ง Safety Brief', time: version.submitted_at },
    version.reviewed_by  && { who: userMap[version.reviewed_by]  ?? '—', action: 'ทบทวน',            time: version.reviewed_at },
    version.approved_by  && { who: userMap[version.approved_by]  ?? '—', action: 'อนุมัติ',          time: version.approved_at },
  ].filter(Boolean) as { who: string; action: string; time: string | null }[]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {criticalGates.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--red)' }}>
          <strong>⚠ Safety Gate Critical:</strong> {criticalGates.map(g => g.title).join(', ')} — ตรวจสอบก่อนอนุมัติ
        </div>
      )}
      {pendingGates.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--amber)' }}>
          <strong>⚠ Safety Gate Pending:</strong> {pendingGates.map(g => g.title).join(', ')}
        </div>
      )}

      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>ด่านความปลอดภัย</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {gates.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <GateDot status={g.status} />
              <span style={{ flex: 1, fontSize: 12 }}>{g.title}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>{g.status}</span>
            </div>
          ))}
          {gates.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>ไม่มีด่านความปลอดภัย</div>}
        </div>
      </div>

      {(canApprove || canActivate) && (
        <div className="field">
          <label>ความเห็น</label>
          <textarea className="textarea" rows={2} value={comments} onChange={e => setComments(e.target.value)} placeholder="ความเห็นผู้อนุมัติ (ถ้ามี)" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canSubmitSafetyBrief && (
          <button className="btn" disabled={submitting} onClick={() => onWorkflow('safety_brief')}>
            <Icon name="arrow" size={13} /> ส่ง Safety Brief
          </button>
        )}
        {canSubmitApproval && (
          <button className="btn" disabled={submitting} onClick={() => onWorkflow('pending_approval')}>
            <Icon name="arrow" size={13} /> ส่งขออนุมัติ
          </button>
        )}
        {canApprove && (
          <button className="btn primary" disabled={submitting} onClick={() => onWorkflow('approved')}>
            <Icon name="check" size={13} /> อนุมัติ
          </button>
        )}
        {canActivate && (
          <button className="btn primary" disabled={submitting} onClick={() => onWorkflow('active')}>
            <Icon name="check" size={13} /> เปิดใช้งาน IAP
          </button>
        )}
      </div>

      {trail.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>ประวัติการอนุมัติ</div>
          {trail.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', width: 130, flexShrink: 0 }}>{fmtTime(item.time)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500 }}>{item.who}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 4 }}>· {item.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main IAPWorkspace ─────────────────────────────────────────────────────────
export function IAPWorkspace({ fireEvent }: { fireEvent: FireEvent }) {
  const router = useRouter()
  const appCtx = useAppContextSafe()
  const drillId = appCtx?.activeIncidentId ?? null
  const role = appCtx?.role ?? 'guest'

  const { versions, currentVersion, sections, gates, userMap, loading, error, selectVersion, refresh } =
    useIapWorkspace(drillId)

  const tabs: [string, string][] = [
    ['objectives', 'วัตถุประสงค์'], ['organization', 'โครงสร้างองค์กร'],
    ['comms', 'การสื่อสาร'], ['medical_plan', 'แผนการแพทย์'],
    ['safety_plan', 'แผนความปลอดภัย'], ['resources', 'ทรัพยากร'], ['approval', 'การอนุมัติ'],
  ]
  const [activeTab, setActiveTab] = useState('objectives')

  // Per-section draft state
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set())
  const [savingTab, setSavingTab] = useState<string | null>(null)
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Sync section drafts from backend (only for non-dirty tabs)
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev }
      for (const tabId of Object.keys(SECTION_CODES)) {
        if (dirtyTabs.has(tabId)) continue
        const code = SECTION_CODES[tabId]
        next[tabId] = sections[code]?.content ?? DEFAULT_CONTENT[code] ?? {}
      }
      return next
    })
  }, [sections]) // eslint-disable-line

  const setTabContent = useCallback((tabId: string, updater: (prev: any) => any) => {
    setDrafts(prev => ({ ...prev, [tabId]: updater(prev[tabId] ?? {}) }))
    setDirtyTabs(prev => new Set(prev).add(tabId))
  }, [])

  const saveTab = useCallback(async (tabId: string) => {
    if (!currentVersion || !drillId) return
    const sectionCode = SECTION_CODES[tabId]
    if (!sectionCode) return
    setSavingTab(tabId)
    setActionError(null)
    const result = await saveIapSection(currentVersion.id, drillId, sectionCode, drafts[tabId] ?? {})
    if (result.ok) {
      setDirtyTabs(prev => { const next = new Set(prev); next.delete(tabId); return next })
      fireEvent({ severity: 'info', title: 'IAP_SECTION_UPDATED', body: `Section ${sectionCode} saved` })
    } else {
      setActionError(result.message)
    }
    setSavingTab(null)
  }, [currentVersion, drillId, drafts, fireEvent])

  const handleCreateVersion = async () => {
    if (!drillId) return
    setCreatingVersion(true); setActionError(null)
    const result = await createIapVersion(drillId)
    if (result.ok) {
      fireEvent({ severity: 'info', title: 'IAP_CREATED', body: `IAP v${result.data.version} สร้างแล้ว` })
      refresh()
    } else {
      setActionError(result.message)
    }
    setCreatingVersion(false)
  }

  const handleWorkflow = useCallback(async (action: string) => {
    if (!currentVersion || !drillId) return
    setWorkflowBusy(true); setActionError(null)
    let result
    if (action === 'safety_brief') result = await submitForSafetyBrief(currentVersion.id, drillId)
    else if (action === 'pending_approval') result = await submitForApproval(currentVersion.id, drillId)
    else if (action === 'approved') result = await approveIap(currentVersion.id, drillId)
    else if (action === 'active') result = await activateIap(currentVersion.id, drillId)
    else result = { ok: false, code: 'validation_error' as const, message: 'Unknown action' }

    if (result.ok) {
      const labels: Record<string, string> = { safety_brief: 'Safety Brief', pending_approval: 'ส่งขออนุมัติ', approved: 'อนุมัติ', active: 'เปิดใช้งาน' }
      fireEvent({ severity: action === 'active' ? 'info' : 'info', title: `IAP_${action.toUpperCase()}`, body: labels[action] ?? action })
      router.refresh()
      refresh()
    } else {
      setActionError(result.message)
    }
    setWorkflowBusy(false)
  }, [currentVersion, drillId, fireEvent, router, refresh])

  // ── Empty state: no incident selected ──
  if (!drillId) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="plan" size={40} color="var(--text-4)" />
          <div style={{ marginTop: 12, fontSize: 14 }}>เลือก Incident ก่อนเข้า IAP Workspace</div>
        </div>
      </div>
    )
  }

  // ── Loading ──
  if (loading && versions.length === 0) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="refresh" size={24} color="var(--text-4)" />
          <div style={{ marginTop: 8, fontSize: 13 }}>กำลังโหลด IAP...</div>
        </div>
      </div>
    )
  }

  // ── No versions yet ──
  if (!loading && versions.length === 0) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="plan" size={40} color="var(--text-4)" />
          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-2)' }}>ยังไม่มีแผน IAP สำหรับ Incident นี้</div>
          <button className="btn primary" style={{ marginTop: 16 }} onClick={handleCreateVersion} disabled={creatingVersion}>
            {creatingVersion ? 'กำลังสร้าง...' : <><Icon name="plus" size={13} /> สร้าง IAP v1</>}
          </button>
        </div>
      </div>
    )
  }

  const sv = currentVersion ? STATUS_LABELS[currentVersion.status] ?? { label: currentVersion.status, color: 'var(--text-3)' } : null

  return (
    <div className="content">
      {/* ── Page Header ── */}
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · แผน IAP</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0 }}>
              แผนปฏิบัติการเหตุ (IAP) · v{currentVersion?.version ?? '—'}
            </h1>
            {sv && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: sv.color, background: `${sv.color}22`, padding: '3px 8px', borderRadius: 4, border: `1px solid ${sv.color}44`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {sv.label}
              </span>
            )}
          </div>
          {versions.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {versions.map(v => (
                <button key={v.id}
                  onClick={() => selectVersion(v.id)}
                  className={'chip' + (v.id === currentVersion?.id ? ' active' : '')}
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  v{v.version}
                  {v.status === 'active' && <span style={{ marginLeft: 4, color: 'var(--cyan)' }}>●</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="actions">
          {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
          {actionError && <span style={{ color: 'var(--red)', fontSize: 12 }}>{actionError}</span>}
          <button className="btn ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={14} />
          </button>
          <button className="btn" onClick={handleCreateVersion} disabled={creatingVersion || loading}>
            {creatingVersion ? 'กำลังสร้าง...' : <><Icon name="plus" size={14} /> เวอร์ชันใหม่</>}
          </button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 12 }}>
        {/* Left: Tab Panel */}
        <div className="panel">
          <div className="tabs">
            {tabs.map(([x, lbl]) => (
              <button key={x} className={'tab' + (activeTab === x ? ' active' : '')} onClick={() => setActiveTab(x)}>
                {lbl}
                {dirtyTabs.has(x) && <span style={{ marginLeft: 4, width: 6, height: 6, borderRadius: 50, background: 'var(--amber)', display: 'inline-block', verticalAlign: 'middle' }} />}
              </button>
            ))}
          </div>
          <div className="panel-body">
            {activeTab !== 'approval' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
                {dirtyTabs.has(activeTab) && (
                  <button className="btn ghost" style={{ fontSize: 12 }}
                    onClick={() => { setDrafts(prev => ({ ...prev, [activeTab]: sections[SECTION_CODES[activeTab]]?.content ?? DEFAULT_CONTENT[SECTION_CODES[activeTab]] ?? {} })); setDirtyTabs(prev => { const n = new Set(prev); n.delete(activeTab); return n }) }}>
                    รีเซ็ต
                  </button>
                )}
                <button className="btn primary" style={{ fontSize: 12 }}
                  disabled={savingTab === activeTab || !currentVersion}
                  onClick={() => saveTab(activeTab)}>
                  {savingTab === activeTab ? 'กำลังบันทึก...' : <><Icon name="check" size={12} /> บันทึก</>}
                </button>
              </div>
            )}

            {activeTab === 'objectives' && (
              <ObjectivesTab content={drafts.objectives ?? DEFAULT_CONTENT.objectives}
                onChange={c => setTabContent('objectives', () => c)} />
            )}
            {activeTab === 'organization' && (
              <OrganizationTab content={drafts.organization ?? DEFAULT_CONTENT.organization}
                onChange={c => setTabContent('organization', () => c)} />
            )}
            {activeTab === 'comms' && (
              <CommsTab content={drafts.comms ?? DEFAULT_CONTENT.communications}
                onChange={c => setTabContent('comms', () => c)} />
            )}
            {activeTab === 'medical_plan' && (
              <MedicalPlanTab content={drafts.medical_plan ?? DEFAULT_CONTENT.medical_plan}
                onChange={c => setTabContent('medical_plan', () => c)} />
            )}
            {activeTab === 'safety_plan' && (
              <SafetyPlanTab content={drafts.safety_plan ?? DEFAULT_CONTENT.safety_plan}
                onChange={c => setTabContent('safety_plan', () => c)} />
            )}
            {activeTab === 'resources' && (
              <ResourcesTab content={drafts.resources ?? DEFAULT_CONTENT.assignment_of_resources}
                onChange={c => setTabContent('resources', () => c)} />
            )}
            {activeTab === 'approval' && currentVersion && (
              <ApprovalTab version={currentVersion} gates={gates} userMap={userMap}
                drillId={drillId} role={role} submitting={workflowBusy}
                onWorkflow={handleWorkflow} />
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="col">
          <Panel title="วงจร IAP">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                ['draft',            'ร่าง'],
                ['safety_brief',     'Brief ความปลอดภัย'],
                ['pending_approval', 'รอการอนุมัติ'],
                ['approved',         'อนุมัติแล้ว'],
                ['active',           'ใช้งานอยู่'],
                ['reviewed',         'ทบทวนแล้ว'],
              ] as [string, string][]).map(([key, label]) => {
                const isCurrent = currentVersion?.status === key
                const order = ['draft','safety_brief','pending_approval','approved','active','reviewed']
                const curIdx = order.indexOf(currentVersion?.status ?? 'draft')
                const idx = order.indexOf(key)
                const done = idx < curIdx || isCurrent
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 50, flexShrink: 0, background: isCurrent ? STATUS_LABELS[key]?.color : done ? 'var(--green)' : 'var(--bg-3)', boxShadow: isCurrent ? `0 0 8px ${STATUS_LABELS[key]?.color}` : 'none' }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: isCurrent ? 600 : 500, color: done ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="ประวัติ IAP">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {versions.map(v => {
                const st = STATUS_LABELS[v.status] ?? { label: v.status, color: 'var(--text-3)' }
                return (
                  <div key={v.id}
                    onClick={() => selectVersion(v.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius)', border: `1px solid ${v.id === currentVersion?.id ? 'var(--border-focus)' : 'var(--border)'}`, background: v.id === currentVersion?.id ? 'var(--bg-2)' : 'transparent', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-1)', minWidth: 28 }}>v{v.version}</span>
                    <span style={{ flex: 1, fontSize: 11, color: st.color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{st.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{new Date(v.created_at).toLocaleDateString('th-TH')}</span>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="ข้อมูล Incident">
            <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-3)' }}>ห้วงปฏิบัติการ</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {currentVersion?.period_start ? new Date(currentVersion.period_start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  {' → '}
                  {currentVersion?.period_end ? new Date(currentVersion.period_end).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
              {currentVersion?.notes && (
                <div style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>{currentVersion.notes}</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
