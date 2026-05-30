'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from './icon';
import { StatusBadge, Triage, Readiness, Metric, Panel, KV } from './shared';

type Data = any;
type FireEvent = (e: { severity: string; title: string; body: string }) => void;

export function ControlRoom({ data, fireEvent, onPushInject, onUpdateGate }: {
  data: Data; fireEvent: FireEvent;
  onPushInject?: (id: string) => Promise<void>;
  onUpdateGate?: (id: string, status: string, checkedBy?: string) => Promise<void>;
}) {
  const [clock, setClock] = useState({ status: 'live', elapsed: 5700 });
  const [injects, setInjects] = useState(data.drill_injects);

  // sync when Supabase realtime updates parent data
  useEffect(() => { setInjects(data.drill_injects); }, [data.drill_injects]);
  const [selectedTab, setTab] = useState('queue');

  useEffect(() => {
    if (clock.status !== 'live') return;
    const t = setInterval(() => setClock(c => ({ ...c, elapsed: c.elapsed + 1 })), 1000);
    return () => clearInterval(t);
  }, [clock.status]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const pushInject = (id: string) => {
    setInjects((injs: any[]) => injs.map(i => i.id === id ? { ...i, status: 'pushed' } : i));
    const inj = injects.find((i: any) => i.id === id);
    if (inj) {
      fireEvent({ severity: 'drill', title: `INJECT_PUSHED · ${inj.title}`, body: `Delivered to ${inj.target} · Expected: ${inj.expected.slice(0, 60)}…` });
      onPushInject?.(id);
    }
  };

  const pauseExercise = () => {
    setClock(c => ({ ...c, status: c.status === 'paused' ? 'live' : 'paused' }));
    fireEvent({ severity: 'warning', title: clock.status === 'paused' ? 'Exercise RESUMED' : 'SAFETY_PAUSE', body: clock.status === 'paused' ? 'Sim clock running' : 'All field teams hold.' });
  };

  const queued = injects.filter((i: any) => i.status === 'queued').length;
  const pushed = injects.filter((i: any) => i.status === 'pushed').length;
  const acknowledged = injects.filter((i: any) => i.status === 'acknowledged').length;

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดฝึก · ห้องควบคุมการฝึก</div>
          <h1>{data.drill.title_th}</h1>
          <div className="sub">{data.drill.code} · {data.drill.teams} ทีม · ผู้ประสบภัยจำลอง {data.drill.casualties_total} ราย · ผู้ควบคุม {data.controllers.length} คน</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={14}/> ส่งออกบันทึก</button>
          <button className={'btn ' + (clock.status === 'paused' ? 'primary' : 'danger')} onClick={pauseExercise}>
            <Icon name={clock.status === 'paused' ? 'play' : 'pause'} size={14}/>
            {clock.status === 'paused' ? 'ดำเนินการต่อ' : 'หยุดฉุกเฉิน'}
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr', marginBottom: 12, gap: 12 }}>
        <div className="panel" style={{ background: 'linear-gradient(135deg, var(--magenta-bg) 0%, var(--bg-1) 60%)', border: '1px solid var(--magenta)' }}>
          <div className="panel-body" style={{ padding: 18 }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ color: 'var(--magenta)' }}>เวลาฝึก (SIM CLOCK)</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: clock.status === 'live' ? 'var(--magenta)' : 'var(--amber)', display: 'block', animation: 'iodp-pulse-anim 1.6s infinite' }}/>
                <span className="badge magenta">{clock.status === 'paused' ? 'หยุดฉุกเฉิน' : 'สด'}</span>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1 }}>
              {fmt(clock.elapsed)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="badge gray">เริ่ม T+00:00</span>
              <span className="badge gray">กำหนดจบ T+04:00</span>
              <span className="badge magenta">ผ่านไป {Math.round((clock.elapsed / 14400) * 100)}%</span>
            </div>
          </div>
        </div>

        <Panel title="ทีมควบคุม (Controller Cell)">
          <div style={{ display: 'grid', gap: 8 }}>
            {data.controllers.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: i === 0 ? 'linear-gradient(135deg,#c084fc,#6691ff)' : 'var(--bg-3)' }}>
                  {c.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{c.role}</div>
                </div>
                <StatusBadge status="active"/>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="สถานะ MSEL">
          <div style={{ display: 'grid', gap: 10 }}>
            <InjectGauge label="ในคิว" count={queued} color="var(--amber)" total={injects.length}/>
            <InjectGauge label="ส่งแล้ว" count={pushed} color="var(--cyan)" total={injects.length}/>
            <InjectGauge label="ตอบรับแล้ว" count={acknowledged} color="var(--green)" total={injects.length}/>
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Inject ถัดไป</div>
              {(() => {
                const next = injects.find((i: any) => i.status === 'queued');
                return next ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{next.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{next.t} · {next.type}</div>
                  </div>
                ) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>ไม่มี inject ในคิว</div>;
              })()}
            </div>
          </div>
        </Panel>
      </div>

      <div className="panel">
        <div className="tabs">
          {[['queue','คิว Inject (MSEL)'],['casualties','สร้างผู้ประสบภัย'],['scenario','ออกแบบโจทย์'],['objectives','วัตถุประสงค์']].map(([id, lbl]) => (
            <button key={id} className={'tab' + (selectedTab === id ? ' active' : '')} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div className="panel-body">
          {selectedTab === 'queue' && <InjectQueue injects={injects} onPush={pushInject} clock={clock} fmt={fmt}/>}
          {selectedTab === 'casualties' && <CasualtyGenerator data={data} fireEvent={fireEvent}/>}
          {selectedTab === 'scenario' && <ScenarioBuilder data={data}/>}
          {selectedTab === 'objectives' && <Objectives/>}
        </div>
      </div>
    </div>
  );
}

function InjectGauge({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  return (
    <div>
      <div className="between" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
        <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span><span style={{ color, fontWeight: 600 }}>{count}</span><span style={{ color: 'var(--text-3)' }}> / {total}</span></span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(count / total) * 100}%`, background: color }}/>
      </div>
    </div>
  );
}

function InjectQueue({ injects, onPush, clock, fmt }: { injects: any[]; onPush: (id: string) => void; clock: any; fmt: (s: number) => string }) {
  return (
    <table className="tbl">
      <thead><tr><th>T+</th><th>ID</th><th>ประเภท</th><th>หัวข้อ</th><th>ผู้รับ</th><th>สถานะ</th><th>การกระทำที่คาดหวัง</th><th></th></tr></thead>
      <tbody>
        {injects.map((inj: any) => {
          const m = inj.t.match(/T\+(\d+):(\d+)/);
          const elapsedSec = m ? +m[1] * 3600 + +m[2] * 60 : 0;
          const due = clock.elapsed > elapsedSec - 300 && inj.status === 'queued';
          return (
            <tr key={inj.id} style={due ? { background: 'var(--amber-bg)' } : {}}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{inj.t}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{inj.id}</td>
              <td><span className="badge gray">{inj.type}</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="inject" size={12} color={inj.status === 'pushed' ? 'var(--cyan)' : 'var(--text-3)'}/>
                  <span style={{ fontWeight: 500 }}>{inj.title}</span>
                </div>
              </td>
              <td style={{ color: 'var(--text-2)' }}>{inj.target}</td>
              <td><StatusBadge status={inj.status === 'acknowledged' ? 'ok' : inj.status === 'pushed' ? 'active' : 'pending'} label={inj.status}/></td>
              <td style={{ color: 'var(--text-3)', fontSize: 11.5, maxWidth: 320 }}>{inj.expected}</td>
              <td>
                {inj.status === 'queued' ? (
                  <button className="btn sm drill-primary" onClick={() => onPush(inj.id)}><Icon name="arrow" size={11}/> ส่ง</button>
                ) : inj.status === 'pushed' ? (
                  <button className="btn sm ghost">รอตอบรับ</button>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--green)' }}><Icon name="check" size={11}/></span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CasualtyGenerator({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  const [archetype, setArchetype] = useState('ARC-P1-BLEED');
  const [count, setCount] = useState(12);
  const [site, setSite] = useState('SITE-A');
  const a = data.casualty_archetypes.find((a: any) => a.id === archetype);
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr', gap: 14 }}>
      <div className="col">
        <div className="field">
          <label>ต้นแบบผู้ประสบภัย</label>
          <select className="select" value={archetype} onChange={e => setArchetype(e.target.value)}>
            {data.casualty_archetypes.map((a: any) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label>จำนวน <span className="hint">{count} ราย</span></label>
          <input type="range" min="1" max="50" value={count} onChange={e => setCount(+e.target.value)} style={{ accentColor: 'var(--magenta)', width: '100%' }}/>
        </div>
        <div className="field">
          <label>จุดปลายทาง</label>
          <select className="select" value={site} onChange={e => setSite(e.target.value)}>
            {data.sites.filter((s: any) => s.type === 'incident' || s.type === 'ccp').map((s: any) => <option key={s.id}>{s.id} — {s.name}</option>)}
          </select>
        </div>
        <button className="btn drill-primary large" onClick={() => fireEvent({ severity: 'drill', title: `สร้างผู้ประสบภัยจำลอง ${count} ราย`, body: `${a?.title} → ${site} · สร้าง lifecycle ${count} × undiscovered` })}>
          <Icon name="plus" size={14}/> สร้าง {count} × {a?.triage}
        </button>
      </div>
      {a && (
        <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>{a.title}</h3>
            <Triage level={a.triage}/>
          </div>
          <KV pairs={[
            ['รพ. ที่ต้อง', a.facility],
            ['อาการที่สังเกต', a.cues],
            ['มีอยู่ในคลัง', `${a.count} ต้นแบบ`],
          ]}/>
        </div>
      )}
    </div>
  );
}

function ScenarioBuilder({ data }: { data: Data }) {
  const [tpl, setTpl] = useState('TPL-FLOOD-MCI');
  const sel = data.scenario_templates.find((t: any) => t.id === tpl);
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr', gap: 14 }}>
      <Panel title="เทมเพลตโจทย์">
        <div style={{ display: 'grid', gap: 6 }}>
          {data.scenario_templates.map((t: any) => (
            <button key={t.id} className={'nav-item' + (t.id === tpl ? ' active' : '')} onClick={() => setTpl(t.id)} style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
                <Icon name="scenario" size={12}/>{t.title}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>ผู้ประสบภัย {t.casualties} · {t.duration}</div>
            </button>
          ))}
        </div>
      </Panel>
      <div>
        <div className="between" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{sel?.title}</h3>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{sel?.id} · {sel?.type}</div>
          </div>
          <button className="btn drill-primary"><Icon name="plus" size={12}/> สร้างโจทย์จากเทมเพลต</button>
        </div>
        <KV pairs={[
          ['ผู้ประสบภัย', sel?.casualties + ' ราย'],
          ['ระยะเวลา', sel?.duration],
          ['ธีมความเสี่ยง', sel?.risk],
        ]}/>
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>ไทมไลน์ MSEL</div>
          <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflowX: 'auto' }}>
            {[
              { t: 'T+0', title: 'METHANE', color: 'var(--cyan)' },
              { t: 'T+30', title: 'สะพานปิด', color: 'var(--amber)' },
              { t: 'T+60', title: 'P1 Surge', color: 'var(--red)' },
              { t: 'T+90', title: 'Role 2 เต็ม', color: 'var(--amber)' },
              { t: 'T+120', title: 'สื่อสารขัด', color: 'var(--red)' },
              { t: 'T+150', title: 'สารเคมี', color: 'var(--magenta)' },
              { t: 'T+180', title: 'สื่อสอบถาม', color: 'var(--cyan)' },
            ].map((m, i) => (
              <div key={i} style={{ minWidth: 104, padding: 8, borderRadius: 6, background: 'var(--bg-1)', border: `1px solid ${m.color}` }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: m.color, fontWeight: 600 }}>{m.t}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{m.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Objectives() {
  const objs = [
    { level: 'รายบุคคล', title: 'ความแม่นยำการคัดแยก', target: '≥ 85% START-SALT', metric: 'triage_accuracy' },
    { level: 'รายทีม', title: 'เวลาระดมพล', target: '≤ 12 นาที จาก inject ถึงถึงที่เกิดเหตุ', metric: 'team_mobilize' },
    { level: 'รายหน่วย', title: 'รอบสร้าง IAP', target: '≤ 20 นาที ร่าง → อนุมัติ', metric: 'iap_cycle' },
    { level: 'ระบบ', title: 'เวลา P1 ถึง Definitive Care', target: '≤ 60 นาที หลังคัดแยก', metric: 'p1_definitive' },
  ];
  return (
    <table className="tbl">
      <thead><tr><th>ระดับ</th><th>วัตถุประสงค์</th><th>เป้าหมาย</th><th>รหัสตัวชี้วัด</th></tr></thead>
      <tbody>
        {objs.map((o, i) => (
          <tr key={i}>
            <td><span className="badge magenta">{o.level}</span></td>
            <td style={{ fontWeight: 500 }}>{o.title}</td>
            <td style={{ color: 'var(--text-2)' }}>{o.target}</td>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{o.metric}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EvaluationDashboard({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">โหมดฝึก · การประเมินผล</div>
          <h1>แผงเครื่องประเมินผลการปฏิบัติ</h1>
          <div className="sub">{data.drill.code} · ผู้ประเมิน {data.evaluators.length} คน · บันทึก 126 รายการ</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={14}/> ส่งออก CSV</button>
          <button className="btn primary" onClick={() => fireEvent({ severity: 'info', title: 'บันทึกการสังเกต', body: 'ทีม 3B · TRIAGE_ACC · คะแนน 3 · มีช่องว่าง' })}><Icon name="plus" size={14}/> บันทึกการสังเกต</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
        {data.evaluation_metrics.map((m: any) => (
          <div key={m.code} className={`metric ${m.tone || ''}`}>
            <div className="label">{m.title}</div>
            <div className="value"><span>{m.value}</span>{m.unit && <span className="unit">{m.unit}</span>}</div>
            <div className="footer">Target: {m.target}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <Panel title="ผลงานรายทีม" count={data.team_performance.length}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.team_performance.map((t: any, i: number) => {
              const pct = (t.score / 5) * 100;
              const c = t.score >= 4 ? 'var(--green)' : t.score >= 3 ? 'var(--cyan)' : 'var(--red)';
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 70px 90px', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.code}</div>
                  <div>
                    <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: c, transition: 'width 0.5s' }}/>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: c, textAlign: 'right' }}>{t.score.toFixed(1)}<span style={{ fontSize: 11, color: 'var(--text-3)' }}>/5</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.findings} ข้อ</div>
                  <StatusBadge status={t.status === 'excellent' ? 'ok' : t.status === 'good' ? 'active' : 'critical'} label={t.status === 'excellent' ? 'ดีเยี่ยม' : t.status === 'good' ? 'ดี' : 'ต้องปรับ'}/>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="วิกฤตด้านความปลอดภัย" count={3} actions={<button className="btn sm ghost">จัดการ</button>}>
          <div style={{ padding: 10, background: 'var(--red-bg)', borderRadius: 'var(--radius)', border: '1px solid rgba(220, 38, 38, 0.25)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="shield" size={14} color="var(--red)"/>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>ละเมิด HOT_ZONE (ยังไม่ผ่าน EOD)</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>T+04:08 · MED-BRAVO · SITE-B</div>
          </div>
          <div style={{ padding: 10, background: 'var(--amber-bg)', borderRadius: 'var(--radius)', border: '1px solid rgba(180, 83, 9, 0.25)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="incident" size={14} color="var(--amber)"/>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>เกือบเกิดเหตุ: HEMS ลงจอดขณะลมแรง</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>T+02:14 · HEMS-01 · LZ-1</div>
          </div>
          <div style={{ padding: 10, background: 'var(--amber-bg)', borderRadius: 'var(--radius)', border: '1px solid rgba(180, 83, 9, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="flag" size={14} color="var(--amber)"/>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>ไม่ได้รับอนุญาต: โดรนบินเหนือฝูงชน</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>T+01:42 · UAV-Recon-3</div>
          </div>
        </Panel>
      </div>

      <Panel title="ฟอร์มบันทึกของผู้ประเมิน" actions={<button className="btn sm primary" onClick={() => fireEvent({ severity: 'info', title: 'บันทึกส่งแล้ว', body: 'ทีม 3B · TRIAGE_ACC · คะแนน 3' })}><Icon name="plus" size={11}/> ส่ง</button>}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div className="field"><label>ผู้ถูกประเมิน</label><input className="input" defaultValue="ทีม 3B"/></div>
          <div className="field">
            <label>ตัวชี้วัด</label>
            <select className="select"><option>TRIAGE_ACC — ความแม่นยำการคัดแยก</option><option>P1_FIRST_CONTACT — เวลาถึงผู้ป่วยรายแรก</option><option>SAFETY_VIOLATIONS — ละเมิด Safety Gate</option></select>
          </div>
          <div className="field">
            <label>คะแนน (0-5)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2,3,4,5].map(n => (
                <button key={n} className={'chip' + (n === 3 ? ' active' : '')} style={{ flex: 1, justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '8px 0' }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>ผ่าน / มีช่องว่าง</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="chip active" style={{ flex: 1, justifyContent: 'center' }}>ผ่าน</button>
              <button className="chip" style={{ flex: 1, justifyContent: 'center', color: 'var(--red)' }}>มีช่องว่าง</button>
            </div>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>ข้อตรวจพบ</label>
            <textarea className="textarea" defaultValue="ผู้ป่วย P2 4 จาก 14 ราย ถูกจัดผิดเป็น P3 · ขั้นตอน MARCH ถูกข้าม"/>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>รหัสเหตุการณ์อ้างอิง <span className="hint">คั่นด้วย ,</span></label>
            <input className="input" defaultValue="evt 4f8a-9d2c, evt 7b21-aa1"/>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function AARLoop({ data, fireEvent }: { data: Data; fireEvent: FireEvent }) {
  const [selected, setSelected] = useState('FND-001');
  const finding = data.aar_findings.find((f: any) => f.id === selected);

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">AAR + LMS Loop · การฝึก ปี 2569</div>
          <h1>ทบทวนหลังภารกิจ (AAR)</h1>
          <div className="sub">{data.aar_findings.length} ข้อตรวจพบ · สร้างจาก Event Log · เชื่อมกับ LMS, SOP และคลังโจทย์</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="refresh" size={14}/> สร้างใหม่</button>
          <button className="btn primary"><Icon name="download" size={14}/> ส่งออก AAR</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 12 }}>
        <Panel title="ข้อตรวจพบ (Findings)" count={data.aar_findings.length}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.aar_findings.map((f: any) => (
              <button key={f.id} onClick={() => setSelected(f.id)} className={'nav-item' + (selected === f.id ? ' active' : '')}
                style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 12, gap: 6, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span className={`badge ${f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : 'cyan'}`}>
                    <span className="dot"/>{f.severity.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', marginLeft: 'auto' }}>{f.id}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{f.type}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="col">
          {finding && (
            <>
              <Panel title="รายละเอียดช่องว่าง · 5 คำถาม">
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className={`badge ${finding.severity === 'critical' ? 'red' : finding.severity === 'high' ? 'amber' : 'cyan'}`}>
                      {finding.severity === 'critical' ? 'วิกฤต' : finding.severity === 'high' ? 'สูง' : 'ปานกลาง'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{finding.id}</span>
                  </div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 600 }}>{finding.title}</h3>
                  <GapStep label="เกิดอะไรขึ้น" body={finding.summary}/>
                  <GapStep label="ทำไมจึงต่างจากที่คาดหวัง" body={finding.cause}/>
                  <GapStep label="ดังนั้น · ต้องทำอะไรต่อ" body={finding.recommendation}/>
                </div>
              </Panel>

              <Panel title="มอบหมายหลักสูตร LMS · สร้างอัตโนมัติ" actions={<button className="btn sm drill-primary" onClick={() => fireEvent({ severity: 'drill', title: 'มอบหมายหลักสูตร LMS', body: `${finding.lms.course} · ${finding.lms.title}` })}><Icon name="plus" size={11}/> มอบหมายหลักสูตร</button>}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 12, background: 'linear-gradient(135deg, var(--magenta-bg), var(--bg-1))', borderRadius: 'var(--radius)', border: '1px solid var(--magenta)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Icon name="book" size={14} color="var(--magenta)"/>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--magenta)' }}>{finding.lms.course}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{finding.lms.title}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {finding.lms.roles.map((r: string) => <span key={r} className="badge gray">{r}</span>)}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>แผนปรับปรุง</div>
                    <KV pairs={[
                      ['ผู้รับผิดชอบ', 'พ.อ. สุริยะ'],
                      ['กำหนดเสร็จ', 'T+30 วัน'],
                      ['สถานะ', <span key="s" className="badge cyan">ร่าง</span>],
                    ]}/>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GapStep({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

export function Registry({ data }: { data: Data }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(data.registry[0]);
  const types = ['all','drone','vehicle','task_force','facility','patient','standard'];
  const filtered = filter === 'all' ? data.registry : data.registry.filter((r: any) => r.type === filter);

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">ผู้ดูแลระบบ · ทะเบียนกลาง</div>
          <h1>ทะเบียนทรัพยากร · หนังสือเดินทาง (Passport)</h1>
          <div className="sub">{data.registry.length} รายการ · ใช้ร่วมกันระหว่างโหมดปฏิบัติการและโหมดฝึก</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={14}/> ลงทะเบียนทรัพยากร</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {types.map(t => {
          const labels: Record<string, string> = { all: 'ทั้งหมด', drone: 'โดรน', vehicle: 'ยานพาหนะ', task_force: 'ชุดเฉพาะกิจ', facility: 'สถานพยาบาล', patient: 'ผู้ป่วย', standard: 'มาตรฐาน' };
          return (
            <span key={t} className={'chip' + (filter === t ? ' active' : '')} onClick={() => setFilter(t)} style={{ fontSize: 11.5 }}>
              {labels[t]} <span style={{ color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{t === 'all' ? data.registry.length : data.registry.filter((r: any) => r.type === t).length}</span>
            </span>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <Panel title={`ทะเบียน · ${filtered.length} รายการ`} flush>
          <table className="tbl">
            <thead><tr><th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>สถานะ</th><th>ความพร้อม</th><th>เจ้าของ</th><th>ปรับล่าสุด</th></tr></thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} onClick={() => setSelected(r)} className={selected.id === r.id ? 'selected' : ''} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-2)' }}>{r.id}</td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td><span className="badge gray">{r.type.replace('_', ' ')}</span></td>
                  <td><StatusBadge status={r.status}/></td>
                  <td><Readiness percent={r.readiness}/></td>
                  <td style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{r.owner}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-3)' }}>{r.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="หนังสือเดินทาง (Object Passport)" actions={<button className="btn sm ghost">แก้ไข</button>}>
          <PassportCard r={selected}/>
        </Panel>
      </div>
    </div>
  );
}

function PassportCard({ r }: { r: any }) {
  const icon: Record<string, string> = { drone: 'drone', vehicle: 'boat', task_force: 'user', facility: 'hospital', patient: 'casualty', standard: 'book' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, var(--cyan-bg), var(--bg-3))', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon[r.type] || 'registry'} size={24} color="var(--cyan)"/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.04em' }}>{r.id}</div>
          <h3 style={{ margin: '2px 0 0 0', fontSize: 15, fontWeight: 600 }}>{r.name}</h3>
        </div>
      </div>
      <KV pairs={[
        ['ประเภท', <span key="t" className="badge gray">{r.type}</span>],
        ['เจ้าของ', r.owner],
        ['สถานะ', <StatusBadge key="s" status={r.status}/>],
        ['ความพร้อม', <Readiness key="r" percent={r.readiness}/>],
        ['ขีดความสามารถ', <div key="c" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>{r.capabilities.map((c: string) => <span key={c} className="chip" style={{ cursor: 'default', fontSize: 10.5, padding: '2px 7px' }}>{c}</span>)}</div>],
        ['ปรับล่าสุด', <span key="u" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{r.updated}</span>],
      ]}/>
    </div>
  );
}
