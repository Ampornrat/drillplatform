'use client';
import React, { useState, useEffect } from 'react';
import { DEMO_DATA } from '@/lib/iodp/demo-data';
import { useIodpData } from '@/lib/iodp/use-iodp';
import { Icon } from './icon';
import { Metric, Panel, KV } from './shared';
import { OPDashboard, MethaneIntake, CopDispatch, FacilityCoord } from './op-views';
import { ControlRoom, EvaluationDashboard, AARLoop, Registry } from './drill-views';
import { FieldMobile } from './field-view';
import { SessionManager } from './session-manager';
import { IAPWorkspace } from './iap-workspace';

type Data = typeof DEMO_DATA;

const ROLES: Record<string, { color: string; initials: string; name: string; desc: string; th: string }> = {
  Commander: { color: 'var(--blue)', initials: 'SP', name: 'พ.อ. สุริยะ พ.', desc: 'ผู้บัญชาการเหตุ', th: 'ผู้บัญชาการ' },
  Medical: { color: 'var(--green)', initials: 'WC', name: 'ร.ท. วัสนา จ.', desc: 'หน่วยแพทย์', th: 'แพทย์' },
  Logistics: { color: 'var(--amber)', initials: 'BK', name: 'ร.อ. บุญ ก.', desc: 'หน่วยส่งกำลัง', th: 'Logistics' },
  Controller: { color: 'var(--magenta)', initials: 'PS', name: 'พ.ต. ปรียา ส.', desc: 'ผู้ควบคุมการฝึก', th: 'ผู้ควบคุม' },
  Evaluator: { color: 'var(--cyan)', initials: 'SM', name: 'นพ. สุชาติ ม.', desc: 'ผู้ประเมินแพทย์', th: 'ผู้ประเมิน' },
  Field: { color: 'var(--green)', initials: 'WA', name: 'ส.อ. วศิน อ.', desc: 'ทีมภาคสนาม', th: 'ภาคสนาม' },
  Admin: { color: 'var(--text-2)', initials: 'AN', name: 'อนันต์ ว.', desc: 'ผู้ดูแลระบบ', th: 'ผู้ดูแลระบบ' },
};

type MenuItem = { id: string; icon: string; label: string; en: string; count?: string | number; countTone?: string };
type RoleMenuEntry = { op: MenuItem[]; drill: MenuItem[] };

