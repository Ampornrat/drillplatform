'use client';
import React, { useState } from 'react';
import { Icon } from './icon';
import { StatusBadge, Triage, Readiness, SafetyGate, Metric, Panel, EventRow, KV } from './shared';
import { COPMap } from './cop-map';

type Data = any;
type FireEvent = (e: { severity: string; title: string; body: string }) => void;

export function OPDashboard({ data, setView }: { data: Data; setView: (v: string) => void }) {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · ภาพรวมสั่งการ</div>
          <h1>ภาพรวมสถานการณ์ร่วม (COP)</h1>
          <div className="sub">{data.incident.code} · {data.incident.title_th} · สั่งการแบบ {data.incident.command_mode} · {data.incident.lead_org}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setView('methane')}><Icon name="plus" size={14}/> เปิดเหตุใหม่ (METHANE)</button>
          <button className="btn primary" onClick={() => setView('cop')}><Icon name="map" size={14}/> เปิดแผนที่ COP</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
        {data.metrics_op.map((m: any, i: number) => <Metric key={i} {...m}/>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 12 }}>
        <Panel title="ภาพรวมสถานการณ์ — ตลิ่งชัน" actions={
          <><button className="btn sm ghost"><Icon name="filter" size={12}/> ชั้นข้อมูล</button><button className="btn sm ghost"><Icon name="refresh" size={12}/></button></>
        } flush>
          <COPMap data={data} height={420}/>
        </Panel>
        <div className="col">
          <Panel title="ศูนย์สั่งการเหตุ" actions={<button className="btn sm ghost">แก้ไข</button>}>
            <KV pairs={[
              ['รูปแบบศูนย์สั่งการ', <StatusBadge key="cmd" status="active" label={data.incident.command_mode}/>],
              ['หน่วยนำ', data.incident.lead_org],
              ['ห้วงปฏิบัติ', data.incident.op_period + ' · T+04:00–08:00'],
              ['เวอร์ชัน IAP', <span key="iap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="badge cyan">{data.incident.iap_version}</span>อนุมัติแล้ว T+03:58</span>],
              ['ระดับการตอบสนอง', <span key="lvl" className="badge amber"><span className="dot"/>{ data.incident.response_level}</span>],
              ['เริ่มเหตุ', data.incident.started + ' · 4 ชม. 12 นาที ที่แล้ว'],
            ]}/>
          </Panel>
          <Panel title="ด่านความปลอดภัย (Safety Gates)" count={data.safety_gates.length} actions={<button className="btn sm ghost">จัดการ</button>}>
            <div style={{ display: 'grid', gap: 6 }}>
              {data.safety_gates.map((g: any) => (
                <div key={g.code} className="between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{g.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{g.title}</div>
                  </div>
                  <SafetyGate status={g.status} code={g.status.toUpperCase()}/>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="บันทึกเหตุการณ์ระบบ" count={data.events.length} actions={
          <><button className="btn sm ghost"><Icon name="filter" size={12}/> กรอง</button><button className="btn sm ghost"><Icon name="download" size={12}/></button></>
        }>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {data.events.map((e: any, i: number) => <EventRow key={i} {...e}/>)}
          </div>
        </Panel>
        <Panel title="การส่งกำลังที่ดำเนินอยู่" count={data.teams.filter((t: any) => t.status !== 'available').length}>
          <table className="tbl">
            <thead><tr><th>ทรัพยากร</th><th>สถานะ</th><th>ปลายทาง</th><th>ความพร้อม</th></tr></thead>
            <tbody>
              {data.teams.filter((t: any) => t.status !== 'available').slice(0, 7).map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, background: 'var(--bg-3)', borderRadius: 4, display: 'grid', placeItems: 'center' }}>
                        <Icon name={t.type === 'drone' ? 'drone' : t.type === 'boat' ? 'boat' : t.type === 'helicopter' ? 'helicopter' : t.type === 'truck' ? 'truck' : t.type === 'safety' ? 'shield' : 'user'} size={12}/>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{t.code}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)' }}>{t.org}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={t.status} label={t.status.replace('_', ' ')}/></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{t.site}</td>
                  <td><Readiness percent={t.readiness}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

export function MethaneIntake({ data, setView, fireEvent }: { data: Data; setView: (v: string) => void; fireEvent: FireEvent }) {
  const [form, setForm] = useState({
    mechanism: 'น้ำท่วมฉับพลัน + คนติดอยู่',
    hazards: ['น้ำท่วม', 'กระแสน้ำ'],
    access: 'เส้นทางหลักปิด · เรือเท่านั้น · จุดนัดพบ: ท่าน้ำวัดไก่เตี้ย',
    casualties: { p1: 8, p2: 24, p3: 47, black: 3 },
    services: ['พยาบาลระดับสูง', 'USAR', 'เรือกู้ภัย'],
    reporter: 'ผอ. เขตตลิ่งชัน',
    safety_gates: { zone: 'warm', route: 'pending', security: 'passed', hospital: 'pending', authority: 'passed' },
  });

  const hazardOptions = ['น้ำท่วม', 'กระแสน้ำ', 'สารอันตราย', 'ไฟฟ้า', 'โครงสร้างไม่มั่นคง', 'ฝูงชน'];
  const serviceOptions = ['พยาบาลระดับสูง', 'USAR', 'เรือกู้ภัย', 'HEMS', 'ตำรวจ', 'EOD'];

  const setHazard = (h: string) => setForm(f => ({ ...f, hazards: f.hazards.includes(h) ? f.hazards.filter(x => x !== h) : [...f.hazards, h] }));
  const setService = (s: string) => setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }));

  const submit = () => {
    fireEvent({ severity: 'info', title: 'INCIDENT_OPENED · ' + data.incident.code, body: 'METHANE ส่งแล้ว · ระดับ 3 · IAP v1.0 ร่าง' });
    setView('dashboard');
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · รับแจ้งเหตุ</div>
          <h1>แบบรายงาน METHANE</h1>
          <div className="sub">กรอกให้ครบ 5 หัวข้อ → ระบบสร้าง Incident + IAP อัตโนมัติ</div>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setView('dashboard')}>ยกเลิก</button>
          <button className="btn primary" onClick={submit}><Icon name="arrow" size={14}/> ส่งรายงาน METHANE</button>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        <Panel title="M · H · A · N · E — รายงาน">
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="field">
              <label>M · กลไก / ลักษณะเหตุ (Mechanism)</label>
              <input className="input" value={form.mechanism} onChange={e => setForm(f => ({ ...f, mechanism: e.target.value }))}/>
            </div>
            <div className="field">
              <label>H · อันตราย (Hazards) <span className="hint">เลือกได้หลายข้อ</span></label>
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
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {['p1', 'p2', 'p3', 'black'].map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <Triage level={k.toUpperCase()}/>
                    <input type="number" value={(form.casualties as any)[k]} onChange={e => setForm(f => ({ ...f, casualties: { ...f.casualties, [k]: +e.target.value } }))}
                      style={{ flex: 1, background: 'transparent', border: 0, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, outline: 'none' }}/>
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>E · หน่วยงานที่ต้องการ (Emergency Services)</label>
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
          <Panel title="ผู้แจ้ง · อำนาจหน้าที่">
            <KV pairs={[
              ['ผู้แจ้ง', form.reporter],
              ['ศูนย์รับแจ้ง', 'Bangkok EOC'],
              ['Authority Matrix', <span key="auth" className="badge green"><span className="dot"/>หน่วยนำ: พบ.ราชองค์เสนา มพ.</span>],
            ]}/>
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

export function CopDispatch({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [taskForce, setTaskForce] = useState({ name: 'TF-Bravo', capability: 'MED-MCI-TRIAGE', assigned: ['BOAT-02', 'MED-BRAVO', 'SAFETY-1'] });
  const [filter, setFilter] = useState('all');

  const dispatch = () => fireEvent({ severity: 'info', title: 'ส่งชุดเฉพาะกิจ', body: `${taskForce.name} · 3 ทรัพยากร → SITE-B · สถานะ lifecycle ปรับแล้ว` });
  const filteredTeams = data.teams.filter((t: any) => filter === 'all' ? true : t.type === filter);

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดปฏิบัติการ · COP + ส่งกำลัง</div>
          <h1>ภาพรวมสถานการณ์ · บอร์ดส่งกำลัง</h1>
          <div className="sub">ลากจากทะเบียน · สร้างชุดเฉพาะกิจ · ส่งพร้อมตรวจ Safety Gate</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="grid" size={14}/> ชั้นข้อมูล</button>
          <button className="btn"><Icon name="refresh" size={14}/> รีเฟรช</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <Panel title="แผนที่ COP · สด" actions={<span className="badge cyan"><span className="dot"/>{data.sites.length} จุด · {data.teams.length} ทีม</span>} flush>
          <COPMap data={data} height={520} selected={selectedSite} onMarkerClick={setSelectedSite}/>
        </Panel>
        <div className="col">
          <Panel title="สร้างชุดเฉพาะกิจ" actions={<button className="btn sm primary" onClick={dispatch}><Icon name="arrow" size={12}/> ส่ง</button>}>
            <div className="grid" style={{ gap: 10 }}>
              <div className="field">
                <label>ชื่อชุดเฉพาะกิจ</label>
                <input className="input" value={taskForce.name} onChange={e => setTaskForce(tf => ({ ...tf, name: e.target.value }))}/>
              </div>
              <div className="field">
                <label>ชุดขีดความสามารถ</label>
                <select className="select" value={taskForce.capability} onChange={e => setTaskForce(tf => ({ ...tf, capability: e.target.value }))}>
                  {['SEC-EOD-GATE','MED-MCI-TRIAGE','LOG-COLD-CHAIN','FAC-ROLE3-TRAUMA','RES-WATER-SAR'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>มอบหมายจุดปลายทาง</label>
                <select className="select" defaultValue="SITE-B">
                  {data.sites.filter((s: any) => s.type === 'incident' || s.type === 'ccp').map((s: any) => (
                    <option key={s.id}>{s.id} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ทรัพยากรที่มอบหมาย <span className="hint">{taskForce.assigned.length} / 8</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px dashed var(--border-strong)', minHeight: 60 }}>
                  {taskForce.assigned.map(id => {
                    const t = data.teams.find((t: any) => t.id === id);
                    return (
                      <span key={id} className="chip active" style={{ cursor: 'default' }}>
                        <Icon name={t?.type === 'drone' ? 'drone' : t?.type === 'boat' ? 'boat' : t?.type === 'safety' ? 'shield' : 'user'} size={11}/>
                        {t?.code || id}
                        <button onClick={() => setTaskForce(tf => ({ ...tf, assigned: tf.assigned.filter(a => a !== id) }))}
                          style={{ background: 'transparent', border: 0, color: 'inherit', padding: 0, marginLeft: 2, display: 'flex', cursor: 'pointer' }}>
                          <Icon name="x" size={10}/>
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>ตรวจด่านความปลอดภัย</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <SafetyGate status="passed" code="EOD ✓"/>
                  <SafetyGate status="passed" code="LZ ✓"/>
                  <SafetyGate status="failed" code="HOSPITAL ✗"/>
                  <SafetyGate status="pending" code="ROUTE ?"/>
                </div>
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <Icon name="incident" size={12}/>
                  <span>HOSPITAL_GATE ถูกบล็อก · ต้องจัดเส้นทาง P1 ไปรามาธิบดี (Role 3) ก่อนส่ง</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="ทะเบียนทรัพยากร · พร้อมใช้งาน" count={filteredTeams.length} actions={
        <div style={{ display: 'flex', gap: 4 }}>
          {['all','boat','medical','drone','truck','helicopter','safety'].map(t => (
            <span key={t} className={'chip' + (filter === t ? ' active' : '')} onClick={() => setFilter(t)} style={{ textTransform: 'capitalize', fontSize: 11 }}>{t}</span>
          ))}
        </div>
      } flush>
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>ชื่อ</th><th>ขีดความสามารถ</th><th>สถานะ</th><th>ความพร้อม</th><th>ที่อยู่</th><th>หน่วย</th><th></th></tr></thead>
          <tbody>
            {filteredTeams.map((t: any) => (
              <tr key={t.id} className={taskForce.assigned.includes(t.id) ? 'selected' : ''}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-2)' }}>{t.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={t.type === 'drone' ? 'drone' : t.type === 'boat' ? 'boat' : t.type === 'helicopter' ? 'helicopter' : t.type === 'truck' ? 'truck' : t.type === 'safety' ? 'shield' : 'user'} size={14} color="var(--text-3)"/>
                    <span style={{ fontWeight: 500 }}>{t.code}</span>
                  </div>
                </td>
                <td>{t.capability}</td>
                <td><StatusBadge status={t.status} label={t.status.replace('_', ' ')}/></td>
                <td><Readiness percent={t.readiness}/></td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{t.site}</td>
                <td style={{ color: 'var(--text-3)' }}>{t.org}</td>
                <td>
                  {taskForce.assigned.includes(t.id) ? (
                    <button className="btn sm ghost" onClick={() => setTaskForce(tf => ({ ...tf, assigned: tf.assigned.filter(a => a !== t.id) }))}>นำออก</button>
                  ) : (
                    <button className="btn sm" onClick={() => setTaskForce(tf => ({ ...tf, assigned: [...tf.assigned, t.id] }))}><Icon name="plus" size={11}/> เพิ่ม</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

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
          <table className="tbl">
            <thead><tr><th>ผู้ป่วย</th><th>คัดแยก</th><th>จุด</th><th>ต้องการ</th><th>แนะนำปลายทาง</th><th>สถานะ</th><th>ETA</th></tr></thead>
            <tbody>
              {[
                { id: 'PAT-022', site: 'SITE-B', lvl: 'P1', needs: 'เลือดออกมาก, ผ่าตัด', rec: 'รามาธิบดี (Role 3)', status: 'transporting', eta: '8 นาที' },
                { id: 'PAT-019', site: 'SITE-A', lvl: 'P1', needs: 'ทางเดินหายใจ, ICU', rec: 'จุฬาฯ (Role 3)', status: 'transporting', eta: '12 นาที' },
                { id: 'PAT-015', site: 'CCP-1', lvl: 'P2', needs: 'กระดูกต้นขาหัก', rec: 'ศิริราช (Role 2) ⚠', status: 'redirect', eta: '—' },
                { id: 'PAT-008', site: 'SITE-B', lvl: 'P3', needs: 'บาดแผลเล็กน้อย', rec: 'CCP-1 / Role 1', status: 'on_scene', eta: '' },
              ].map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{p.id}</td>
                  <td><Triage level={p.lvl}/></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{p.site}</td>
                  <td>{p.needs}</td>
                  <td>{p.rec}</td>
                  <td><StatusBadge status={p.status} label={p.status === 'redirect' ? 'เปลี่ยนทาง' : p.status === 'transporting' ? 'กำลังส่ง' : p.status === 'on_scene' ? 'อยู่หน้างาน' : p.status}/></td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{p.eta ? 'ETA ' + p.eta : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="โหมดการขนส่ง">
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { icon: 'truck', name: 'ALS รถพยาบาลชั้นสูง', count: '8 / 12', status: 'active' },
              { icon: 'boat', name: 'เรือพยาบาล', count: '3 / 6', status: 'active' },
              { icon: 'helicopter', name: 'HEMS / MEDEVAC', count: '1 / 2', status: 'pending' },
              { icon: 'drone', name: 'UAV ขนส่งเสบียง', count: '2 / 2', status: 'active' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--bg-1)', borderRadius: 6, display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
                  <Icon name={t.icon} size={18} color="var(--cyan)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.count} พร้อมใช้งาน</div>
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
