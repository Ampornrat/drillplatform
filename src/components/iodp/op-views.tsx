'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icon';
import { StatusBadge, Triage, SafetyGate, Metric, Panel, EventRow, KV } from './shared';
import { COPMap } from './cop-map';
import { useAppContextSafe } from '@/components/providers/app-context-provider';
import { useOpDashboard } from '@/lib/iodp/use-op-dashboard';
import type {
  OpSummary, OpGate, OpResource, OpFacility, PatientCounts, CopMarker, IapInfo, SessionInfo,
} from '@/lib/iodp/use-op-dashboard';
import { methaneSchema } from '@/lib/validators/methane';
import { createIncidentFromMethane } from '@/actions/incidents.actions';
import { setActiveIncidentAction } from '@/actions/context.actions';

type Data = any;
type FireEvent = (e: { severity: string; title: string; body: string }) => void;

// ─── Metric computation ───────────────────────────────────────────────────────

function buildMetrics(
  summary: OpSummary,
  patients: PatientCounts,
  gates: OpGate[],
  resources: OpResource[],
  facilities: OpFacility[],
  copMarkers: CopMarker[],
  iap: IapInfo | null,
  session: SessionInfo | null,
) {
  const critGates = gates.filter(g => g.status === 'failed').length
  const overloadFacilities = facilities.filter(f => f.status !== 'normal' || f.load_pct > 80)
  const enRoute = resources.filter(r => r.status === 'en_route').length
  const responseLevel = session?.meta?.response_level ?? 'ไม่ระบุ'

  // COP completeness from markers
  const totalMarkers = copMarkers.length
  const activeMarkers = copMarkers.filter(m => m.status === 'active').length
  const copPct = totalMarkers > 0 ? Math.round((activeMarkers / totalMarkers) * 100) : 0

  return [
    {
      label: 'ผู้ป่วยที่ปฏิบัติการ',
      value: patients.total,
      unit: 'ราย',
      footer: `P1 ${patients.p1} · P2 ${patients.p2} · P3 ${patients.p3} · ⬛ ${patients.black}`,
      tone: patients.p1 > 0 ? 'critical' : patients.total > 0 ? 'warn' : '',
    },
    {
      label: 'P1 วิกฤต',
      value: patients.p1,
      unit: 'ราย',
      footer: `P2 ${patients.p2} · P3 ${patients.p3}`,
      tone: patients.p1 > 0 ? 'critical' : 'ok',
    },
    {
      label: 'ทีมที่ส่ง',
      value: summary.active_resources,
      unit: '',
      footer: enRoute > 0 ? `${enRoute} กำลังเดินทาง` : 'ไม่มีระหว่างเดินทาง',
      tone: '',
    },
    {
      label: 'ด่านความปลอดภัย',
      value: critGates > 0 ? critGates : summary.gates_passed,
      unit: critGates > 0 ? 'วิกฤต' : 'ผ่าน',
      footer: `ผ่าน ${summary.gates_passed} / ${summary.gates_blocking_total} ด่าน`,
      tone: critGates > 0 ? 'critical' : 'ok',
    },
    {
      label: 'รพ. โหลดสูง / เบี่ยง',
      value: overloadFacilities.length,
      unit: 'แห่ง',
      footer: overloadFacilities.length > 0
        ? overloadFacilities.map(f => f.site_name).slice(0, 2).join(' · ')
        : 'ทุก รพ. พร้อมรับ',
      tone: overloadFacilities.length > 0 ? 'warn' : 'ok',
    },
    {
      label: 'ความครบถ้วน COP',
      value: totalMarkers > 0 ? copPct : summary.participant_count > 0 ? Math.round((summary.participant_count / 100) * 100) : 0,
      unit: '%',
      footer: totalMarkers > 0 ? `${activeMarkers}/${totalMarkers} จุด · ${responseLevel}` : `IAP ${iap ? `v${iap.version}` : '—'} · ${responseLevel}`,
      tone: 'ok',
    },
  ]
}

// ─── State components ─────────────────────────────────────────────────────────