const ROLE_MENU: Record<string, RoleMenuEntry> = {
  Commander: {
    op: [
      { id: 'dashboard', icon: 'dashboard', label: 'ภาพรวมสั่งการ', en: 'Command' },
      { id: 'cop', icon: 'map', label: 'แผนที่ COP', en: 'COP Map' },
      { id: 'iap', icon: 'plan', label: 'แผน IAP', en: 'IAP Workspace', count: 'v2.1' },
      { id: 'facility', icon: 'hospital', label: 'โรงพยาบาล', en: 'Facility', count: 2, countTone: 'warning' },
      { id: 'registry', icon: 'registry', label: 'ทะเบียนกลาง', en: 'Registry' },
      { id: 'aar', icon: 'aar', label: 'AAR', en: 'AAR' },
    ],
    drill: [
      { id: 'control', icon: 'control', label: 'ห้องควบคุมการฝึก', en: 'Control Room' },
      { id: 'evaluation', icon: 'eval', label: 'ประเมินผล', en: 'Evaluation' },
      { id: 'aar', icon: 'aar', label: 'AAR / LMS', en: 'AAR / LMS' },
    ],
  },
  Medical: {
    op: [
      { id: 'dashboard', icon: 'dashboard', label: 'ผู้ป่วย', en: 'Patients' },
      { id: 'facility', icon: 'hospital', label: 'รพ. และขนส่ง', en: 'Facility & Transport' },
      { id: 'field', icon: 'field', label: 'ฟอร์มภาคสนาม', en: 'Field Forms' },
    ],
    drill: [
      { id: 'control', icon: 'control', label: 'สถานะการฝึก', en: 'Drill Status' },
      { id: 'field', icon: 'field', label: 'ฟอร์มภาคสนาม', en: 'Field Forms' },
    ],
  },
  Logistics: {
    op: [
      { id: 'dashboard', icon: 'dashboard', label: 'ทรัพยากร', en: 'Resources' },
      { id: 'cop', icon: 'map', label: 'ส่งกำลัง', en: 'Dispatch' },
      { id: 'facility', icon: 'hospital', label: 'โหลด รพ.', en: 'Facility Load' },
    ],
    drill: [
      { id: 'control', icon: 'control', label: 'สถานะทรัพยากร', en: 'Resource State' },
    ],
  },
  Controller: {
    drill: [
      { id: 'control', icon: 'control', label: 'ห้องควบคุมการฝึก', en: 'Control Room' },
      { id: 'evaluation', icon: 'eval', label: 'ประเมินผล', en: 'Evaluation' },
      { id: 'registry', icon: 'registry', label: 'คลังโจทย์', en: 'Scenario Library' },
      { id: 'aar', icon: 'aar', label: 'AAR / LMS', en: 'AAR / LMS' },
    ],
    op: [
      { id: 'dashboard', icon: 'dashboard', label: 'ภาพรวมปฏิบัติการ', en: 'OP Overview' },
    ],
  },
  Evaluator: {
    drill: [
      { id: 'evaluation', icon: 'eval', label: 'ประเมินผล', en: 'Evaluation' },
      { id: 'control', icon: 'control', label: 'เหตุการณ์สด', en: 'Live Feed' },
      { id: 'aar', icon: 'aar', label: 'AAR', en: 'AAR' },
    ],
    op: [
      { id: 'dashboard', icon: 'dashboard', label: 'เหตุการณ์ฟีด', en: 'Incident Feed' },
      { id: 'aar', icon: 'aar', label: 'AAR', en: 'AAR' },
    ],
  },
  Field: {
    op: [{ id: 'field', icon: 'field', label: 'ภาคสนาม (Mobile)', en: 'Field Mobile' }],
    drill: [{ id: 'field', icon: 'field', label: 'ภาคสนาม (Mobile)', en: 'Field Mobile' }],
  },
  Admin: {
    op: [
      { id: 'sessions', icon: 'scenario', label: 'จัดการสถานการณ์', en: 'Session Manager' },
      { id: 'registry', icon: 'registry', label: 'ทะเบียนกลาง', en: 'Master Registry' },
      { id: 'dashboard', icon: 'dashboard', label: 'สถานะระบบ', en: 'Platform Status' },
    ],
    drill: [
      { id: 'sessions', icon: 'scenario', label: 'จัดการสถานการณ์', en: 'Session Manager' },
      { id: 'registry', icon: 'registry', label: 'คลังโจทย์', en: 'Scenario Bank' },
    ],
  },
};

interface Toast { id: string; severity?: string; title: string; body: string; time: string; }

const nowTime = () => 'T+' + new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

export function IodpApp() {
  const [role, setRole] = useState('Commander');
  const [mode, setMode] = useState<'op' | 'drill'>('op');
  const [view, setView] = useState('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, loading, writeEvent, updateGate, pushInject } = useIodpData(mode);

  const roleInfo = ROLES[role];
  const menu = (ROLE_MENU[role]?.[mode as 'op' | 'drill']) || [];

  useEffect(() => {
    const list = (ROLE_MENU[role]?.[mode as 'op' | 'drill']) || [];
    if (!list.find(m => m.id === view)) setView(list[0]?.id || 'dashboard');
  }, [role, mode]);

  const fireEvent = (e: Omit<Toast, 'id' | 'time'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, ...e, time: nowTime() }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 6000);
    // persist to Supabase
    writeEvent({
      event_code: e.title.split('·')[0].trim().replace(/\s+/g, '_').toUpperCase(),
      severity: (e.severity ?? 'info') as 'info' | 'warning' | 'critical' | 'drill',
      actor: role,
      target: e.title,
      description: e.body,
    });
  };

  const simulateEvent = (kind: string) => {
    const map: Record<string, Omit<Toast, 'id' | 'time'>> = {
      inject: { severity: 'drill', title: 'INJECT_PUSHED · P1 Surge', body: 'ผู้ป่วยใหม่ 12 ราย → SITE-B · เปิดระบบ Surge' },
      divert: { severity: 'warning', title: 'FACILITY_DIVERSION', body: 'ศิริราช (Role 2) ICU 100% · เบี่ยง P1 ไป Role 3' },
      gate: { severity: 'critical', title: 'SAFETY_GATE_VIOLATION', body: 'MED-BRAVO เข้า HOT_ZONE โดยยังไม่ผ่าน EOD_GATE' },
      check: { severity: 'info', title: 'TEAM_CHECK_IN', body: 'BOAT-02 ถึงที่เกิดเหตุ SITE-B · สถานะ: กำลังเดินทาง' },
    };
    if (map[kind]) fireEvent(map[kind]);
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg-1)', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--cyan)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'iodp-pulse-anim 0.8s linear infinite' }} />
          กำลังโหลดข้อมูลจาก Supabase…
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-mode={mode}>
      <Sidebar role={role} roleInfo={roleInfo} mode={mode} view={view} setView={setView}
        setMode={setMode} menu={menu} data={data} onSettings={() => setPanelOpen(v => !v)} />
      <div className="main">
        <TopBar mode={mode} data={data} role={role} roleInfo={roleInfo} view={view} />
        <ToastStack toasts={toasts} />
        {view === 'dashboard' && mode === 'op' && <OPDashboard data={data} setView={setView} onEvent={fireEvent} />}
        {view === 'dashboard' && mode === 'drill' && <DrillStub data={data} />}
        {view === 'methane' && <MethaneIntake data={data} setView={setView} fireEvent={fireEvent} />}
        {view === 'cop' && <CopDispatch data={data} fireEvent={fireEvent} />}
        {view === 'iap' && <IAPWorkspace fireEvent={fireEvent} />}
        {view === 'facility' && <FacilityCoord data={data} fireEvent={fireEvent} />}
        {view === 'control' && <ControlRoom data={data} fireEvent={fireEvent} onPushInject={pushInject} onUpdateGate={updateGate} />}
        {view === 'evaluation' && <EvaluationDashboard data={data} fireEvent={fireEvent} />}
        {view === 'field' && <FieldMobile data={data} fireEvent={fireEvent} />}
        {view === 'aar' && <AARLoop data={data} fireEvent={fireEvent} />}
        {view === 'registry' && <Registry data={data} />}
        {view === 'sessions' && <SessionManager fireEvent={fireEvent} />}
      </div>

      {/* Floating control panel */}
      <div style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      }}>
        {panelOpen && (
          <div style={{
            background: 'rgba(250, 249, 247, 0.92)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)', borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            padding: '14px 16px', width: 260, display: 'flex', flexDirection: 'column', gap: 14,
            fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', paddingBottom: 6, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>มุมมอง</div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>บทบาท (Role)</div>
              <select value={role} onChange={e => setRole(e.target.value)} style={{
                width: '100%', padding: '7px 10px', borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.15)', background: 'white', fontSize: 12,
              }}>
                {Object.keys(ROLES).map(r => <option key={r} value={r}>{ROLES[r].th} — {r}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>โหมด</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['op', 'drill'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '8px 0', borderRadius: 8,
                    border: mode === m ? '1px solid var(--cyan)' : '1px solid rgba(0,0,0,0.12)',
                    background: mode === m ? 'rgba(8,145,178,0.08)' : 'white',
                    color: mode === m ? 'var(--cyan)' : 'rgba(0,0,0,0.6)',
                    fontWeight: mode === m ? 700 : 500, fontSize: 12, cursor: 'pointer',
                  }}>{m === 'op' ? 'ปฏิบัติ' : 'ฝึก'}</button>
                ))}
              </div>
            </div>
            <div style={{ paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: 10 }}>จำลองเหตุการณ์สด</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {[
                  { k: 'inject', label: '⚡ ส่ง Inject ลงสนาม', primary: true },
                  { k: 'divert', label: '🏥 รพ. เบี่ยงผู้ป่วย' },
                  { k: 'gate', label: '⛔ ละเมิด Safety Gate', primary: true },
                  { k: 'check', label: '📍 ทีม Check-in' },
                ].map(btn => (
                  <button key={btn.k} onClick={() => simulateEvent(btn.k)} style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 11.5,
                    background: btn.primary ? 'rgba(8,145,178,0.08)' : 'rgba(0,0,0,0.04)',
                    border: btn.primary ? '1px solid rgba(8,145,178,0.2)' : '1px solid rgba(0,0,0,0.08)',
                    color: btn.primary ? 'var(--cyan)' : 'rgba(0,0,0,0.65)', fontWeight: 600,
                  }}>{btn.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setPanelOpen(v => !v)} style={{
          width: 40, height: 40, borderRadius: 12, border: 0,
          background: panelOpen ? 'var(--cyan)' : 'rgba(15,23,42,0.85)',
          color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <Icon name="settings" size={18} color="white" />
        </button>
      </div>
    </div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────── */
function Sidebar({ role, roleInfo, mode, view, setView, setMode, menu, data, onSettings }: {
  role: string; roleInfo: typeof ROLES[string]; mode: string; view: string;
  setView: (v: string) => void; setMode: (m: 'op' | 'drill') => void;
  menu: MenuItem[]; data: Data; onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div>
          <div className="name">IODP</div>
          <div className="sub">Operation + Drill</div>
        </div>
      </div>

      <div className="mode-toggle">
        <button className={'op' + (mode === 'op' ? ' active' : '')} onClick={() => setMode('op')}>
          <span className="dot" />ปฏิบัติการ
        </button>
        <button className={'drill' + (mode === 'drill' ? ' active' : '')} onClick={() => setMode('drill')}>
          <span className="dot" />ฝึก
        </button>
      </div>

      <div className="nav-section">{roleInfo.th} · {mode === 'op' ? 'ปฏิบัติการ' : 'การฝึก'}</div>
      <div className="nav-list">
        {menu.map(m => (
          <button key={m.id} className={'nav-item' + (view === m.id ? ' active' : '')} onClick={() => setView(m.id)}>
            <Icon name={m.icon} className="icon" />
            <div className="label">
              <div>{m.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{m.en}</div>
            </div>
            {m.count && <span className={'count ' + (m.countTone || '')}>{m.count}</span>}
          </button>
        ))}
      </div>

      {role === 'Commander' && mode === 'op' && (
        <>
          <div className="nav-section">การกระทำด่วน</div>
          <div className="nav-list">
            <button className="nav-item" onClick={() => setView('methane')}>
              <Icon name="plus" className="icon" />
              <div className="label">รายงาน METHANE ใหม่</div>
            </button>
          </div>
        </>
      )}

      <div className="nav-section">ระบบ</div>
      <div className="nav-list">
        <button className="nav-item" onClick={onSettings}>
          <Icon name="settings" className="icon" />
          <div className="label">ตั้งค่า</div>
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="avatar" style={{ background: roleInfo.color }}>{roleInfo.initials}</div>
        <div className="info">
          <div className="who">{roleInfo.name}</div>
          <div className="role">{roleInfo.th}</div>
        </div>
      </div>
    </aside>
  );
}

/* ─── TopBar ─────────────────────────────────────────────── */
function TopBar({ mode, data, role, roleInfo, view }: {
  mode: string; data: Data; role: string; roleInfo: typeof ROLES[string]; view: string;
}) {
  const breadcrumbMap: Record<string, string> = {
    dashboard: 'ภาพรวมสั่งการ', methane: 'รับแจ้งเหตุ / METHANE',
    cop: 'ภาพรวมสถานการณ์ (COP)', iap: 'แผน IAP',
    facility: 'โรงพยาบาลและขนส่ง', control: 'ห้องควบคุมการฝึก',
    evaluation: 'แผงเครื่องประเมินผล', field: 'ภาคสนาม (Mobile)',
    aar: 'ทบทวนหลังภารกิจ (AAR)', registry: 'ทะเบียนกลาง',
    sessions: 'จัดการสถานการณ์',
  };
  const here = breadcrumbMap[view] || view;
  const incident = mode === 'op' ? data.incident : data.drill;

  return (
    <div className="topbar">
      <div className="crumbs">
        <span>{mode === 'op' ? 'โหมดปฏิบัติการ' : 'โหมดฝึก'}</span>
        <span className="sep">/</span>
        <span className="here">{here}</span>
      </div>

      <div className="incident-selector">
        <span className="pulse" />
        <div>
          <div className="code">{incident.code}</div>
          <div className="title-th">{(incident as any).title_th || (incident as any).title_en}</div>
        </div>
        <Icon name="chevron" size={14} />
      </div>

      <div className="spacer" />

      <span className="realtime-pill">
        <span className="dot" />สด · {data.events.length} เหตุการณ์
      </span>

      <button className="icon-btn"><Icon name="search" size={16} /></button>
      <button className="icon-btn">
        <Icon name="bell" size={16} />
        <span className="badge">3</span>
      </button>

      <div className="role-badge">
        <div className="avatar av" style={{ background: roleInfo.color }}>{roleInfo.initials}</div>
        <div>
          <div className="who">{roleInfo.name}</div>
          <div className="role-text">{roleInfo.th}</div>
        </div>
        <Icon name="chevron" size={12} color="var(--text-3)" />
      </div>
    </div>
  );
}

/* ─── ToastStack ─────────────────────────────────────────── */
function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={'toast ' + (t.severity || 'info')}>
          <div className="ttl">{t.title}</div>
          <div className="body">{t.body}</div>
          <div className="time">{t.time}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── DrillStub (drill dashboard landing) ─────────────────── */
function DrillStub({ data }: { data: Data }) {
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
        {data.metrics_drill.map((m: any, i: number) => <Metric key={i} {...m} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Panel title="วงจรการฝึก">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { phase: 'กำหนดวัตถุประสงค์', done: true },
              { phase: 'ขอบเขต', done: true },
              { phase: 'ออกแบบโจทย์', done: true },
              { phase: 'ควบคุมและปฏิบัติ', done: true, active: true },
              { phase: 'ประเมินผล', done: false },
              { phase: 'AAR / LMS', done: false },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 50,
                  background: p.active ? 'var(--magenta)' : p.done ? 'var(--green-bg)' : 'var(--bg-3)',
                  border: p.done ? '0' : '1px dashed var(--border-strong)',
                  display: 'grid', placeItems: 'center',
                  boxShadow: p.active ? '0 0 8px var(--magenta)' : 'none',
                }}>
                  {p.done && <Icon name="check" size={11} color={p.active ? 'white' : 'var(--green)'} />}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: p.active ? 600 : 500, color: p.active ? 'var(--text-1)' : p.done ? 'var(--text-2)' : 'var(--text-3)' }}>{p.phase}</div>
                {p.active && <span className="badge magenta" style={{ marginLeft: 'auto' }}><span className="dot" />เดี๋ยวนี้</span>}
              </div>
            ))}
          </div>
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
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: (d as any).active ? `1px solid ${d.color}` : '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, background: d.color, borderRadius: 50 }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: (d as any).active ? 600 : 500 }}>{d.type}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: d.color, fontWeight: 600 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="สถานะ · การฝึกสด">
          <KV pairs={[
            ['รหัส', <span key="c" style={{ fontFamily: 'var(--font-mono)' }}>{data.drill.code}</span>],
            ['ประเภท', <span key="t" className="badge magenta">เต็มรูปแบบ ผสมผสาน</span>],
            ['เวลาฝึก', <span key="ti" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>T+01:35:00</span>],
            ['ทีมที่พร้อม', `${data.teams.length} / 20`],
            ['ผู้ประสบภัย', '162 / 240'],
            ['วัตถุประสงค์', <span key="o" className="badge green">ล็อคแล้ว</span>],
            ['ผู้ควบคุม', `${data.controllers.length} คนมอบหมายแล้ว`],
            ['ผู้ประเมิน', `${data.evaluators.length} คน ออนไลน์`],
          ]} />
        </Panel>
      </div>
    </div>
  );
}