function EmptyIncidentState({ setView }: { setView: (v: string) => void }) {
  return (
    <div className="content">
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <Icon name="map" size={52} color="var(--text-4)" />
          <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>ยังไม่ได้เลือกเหตุการณ์</h2>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>
            เลือกเหตุการณ์ที่ใช้งานอยู่จากแถบบริบทด้านบน<br />เพื่อดูภาพรวมสั่งการแบบสดพร้อม Realtime
          </p>
          <button className="btn primary" style={{ marginTop: 20 }} onClick={() => setView('methane')}>
            <Icon name="plus" size={14} /> เปิดเหตุใหม่ (METHANE)
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="content">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 64, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 82, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.5 }} />
          ))}
        </div>
        <div style={{ height: 48, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div style={{ height: 440, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 200, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.5 }} />
            <div style={{ height: 220, background: 'var(--bg-2)', borderRadius: 'var(--radius)', opacity: 0.5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="content">
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <Icon name="incident" size={48} color="var(--red)" />
          <h2 style={{ marginTop: 16, fontSize: 18, fontWeight: 600 }}>โหลดข้อมูลล้มเหลว</h2>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)' }}>{message}</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={onRetry}>
            <Icon name="refresh" size={13} /> ลองอีกครั้ง
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Operational Status Strip ──────────────────────────────────────────────────

function OpStatusStrip({ summary, session, iap }: { summary: OpSummary; session: SessionInfo | null; iap: IapInfo | null }) {
  const responseLevel = session?.meta?.response_level ?? 'ไม่ระบุ'
  const commandMode   = session?.meta?.command_mode ?? 'UNIFIED'
  const opPeriod      = session?.op_period ?? '—'

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const iapLabel = iap
    ? `v${iap.version} · ${iap.approved ? 'อนุมัติแล้ว' : 'ร่าง'}`
    : 'ยังไม่มี IAP'

  const iapTone = iap?.approved ? 'var(--green)' : iap ? 'var(--amber)' : 'var(--text-3)'

  const statusTone: Record<string, string> = {
    active: 'var(--cyan)', paused: 'var(--amber)', planned: 'var(--text-3)', completed: 'var(--green)',
  }
  const statusLabel: Record<string, string> = {
    active: 'ดำเนินการ', paused: 'หยุดชั่วคราว', planned: 'วางแผน', completed: 'เสร็จสิ้น',
  }

  const col = (label: string, value: React.ReactNode, tone?: string) => (
    <div style={{ borderRight: '1px solid var(--border)', paddingRight: 14, paddingLeft: 14 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: tone ?? 'var(--text-1)' }}>{value}</div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12,
      background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      padding: '8px 0', overflow: 'hidden',
    }}>
      {col('สถานะ', statusLabel[summary.status] ?? summary.status, statusTone[summary.status] ?? 'var(--text-1)')}
      {col('ระดับตอบสนอง', responseLevel, 'var(--amber)')}
      {col('รูปแบบสั่งการ', commandMode)}
      {col('เวอร์ชัน IAP', iapLabel, iapTone)}
      {col('ห้วงปฏิบัติ', opPeriod)}
      {iap?.period_start && col('ห้วงเริ่ม', fmtDate(iap.period_start))}
      {iap?.period_end   && col('ห้วงสิ้นสุด', fmtDate(iap.period_end))}
      <div style={{ flex: 1, paddingLeft: 14 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 3 }}>หน่วยนำ</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{summary.organization_name ?? '—'}</div>
      </div>
    </div>
  )
}

// ─── Main OPDashboard ─────────────────────────────────────────────────────────

export function OPDashboard({
  data,
  setView,
  onEvent,
}: {
  data: Data;
  setView: (v: string) => void;
  onEvent?: FireEvent;
}) {
  const appCtx = useAppContextSafe()
  const activeIncidentId = appCtx?.activeIncidentId ?? null

  const {
    summary, session, iap, patientCounts, copMarkers,
    events, gates, resources, facilities, notifications,
    loading, error, refresh,
  } = useOpDashboard(activeIncidentId, onEvent)

  // Merge real COP markers into data for the map
  const copMapData = useMemo(() => {
    if (copMarkers.length === 0) return data
    const sites = copMarkers
      .filter(m => m.marker_type === 'site' || m.marker_type === 'team')
      .map(m => ({ id: m.code, lat: m.lat, lng: m.lng, type: m.sub_type || m.marker_type, status: m.status, name: m.name }))
    const patient_markers = copMarkers
      .filter(m => m.marker_type === 'patient' && m.lat != null && m.lng != null)
      .map(m => ({ lat: m.lat!, lng: m.lng!, lvl: m.triage_level ?? 'P3' }))
    return { ...data, sites, patient_markers }
  }, [copMarkers, data])

  const metrics = useMemo(
    () => summary
      ? buildMetrics(summary, patientCounts, gates, resources, facilities, copMarkers, iap, session)
      : data.metrics_op,
    [summary, patientCounts, gates, resources, facilities, copMarkers, iap, session, data.metrics_op],
  )

  const displayGates  = gates.length > 0  ? gates  : data.safety_gates
  const displayEvents = events.length > 0 ? events : data.events

  // ICP panel data — real if available, else IODP demo data
  const responseLevel = session?.meta?.response_level ?? data.incident.response_level
  const commandMode   = session?.meta?.command_mode   ?? data.incident.command_mode
  const leadOrg       = summary?.organization_name    ?? data.incident.lead_org
  const opPeriod      = session?.op_period             ?? data.incident.op_period
  const iapLabel      = iap ? `v${iap.version}` : data.incident.iap_version
  const iapStatus     = iap ? (iap.approved ? 'อนุมัติแล้ว' : 'ร่าง') : 'อนุมัติแล้ว'

  if (!activeIncidentId) return <EmptyIncidentState setView={setView} />
  if (loading && !summary) return <LoadingSkeleton />
  if (error && !summary) return <ErrorState message={error} onRetry={refresh} />

  return (
    <div className="content">
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · ภาพรวมสั่งการ</div>
          <h1>ภาพรวมสถานการณ์ร่วม (COP)</h1>
          <div className="sub">
            <span className="badge cyan" style={{ marginRight: 6 }}><span className="dot" />สด</span>
            {summary?.title ?? data.incident.title_th}
            {summary?.organization_name ? ` · ${summary.organization_name}` : ''}
            {summary?.location ? ` · ${summary.location}` : ''}
          </div>
        </div>
        <div className="actions">
          <button className="btn sm ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={12} />{loading ? ' กำลังโหลด…' : ' รีเฟรช'}
          </button>
          <button className="btn" onClick={() => setView('methane')}>
            <Icon name="plus" size={14} /> เปิดเหตุใหม่ (METHANE)
          </button>
          <button className="btn primary" onClick={() => setView('cop')}>
            <Icon name="map" size={14} /> เปิดแผนที่ COP
          </button>
        </div>
      </div>

      {/* 6 metric cards covering all 12 spec fields */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
        {metrics.map((m: any, i: number) => <Metric key={i} {...m} />)}
      </div>

      {/* Operational status strip: response_level, IAP, command_mode, op_period */}
      {summary && <OpStatusStrip summary={summary} session={session} iap={iap} />}

      {/* Notification banner for unread critical notifications */}
      {notifications.filter(n => n.type === 'critical').map(n => (
        <div key={n.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
          background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)',
          borderRadius: 'var(--radius)', marginBottom: 8, fontSize: 12.5,
        }}>
          <Icon name="incident" size={14} color="var(--red)" />
          <span style={{ fontWeight: 600, color: 'var(--red)' }}>{n.title}</span>
          {n.body && <span style={{ color: 'var(--text-2)' }}>{n.body}</span>}
        </div>
      ))}

      {/* Main grid: COP map + right panel */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 12 }}>
        <Panel
          title={`ภาพรวมสถานการณ์${summary?.location ? ` — ${summary.location}` : ''}`}
          actions={
            <>
              <button className="btn sm ghost"><Icon name="filter" size={12} /> ชั้นข้อมูล</button>
              {copMarkers.length > 0 && (
                <span className="badge cyan" style={{ fontSize: 10.5 }}>
                  <span className="dot" />{copMarkers.length} จุดสด
                </span>
              )}
              <button className="btn sm ghost" onClick={refresh}><Icon name="refresh" size={12} /></button>
            </>
          }
          flush
        >
          <COPMap data={copMapData} height={420} />
        </Panel>
        <div className="col">
          {/* ICP / Unified Command panel */}
          <Panel title="ศูนย์สั่งการเหตุ (ICP)" actions={<button className="btn sm ghost">แก้ไข</button>}>
            <KV pairs={[
              ['รูปแบบศูนย์สั่งการ', <StatusBadge key="cmd" status="active" label={commandMode} />],
              ['หน่วยนำ', leadOrg],
              ['ห้วงปฏิบัติ', opPeriod],
              ['เวอร์ชัน IAP',
                <span key="iap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge ${iap?.approved ? 'cyan' : 'amber'}`}>{iapLabel}</span>
                  {iapStatus}
                  {iap?.approved_at ? ` · ${new Date(iap.approved_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
              ],
              ['ระดับการตอบสนอง', <span key="lvl" className="badge amber"><span className="dot" />{responseLevel}</span>],
              ['เริ่มเหตุ', data.incident.started],
            ]} />
          </Panel>

          {/* Safety gates */}
          <Panel
            title="ด่านความปลอดภัย"
            count={displayGates.length}
            actions={<button className="btn sm ghost">จัดการ</button>}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              {displayGates.map((g: any) => (
                <div key={g.code ?? g.id} className="between"
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{g.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{g.title}</div>
                  </div>
                  <SafetyGate status={g.status} code={g.status.toUpperCase()} />
                </div>
              ))}
              {displayGates.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                  ยังไม่มีด่านความปลอดภัย
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom grid: event log + dispatch */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel
          title="บันทึกเหตุการณ์ระบบ"
          count={displayEvents.length}
          actions={
            <>
              <button className="btn sm ghost"><Icon name="filter" size={12} /> กรอง</button>
              <button className="btn sm ghost"><Icon name="download" size={12} /></button>
            </>
          }
        >
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {displayEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
                ยังไม่มีเหตุการณ์
              </div>
            ) : (
              displayEvents.map((e: any, i: number) => <EventRow key={e.id ?? i} {...e} />)
            )}
          </div>
        </Panel>

        <Panel
          title="การส่งกำลังที่ดำเนินอยู่"
          count={resources.length > 0 ? resources.length : data.teams.filter((t: any) => t.status !== 'available').length}
        >
          {resources.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr><th>รหัส</th><th>ทรัพยากร</th><th>ปลายทาง</th><th>สถานะ</th><th>เวลา</th></tr>
              </thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                      {r.resource_code ?? '—'}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{r.resource_name ?? '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{r.resource_type ?? ''}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.location ?? r.assigned_to ?? '—'}</td>
                    <td>
                      <StatusBadge
                        status={r.priority === 'immediate' ? 'critical' : r.priority === 'urgent' ? 'warning' : r.status}
                        label={r.status.replace('_', ' ')}
                      />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>
                      {r.duration_minutes > 0 ? `${r.duration_minutes}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead><tr><th>ทรัพยากร</th><th>สถานะ</th><th>ปลายทาง</th></tr></thead>
              <tbody>
                {data.teams.filter((t: any) => t.status !== 'available').slice(0, 7).map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, background: 'var(--bg-3)', borderRadius: 4, display: 'grid', placeItems: 'center' }}>
                          <Icon name={t.type === 'drone' ? 'drone' : t.type === 'boat' ? 'boat' : t.type === 'helicopter' ? 'helicopter' : t.type === 'truck' ? 'truck' : t.type === 'safety' ? 'shield' : 'user'} size={12} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{t.code}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>{t.org}</div>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge status={t.status} label={t.status.replace('_', ' ')} /></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{t.site}</td>
                  </tr>
                ))}
                {data.teams.filter((t: any) => t.status !== 'available').length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: '16px 0' }}>
                      ไม่มีการส่งกำลังที่ดำเนินอยู่
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function MethaneIntake({ data, setView, fireEvent }: { data: Data; setView: (v: string) => void; fireEvent: FireEvent }) {
  const router = useRouter();
  const appCtx = useAppContextSafe();

  const [form, setForm] = useState({
    major_incident: false,
    incident_type: '',
    exact_location: '',
    mechanism: '',
    hazards: [] as string[],
    access: '',
    casualties: { p1: 0, p2: 0, p3: 0, black: 0, unknown: 0 },
    services: [] as string[],
    lead_org: appCtx?.organizationName ?? '',
    initial_command_mode: 'unified' as 'unified' | 'single' | 'joint',
    safety_gates: { zone: 'pending' as const, route: 'pending' as const, security: 'pending' as const, hospital: 'pending' as const, authority: 'pending' as const },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gateWarning, setGateWarning] = useState(false);
  const [createdDrillId, setCreatedDrillId] = useState<string | null>(null);

  const hazardOptions = ['น้ำท่วม', 'กระแสน้ำ', 'สารอันตราย', 'ไฟฟ้า', 'โครงสร้างไม่มั่นคง', 'ฝูงชน'];
  const serviceOptions = ['พยาบาลระดับสูง', 'USAR', 'เรือกู้ภัย', 'HEMS', 'ตำรวจ', 'EOD'];
  const commandModes: Array<['unified' | 'single' | 'joint', string]> = [['unified', 'Unified Command'], ['single', 'Single Command'], ['joint', 'Joint Command']];

  const setHazard = (h: string) => setForm(f => ({ ...f, hazards: f.hazards.includes(h) ? f.hazards.filter(x => x !== h) : [...f.hazards, h] }));
  const setService = (s: string) => setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }));

  const goToDashboard = useCallback(() => {
    router.refresh();
    setView('dashboard');
  }, [router, setView]);

  const submit = async () => {
    setErrors({});
    setSubmitError(null);

    const parseResult = methaneSchema.safeParse({
      major_incident: form.major_incident,
      incident_type: form.incident_type,
      exact_location: form.exact_location,
      mechanism: form.mechanism,
      hazards: form.hazards,
      access: form.access,
      casualties: form.casualties,
      emergency_services: form.services,
      lead_org: form.lead_org,
      initial_command_mode: form.initial_command_mode,
      safety_gates: form.safety_gates,
      organization_id: appCtx?.organizationId ?? undefined,
    });

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const key = issue.path.join('.');
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createIncidentFromMethane(parseResult.data);
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }

      await setActiveIncidentAction(result.data.drill_id);
      setCreatedDrillId(result.data.drill_id);

      fireEvent({
        severity: result.data.safety_gate_critical ? 'critical' : 'info',
        title: 'INCIDENT_CREATED',
        body: `เปิดเหตุแล้ว · ${form.incident_type} · IAP v1 ร่าง`,
      });

      if (result.data.safety_gate_critical) {
        setGateWarning(true);
      } else {
        goToDashboard();
      }
    } catch (e: any) {
      setSubmitError(e?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  if (gateWarning) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--red)', borderRadius: 'var(--radius-lg)', padding: 32, maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', marginBottom: 8 }}>SAFETY GATE — CRITICAL</div>
          <div style={{ color: 'var(--text-1)', fontSize: 15, marginBottom: 8 }}>Incident สร้างแล้ว แต่มีด่านความปลอดภัยที่ต้องแก้ไขก่อนปฏิบัติการ</div>
          <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 24 }}>ตรวจสอบ Safety Gate ในหน้า Dashboard ทันที</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={goToDashboard}>ไปที่ Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · รับแจ้งเหตุ</div>
          <h1>แบบรายงาน METHANE</h1>
          <div className="sub">กรอกให้ครบทุกหัวข้อ → ระบบสร้าง Incident + Safety Gates + IAP อัตโนมัติ</div>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setView('dashboard')} disabled={submitting}>ยกเลิก</button>
          <button className="btn primary" onClick={submit} disabled={submitting}>
            {submitting ? <><Icon name="refresh" size={14}/> กำลังส่ง...</> : <><Icon name="arrow" size={14}/> ส่งรายงาน METHANE</>}
          </button>
        </div>
      </div>
      {submitError && (
        <div style={{ background: 'var(--red-dim, rgba(239,68,68,0.1))', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, color: 'var(--red)', fontSize: 13 }}>
          {submitError}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        <Panel title="M · E · T · H · A · N · E — รายงาน">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: form.major_incident ? 'var(--red-dim, rgba(239,68,68,0.12))' : 'var(--bg-2)', border: `1px solid ${form.major_incident ? 'var(--red)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer' }}
              onClick={() => setForm(f => ({ ...f, major_incident: !f.major_incident }))}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${form.major_incident ? 'var(--red)' : 'var(--border)'}`, background: form.major_incident ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {form.major_incident && <Icon name="check" size={11} color="#fff"/>}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>M · Major Incident Declaration</div>
                <div style={{ fontSize: 13, color: form.major_incident ? 'var(--red)' : 'var(--text-2)' }}>{form.major_incident ? '⚠ ประกาศเหตุการณ์ใหญ่ — MAJOR INCIDENT DECLARED' : 'ยังไม่ประกาศ Major Incident'}</div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>E · สถานที่เกิดเหตุ (Exact Location) {errors['exact_location'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['exact_location']}</span>}</label>
                <input className="input" placeholder="เช่น ซอยสุขุมวิท 22 เขตคลองเตย กทม." value={form.exact_location} onChange={e => setForm(f => ({ ...f, exact_location: e.target.value }))} style={errors['exact_location'] ? { borderColor: 'var(--red)' } : undefined}/>
              </div>
              <div className="field">
                <label>T · ประเภทเหตุ (Type) {errors['incident_type'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['incident_type']}</span>}</label>
                <input className="input" placeholder="เช่น น้ำท่วม, อัคคีภัย, อุบัติเหตุหมู่" value={form.incident_type} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))} style={errors['incident_type'] ? { borderColor: 'var(--red)' } : undefined}/>
              </div>
            </div>
            <div className="field">
              <label>M · กลไก / ลักษณะเหตุ (Mechanism) {errors['mechanism'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['mechanism']}</span>}</label>
              <input className="input" value={form.mechanism} onChange={e => setForm(f => ({ ...f, mechanism: e.target.value }))} style={errors['mechanism'] ? { borderColor: 'var(--red)' } : undefined}/>
            </div>
            <div className="field">
              <label>H · อันตราย (Hazards) <span className="hint">เลือกได้หลายข้อ</span> {errors['hazards'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['hazards']}</span>}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {hazardOptions.map(h => (
                  <span key={h} className={'chip' + (form.hazards.includes(h) ? ' active' : '')} onClick={() => setHazard(h)}>
                    {form.hazards.includes(h) && <Icon name="check" size={11}/>}{h}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>A · การเข้าถึง (Access) <span className="hint">เส้นทาง ข้อจำกัด จุดนัดพบ</span></label>
              <textarea className="textarea" value={form.access} onChange={e => setForm(f => ({ ...f, access: e.target.value }))}/>
            </div>
            <div className="field">
              <label>N · จำนวนผู้ประสบภัย (Casualties)</label>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {(['p1', 'p2', 'p3', 'black'] as const).map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <Triage level={k.toUpperCase()}/>
                    <input type="number" min={0} value={form.casualties[k]} onChange={e => setForm(f => ({ ...f, casualties: { ...f.casualties, [k]: Math.max(0, +e.target.value) } }))}
                      style={{ flex: 1, background: 'transparent', border: 0, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, outline: 'none' }}/>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>UNK</span>
                  <input type="number" min={0} value={form.casualties.unknown} onChange={e => setForm(f => ({ ...f, casualties: { ...f.casualties, unknown: Math.max(0, +e.target.value) } }))}
                    style={{ flex: 1, background: 'transparent', border: 0, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, outline: 'none' }}/>
                </div>
              </div>
            </div>
            <div className="field">
              <label>E · หน่วยงานที่ต้องการ (Emergency Services) {errors['emergency_services'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['emergency_services']}</span>}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {serviceOptions.map(s => (
                  <span key={s} className={'chip' + (form.services.includes(s) ? ' active' : '')} onClick={() => setService(s)}>
                    {form.services.includes(s) && <Icon name="check" size={11}/>}{s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <div className="col">
          <Panel title="ตรวจด่านความปลอดภัยล่วงหน้า" count={5}>
            <SafetyGatePrecheck form={form} setForm={setForm}/>
          </Panel>
          <Panel title="หน่วยนำ · รูปแบบการบังคับบัญชา">
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="field">
                <label>หน่วยนำ (Lead Organization) {errors['lead_org'] && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{errors['lead_org']}</span>}</label>
                <input className="input" placeholder="เช่น พบ.ราชองค์เสนา มพ." value={form.lead_org} onChange={e => setForm(f => ({ ...f, lead_org: e.target.value }))} style={errors['lead_org'] ? { borderColor: 'var(--red)' } : undefined}/>
              </div>
              <div className="field">
                <label>รูปแบบการบังคับบัญชา</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {commandModes.map(([val, label]) => (
                    <button key={val} className={'chip' + (form.initial_command_mode === val ? ' active' : '')}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                      onClick={() => setForm(f => ({ ...f, initial_command_mode: val }))}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="การดำเนินการอัตโนมัติเมื่อส่ง">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
              {['สร้าง Incident', 'เริ่มห้วงปฏิบัติ', 'สร้างร่าง IAP v1.0', 'เปิดสถานะ Safety Gate · 5 ด่าน', 'แจ้งเตือน Commander, Medical, Logistics'].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="check" size={12} color="var(--green)"/>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SafetyGatePrecheck({ form, setForm }: { form: any; setForm: any }) {
  const gates = [
    { key: 'zone', title: 'เขต Hot / Warm / Cold', opts: [['hot', 'critical'], ['warm', 'warning'], ['cold', 'passed']] },
    { key: 'route', title: 'เส้นทาง / สะพาน / น้ำ', opts: [['pending', 'pending'], ['partial', 'warning'], ['passed', 'passed']] },
    { key: 'security', title: 'ความมั่นคง / ฝูงชน', opts: [['passed', 'passed'], ['pending', 'pending'], ['failed', 'critical']] },
    { key: 'hospital', title: 'ขีดความสามารถ รพ.', opts: [['passed', 'passed'], ['pending', 'pending'], ['critical', 'critical']] },
    { key: 'authority', title: 'อนุมัติ / หน่วยนำ', opts: [['passed', 'passed'], ['pending', 'pending']] },
  ] as const;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {gates.map(g => {
        const current = (form.safety_gates as any)[g.key];
        return (
          <div key={g.key}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{g.title}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {g.opts.map(([val]) => (
                <button key={val} className={'chip' + (current === val ? ' active' : '')}
                  onClick={() => setForm((f: any) => ({ ...f, safety_gates: { ...f.safety_gates, [g.key]: val } }))}
                  style={{ flex: 1, justifyContent: 'center', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.06em' }}>
                  {val}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { CopDispatch } from './cop-dispatch';

export function FacilityCoord({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  const [facilities, setFacilities] = useState(data.facilities);

  const setStatus = (id: string, status: string) => {
    setFacilities((fs: any[]) => fs.map((f: any) => f.id === id ? { ...f, status } : f));
    const name = data.facilities.find((f: any) => f.id === id)?.name;
    fireEvent({ severity: status === 'divert' ? 'warning' : 'info', title: status === 'divert' ? 'FACILITY_DIVERSION' : 'สถานะโรงพยาบาลเปลี่ยน', body: `${name} → ${({ accept: 'รับได้', divert: 'เบี่ยง', call: 'คอลเอ้าท์' } as any)[status] || status}` });
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · โรงพยาบาลและการขนส่ง</div>
          <h1>ประสานงานเตียงและการขนส่งผู้ป่วย</h1>
          <div className="sub">Role 1 / 2 / 3 / CoE · P1→R3+ · P2→R2 · P3→CCP · อัปเดตสถานะแบบ Realtime</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="hospital" size={14}/> ส่งต่อระหว่าง รพ.</button>
          <button className="btn primary"><Icon name="helicopter" size={14}/> ขอการขนส่ง</button>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
        {facilities.map((f: any) => <FacilityCard key={f.id} facility={f} onSetStatus={setStatus}/>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Panel title="จับคู่ผู้ป่วย → โรงพยาบาล" count={data.patient_markers.length} actions={<button className="btn sm ghost">จัดเส้นทางอัตโนมัติ</button>}>
          {data.patient_markers.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              ยังไม่มีผู้ป่วยที่ต้องจัดสรร
            </div>
          ) : (
            <table className="tbl">
              <thead><tr><th>ผู้ป่วย</th><th>คัดแยก</th><th>สถานะ</th></tr></thead>
              <tbody>
                {data.patient_markers.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{p.patient_code ?? p.id}</td>
                    <td><Triage level={(p.lvl ?? p.triage_level ?? 'P3').toUpperCase()}/></td>
                    <td><StatusBadge status={p.status} label={p.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="โหมดการขนส่ง">
          <div style={{ display: 'grid', gap: 8 }}>
            {data.teams
              .filter((t: any) => ['en_route', 'on_scene', 'available'].includes(t.status))
              .slice(0, 6)
              .map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--bg-1)', borderRadius: 6, display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
                  <Icon name={t.type === 'medical' ? 'truck' : t.type === 'water' ? 'boat' : t.type === 'air' ? 'helicopter' : 'truck'} size={18} color="var(--cyan)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.code}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.personnel ?? 0} คน · {t.org}</div>
                </div>
                <StatusBadge status={t.status} label={t.status === 'active' ? 'พร้อม' : 'รอคิว'}/>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FacilityCard({ facility: f, onSetStatus }: { facility: any; onSetStatus: (id: string, s: string) => void }) {
  const bedsPct = Math.round(((f.beds_total - f.beds) / f.beds_total) * 100);
  const icuPct = Math.round(((f.icu_total - f.icu) / f.icu_total) * 100);
  const isDivert = f.status === 'divert';
  const isCall = f.status === 'call';
  return (
    <div className="panel" style={{ border: isDivert ? '1px solid var(--amber)' : isCall ? '1px solid var(--red)' : '1px solid var(--border)' }}>
      <div className="panel-head">
        <h3><span className="badge gray">{f.role}</span>{f.name}</h3>
        <StatusBadge status={f.status} label={f.status.toUpperCase()}/>
      </div>
      <div className="panel-body">
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{f.name_th} · ขาเข้า {f.inbound} ราย</div>
        <ResourceRow label="เตียง" cap={f.beds} total={f.beds_total} tone={bedsPct > 80 ? 'critical' : bedsPct > 60 ? 'warn' : 'ok'}/>
        <ResourceRow label="ICU" cap={f.icu} total={f.icu_total} tone={icuPct > 90 ? 'critical' : icuPct > 70 ? 'warn' : 'ok'}/>
        <ResourceRow label="ห้องผ่าตัด" cap={f.or} total={f.or_total} tone="ok"/>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 11 }}>
          <span className={`badge ${f.blood === 'critical' ? 'red' : f.blood === 'low' ? 'amber' : 'green'}`}><span className="dot"/>เลือด {f.blood === 'critical' ? 'วิกฤต' : f.blood === 'low' ? 'ต่ำ' : 'พร้อม'}</span>
          <span className={`badge ${f.oxygen === 'low' ? 'amber' : 'green'}`}><span className="dot"/>O₂ {f.oxygen === 'low' ? 'ต่ำ' : 'พร้อม'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 10 }}>
          {[['accept', 'รับ'], ['divert', 'เบี่ยง'], ['call', 'คอลเอ้าท์']].map(([s, l]) => (
            <button key={s} className={'chip' + (f.status === s ? ' active' : '')} onClick={() => onSetStatus(f.id, s)}
              style={{ justifyContent: 'center', fontSize: 11, padding: '6px 0' }}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ label, cap, total, tone }: { label: string; cap: number; total: number; tone: string }) {
  const pct = Math.round((cap / total) * 100);
  const c = tone === 'critical' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : 'var(--green)';
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="between" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
        <span style={{ color: 'var(--text-3)' }}>{label}</span>
        <span><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{cap}</span>/{total}</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
        <div style={{ height: '100%', width: `${100 - pct}%`, background: c }}/>
      </div>
    </div>
  );
}

export function IAPStub({ data }: { data: Data }) {
  const [t, setT] = useState('objectives');
  const tabs = [['objectives','วัตถุประสงค์'],['organization','โครงสร้าง'],['comms','การสื่อสาร'],['medical_plan','แผนการแพทย์'],['safety_plan','ความปลอดภัย'],['resources','ทรัพยากร'],['approval','การอนุมัติ']];
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · แผน IAP</div>
          <h1>แผนปฏิบัติการเหตุ (IAP) · v2.1</h1>
          <div className="sub">{data.incident.code} · {data.incident.op_period} · อนุมัติ T+03:58</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="refresh" size={14}/> เวอร์ชันใหม่</button>
          <button className="btn primary"><Icon name="check" size={14}/> ส่งขออนุมัติ</button>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 12 }}>
        <div className="panel">
          <div className="tabs">
            {tabs.map(([x, lbl]) => <button key={x} className={'tab' + (t === x ? ' active' : '')} onClick={() => setT(x)}>{lbl}</button>)}
          </div>
          <div className="panel-body">
            {t === 'objectives' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { code: 'OBJ-1', title: 'ปลอดภัยชีวิต', body: 'คัดแยกและอพยพผู้ป่วย P1 ทั้งหมดไปยัง Role 3+ ภายใน 60 นาที' },
                  { code: 'OBJ-2', title: 'ขยายเหตุอยู่ในวงจำกัด', body: 'รักษาเส้นทางเข้าผ่านเรือพยาบาล ขณะสะพานสิรินธรปิด' },
                  { code: 'OBJ-3', title: 'บริหารขีดความสามารถ รพ.', body: 'เบี่ยง P1 ไปรามาธิบดี/จุฬาฯ ขณะศิริราช (Role 2) อยู่ในสถานะ divert' },
                  { code: 'OBJ-4', title: 'การจัดการข้อมูล', body: 'ส่ง SITREP ไปยัง EOC กรุงเทพฯ ทุก 30 นาที · เป้าหมาย COP 95%' },
                ].map(o => (
                  <div key={o.code} style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="badge cyan">{o.code}</span>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{o.title}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{o.body}</div>
                  </div>
                ))}
              </div>
            )}
            {t !== 'objectives' && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
                <Icon name="plan" size={36} color="var(--text-4)"/>
                <div style={{ marginTop: 10, fontSize: 13 }}>ส่วน {tabs.find(x => x[0] === t)?.[1]}</div>
              </div>
            )}
          </div>
        </div>
        <div className="col">
          <Panel title="วงจร IAP">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['ร่าง (Draft)','T+03:30',true,false],['Brief ความปลอดภัย','T+03:45',true,false],['อนุมัติ','T+03:58',true,true],['ส่งกำลังรอบ 3','T+04:15',false,false],['ทบทวน','T+05:00',false,false]].map(([p,t,done,active], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? 'var(--cyan)' : done ? 'var(--green)' : 'var(--bg-3)', boxShadow: active ? '0 0 8px var(--cyan)' : 'none', display: 'block' }}/>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: active ? 600 : 500, color: done ? 'var(--text-1)' : 'var(--text-3)' }}>{p as string}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{t as string}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function DrillStub({ data }: { data: Data }) {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดฝึก · ภาพรวมโปรแกรม</div>
          <h1>โปรแกรมการฝึก · ปี 2569</h1>
          <div className="sub">โจทย์ที่ดำเนินอยู่หลายรูปแบบ — ตั้งต้น, โต๊ะเรียน, ฝึกเฉพาะหน้าที่, เต็มรูปแบบ และผสมผสาน</div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
        {data.metrics_drill.map((m: any, i: number) => <Metric key={i} {...m}/>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Panel title="วงจรการฝึก">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['กำหนดวัตถุประสงค์',true,false],['ขอบเขต',true,false],['ออกแบบโจทย์',true,false],['ควบคุมและปฏิบัติ',true,true],['ประเมินผล',false,false],['AAR / LMS',false,false]].map(([p,done,active],i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: active ? 'var(--magenta)' : done ? 'var(--green-bg)' : 'var(--bg-3)', border: done ? '0' : '1px dashed var(--border-strong)', display: 'grid', placeItems: 'center', boxShadow: active ? '0 0 8px var(--magenta)' : 'none' }}>
                  {done && <Icon name="check" size={11} color={active ? 'white' : 'var(--green)'}/>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? 'var(--text-1)' : done ? 'var(--text-2)' : 'var(--text-3)' }}>{p as string}</div>
                {active && <span className="badge magenta" style={{ marginLeft: 'auto' }}><span className="dot"/>เดี๋ยวนี้</span>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="สถานะ · การฝึกสด">
          <KV pairs={[
            ['รหัส', <span key="c" style={{ fontFamily: 'var(--font-mono)' }}>{data.drill.code}</span>],
            ['ประเภท', <span key="t" className="badge magenta">เต็มรูปแบบ ผสมผสาน</span>],
            ['เวลาฝึก', <span key="e" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>T+01:35:00</span>],
            ['ทีมที่พร้อม', `${data.teams.length} / 20`],
            ['ผู้ประสบภัย', '162 / 240'],
            ['ผู้ควบคุม', `${data.controllers.length} คนมอบหมายแล้ว`],
            ['ผู้ประเมิน', `${data.evaluators.length} คน ออนไลน์`],
          ]}/>
        </Panel>
        <Panel title="ประเภทการฝึก · รอบ 2569">
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { type: 'ปฐมนิเทศ (Orientation)', count: 12, color: 'var(--green)' },
              { type: 'โต๊ะเรียน (Tabletop)', count: 8, color: 'var(--cyan)' },
              { type: 'เฉพาะหน้าที่ (Functional)', count: 4, color: 'var(--blue)' },
              { type: 'เต็มรูปแบบ (Full-scale)', count: 2, color: 'var(--amber)' },
              { type: 'ผสมผสาน (Hybrid)', count: 1, color: 'var(--magenta)', active: true },
            ].map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: d.active ? `1px solid ${d.color}` : '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, background: d.color, borderRadius: '50%', display: 'block' }}/>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: d.active ? 600 : 500 }}>{d.type}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: d.color, fontWeight: 600 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
