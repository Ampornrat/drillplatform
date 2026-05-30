'use client';
import React, { useState } from 'react';
import { Icon } from './icon';

type Data = any;

interface FieldMobileProps { data: Data; fireEvent: (e: any) => void; }

export function FieldMobile({ data, fireEvent }: FieldMobileProps) {
  const [tab, setTab] = useState('triage');
  const [pos] = useState({ lat: '13.7775', lng: '100.4582' });

  const submitTriage = () => {
    fireEvent({ severity: 'info', title: 'ส่งการคัดแยกผู้ป่วยสำเร็จ', body: 'PAT-2026-0847-024 · P1 · MED-ALPHA' });
  };

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, justifyContent: 'center', alignItems: 'flex-start', minHeight: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'var(--cyan)' }}>ภาคสนาม (Field) · โหมดปฏิบัติการ</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>MED-ALPHA-001 · ส.อ. วศิน อ. · {data.incident.code}</div>
        </div>

        {/* Phone-frame container */}
        <div style={{
          width: 380, background: '#fff', borderRadius: 44, overflow: 'hidden',
          boxShadow: '0 0 0 10px #1a1a2e, 0 24px 64px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)', minHeight: 820,
          display: 'flex', flexDirection: 'column',
        }}>
          <FieldStatusHeader />
          <FieldTabSwitcher tab={tab} setTab={setTab} />
          <div style={{ padding: '0 16px 24px 16px', color: '#0e1525', flex: 1 }}>
            {tab === 'triage' && <TriageScreen onSubmit={submitTriage} pos={pos} />}
            {tab === 'checkin' && <CheckInScreen pos={pos} />}
            {tab === 'supply' && <SupplyScreen />}
            {tab === 'inbox' && <InboxScreen data={data} />}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text-3)' }}>
          <Icon name="radio" size={12} color="var(--green)" />
          <span>เชื่อมต่อ · ค้างคิว 12 รายการ · GPS แม่นยำ 4 ม.</span>
        </div>
      </div>

      <div style={{ maxWidth: 340, paddingTop: 60 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>เกี่ยวกับหน้านี้</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          หน้าจอภาคสนามแบบ mobile-first สำหรับการคัดแยก, check-in, ขอสนับสนุน และกล่องข้อความ inject — คอลัมน์เดียว ปุ่มใหญ่ ใช้ขั้นตอน MARCH, จับ GPS อัตโนมัติ, แบบร่างเก็บไว้ตอนออฟไลน์ และมีคิว retry ที่บอกสถานะ queued / sent / failed
        </p>
        <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          <FeatureRow icon="casualty" title="คัดแยก · MARCH" body="กด P1/P2/P3/Black · เช็คลิสต์ MARCH · ถ่ายภาพ · ตรวจ Safety Gate ก่อนส่งต่อ" />
          <FeatureRow icon="user" title="Check-in ทีม" body="โหมด + สถานะ + GPS ใน 3 แตะ · บันทึก TEAM_CHECK_IN" />
          <FeatureRow icon="truck" title="ขอสนับสนุน" body="เลือด, O₂, splint · เลือกโหมดขนส่งอัตโนมัติตามด่านเส้นทาง" />
          <FeatureRow icon="bell" title="กล่องข้อความสนาม" body="MSEL inject, การแจ้งเตือนจากผู้บังคับการ, alert วิกฤตต้องตอบรับ" />
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--bg-1)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, background: 'var(--cyan-bg)', borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={16} color="var(--cyan)" />
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

function FieldStatusHeader() {
  return (
    <div style={{ paddingTop: 50, padding: '50px 16px 8px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#677489', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>โหมดปฏิบัติการ · INC-2026-0847</div>
          <div style={{ fontSize: 15, color: '#0e1525', marginTop: 2, fontWeight: 600 }}>น้ำท่วม + MCI ตลิ่งชัน</div>
        </div>
        <div style={{ padding: '4px 9px', background: '#d1fae5', borderRadius: 50, fontSize: 10, color: '#059669', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 50, background: '#059669' }} />
          สด
        </div>
      </div>
    </div>
  );
}

function FieldTabSwitcher({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const tabs = [
    { id: 'triage', label: 'คัดแยก', icon: 'casualty' },
    { id: 'checkin', label: 'Check-in', icon: 'pin' },
    { id: 'supply', label: 'สนับสนุน', icon: 'truck' },
    { id: 'inbox', label: 'กล่องข้อความ', icon: 'bell', badge: 1 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: '0 16px', marginBottom: 16 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          background: tab === t.id ? '#e0f6fc' : '#F2F2F7',
          border: tab === t.id ? '1px solid #0891b2' : '1px solid #e3e7ee',
          borderRadius: 10, padding: '10px 4px', color: tab === t.id ? '#0891b2' : '#677489',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', cursor: 'pointer',
        }}>
          <Icon name={t.icon} size={18} />
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.label}</span>
          {t.badge && <span style={{ position: 'absolute', top: 6, right: 8, minWidth: 14, height: 14, background: '#dc2626', borderRadius: 7, fontSize: 9, color: 'white', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '0 3px' }}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function TriageScreen({ onSubmit, pos }: { onSubmit: () => void; pos: { lat: string; lng: string } }) {
  const [level, setLevel] = useState('P1');
  const [march, setMarch] = useState<Record<string, boolean>>({ M: true, A: true, R: false, C: false, H: false });

  return (
    <div>
      <div style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>รหัสผู้ป่วย</div>
        <div style={{ fontSize: 17, fontFamily: 'var(--font-mono)', color: '#0e1525', fontWeight: 600, marginTop: 2 }}>PAT-2026-0847-024</div>
        <div style={{ fontSize: 10.5, color: '#677489', marginTop: 4 }}>GPS · {pos.lat}°N · {pos.lng}°E · ±4 ม. · SITE-B</div>
      </div>

      <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>ระดับคัดแยก</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'P1', color: '#dc2626', label: 'P1\nรุนแรง' },
          { id: 'P2', color: '#d97706', label: 'P2\nเร่งด่วน' },
          { id: 'P3', color: '#059669', label: 'P3\nรอได้' },
          { id: 'BLACK', color: '#475569', label: 'BLACK\nเสียชีวิต' },
        ].map(t => (
          <button key={t.id} onClick={() => setLevel(t.id)} style={{
            padding: '12px 4px',
            background: level === t.id ? t.color : '#ffffff',
            border: level === t.id ? `1px solid ${t.color}` : '1px solid #e3e7ee',
            borderRadius: 10,
            color: level === t.id ? 'white' : '#0e1525',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            whiteSpace: 'pre-line', lineHeight: 1.3, letterSpacing: '0.04em',
            minHeight: 60, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>โปรโตคอล MARCH</div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
        {([
          ['M', 'Massive Bleeding · เลือดออกมาก', 'ใส่สาย tourniquet · ขาซ้าย'],
          ['A', 'Airway · ทางเดินหายใจ', 'เปิดทาง · ใส่ NPA แล้ว'],
          ['R', 'Respiration · การหายใจ', 'ยังไม่ได้ตรวจ'],
          ['C', 'Circulation · ระบบไหลเวียน', 'รอการตรวจ'],
          ['H', 'Hypothermia / Head · อุณหภูมิ/ศีรษะ', 'รอการตรวจ'],
        ] as [string, string, string][]).map(([k, name, note]) => {
          const on = march[k];
          return (
            <button key={k} onClick={() => setMarch(m => ({ ...m, [k]: !on }))} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: on ? '#d1fae5' : '#ffffff',
              border: on ? '1px solid #059669' : '1px solid #e3e7ee',
              borderRadius: 10, textAlign: 'left', width: '100%', cursor: 'pointer',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: on ? '#059669' : '#F2F2F7',
                color: on ? 'white' : '#677489',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
              }}>{k}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: '#0e1525', fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 11, color: '#677489', marginTop: 1 }}>{note}</div>
              </div>
              {on && <Icon name="check" size={16} color="#059669" />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={{ flex: 1, padding: '10px 0', background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, color: '#0e1525', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Icon name="camera" size={14} /> ถ่ายภาพ
        </button>
        <button style={{ flex: 1, padding: '10px 0', background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, color: '#0e1525', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Icon name="file" size={14} /> MIST
        </button>
      </div>

      <button onClick={onSubmit} style={{
        width: '100%', padding: '14px 0',
        background: '#0891b2', color: 'white',
        border: 0, borderRadius: 12,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 4px 12px rgba(8, 145, 178, 0.25)',
      }}>
        <Icon name="check" size={16} color="white" />
        ส่งการคัดแยก · {level}
      </button>
      <div style={{ fontSize: 10.5, color: '#677489', marginTop: 8, textAlign: 'center' }}>บันทึก PATIENT_TRIAGED · ตรวจ HOSPITAL_GATE</div>
    </div>
  );
}

function CheckInScreen({ pos }: { pos: { lat: string; lng: string } }) {
  return (
    <div>
      <div style={{ padding: '10px 12px', background: '#e0f6fc', border: '1px solid rgba(8, 145, 178, 0.25)', borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>ทีมของคุณ</div>
        <div style={{ fontSize: 15, color: '#0e1525', fontWeight: 600, marginTop: 2 }}>Medical Alpha · MED-ALPHA-001</div>
        <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>พบ.ราชองค์เสนา มพ. · ร.ท. วัสนา จ.</div>
      </div>

      <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>สถานะ</div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'available', label: 'พร้อมใช้งาน', color: '#059669' },
          { id: 'deployed', label: 'กำลังเดินทาง', color: '#0891b2', active: true },
          { id: 'on_scene', label: 'ถึงที่เกิดเหตุ', color: '#b45309' },
          { id: 'completed', label: 'เสร็จสิ้น', color: '#475569' },
        ].map(s => (
          <button key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            background: s.active ? `${s.color}1a` : '#ffffff',
            border: s.active ? `1px solid ${s.color}` : '1px solid #e3e7ee',
            borderRadius: 10, textAlign: 'left', cursor: 'pointer', width: '100%',
          }}>
            <span style={{ width: 8, height: 8, background: s.color, borderRadius: 50 }} />
            <span style={{ flex: 1, fontSize: 13, color: s.active ? s.color : '#0e1525', fontWeight: s.active ? 600 : 500 }}>{s.label}</span>
            {s.active && <Icon name="check" size={14} color={s.color} />}
          </button>
        ))}
      </div>

      <div style={{ padding: 12, background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="pin" size={14} color="#0891b2" />
          <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>จับพิกัด GPS</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#0e1525', fontWeight: 600 }}>{pos.lat}°N · {pos.lng}°E</div>
        <div style={{ fontSize: 11, color: '#677489', marginTop: 2 }}>แม่นยำ ±4 ม. · SITE-B โรงเรียนวัดไก่เตี้ย</div>
      </div>

      <button style={{ width: '100%', padding: '14px 0', background: '#0891b2', color: 'white', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(8, 145, 178, 0.25)', cursor: 'pointer' }}>
        <Icon name="check" size={16} color="white" /> ส่ง Check-in
      </button>
    </div>
  );
}

function SupplyScreen() {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>รายการที่ต้องการ</div>
      <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, marginBottom: 12, color: '#0e1525', fontSize: 14, fontWeight: 500 }}>เลือด O-neg</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>จำนวน</div>
          <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e3e7ee', borderRadius: 10, color: '#0e1525', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>12 ยูนิต</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>ลำดับความสำคัญ</div>
          <div style={{ padding: '12px 14px', background: '#fee2e2', border: '1px solid #dc2626', borderRadius: 10, color: '#dc2626', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>ด่วนมาก</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#677489', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 6, fontWeight: 600 }}>โหมดการขนส่ง</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'drone', icon: 'drone', label: 'โดรน', active: true },
          { id: 'boat', icon: 'boat', label: 'เรือ' },
          { id: 'vehicle', icon: 'truck', label: 'รถ' },
          { id: 'manual', icon: 'user', label: 'เดินส่ง' },
        ].map(m => (
          <button key={m.id} style={{
            padding: '12px 4px',
            background: m.active ? '#ede9fe' : '#ffffff',
            border: m.active ? '1px solid #7c3aed' : '1px solid #e3e7ee',
            borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: m.active ? '#7c3aed' : '#475569', cursor: 'pointer',
          }}>
            <Icon name={m.icon} size={20} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{m.label}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 12, background: '#e0f6fc', border: '1px solid rgba(8, 145, 178, 0.25)', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="shield" size={14} color="#0891b2" />
          <div style={{ fontSize: 11.5, color: '#0891b2', fontWeight: 700 }}>ตรวจด่านเส้นทางอัตโนมัติ</div>
        </div>
        <div style={{ fontSize: 11.5, color: '#475569' }}>สะพานปิด · เปิดเส้นทาง UAV ผ่าน · ETA 14 นาที</div>
      </div>

      <button style={{ width: '100%', padding: '14px 0', background: '#0891b2', color: 'white', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(8, 145, 178, 0.25)', cursor: 'pointer' }}>
        <Icon name="arrow" size={16} color="white" /> ส่งคำขอสนับสนุน
      </button>
    </div>
  );
}

function InboxScreen({ data }: { data: Data }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {data.field_inbox.map((msg: any) => {
        const sevColor = msg.severity === 'critical' ? '#dc2626' : msg.severity === 'warning' ? '#b45309' : '#0891b2';
        const sevBg = msg.severity === 'critical' ? '#fee2e2' : msg.severity === 'warning' ? '#fef3c7' : '#ffffff';
        const sevBorder = msg.severity === 'critical' ? 'rgba(220, 38, 38, 0.3)' : msg.severity === 'warning' ? 'rgba(180, 83, 9, 0.3)' : '#e3e7ee';
        return (
          <div key={msg.id} style={{
            padding: 12,
            background: sevBg,
            border: `1px solid ${sevBorder}`,
            borderLeft: `3px solid ${sevColor}`,
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10.5, color: sevColor, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}>{msg.from}</div>
              <div style={{ fontSize: 10, color: '#677489', fontFamily: 'var(--font-mono)' }}>{msg.time}</div>
            </div>
            <div style={{ fontSize: 13, color: '#0e1525', fontWeight: 600, marginBottom: 4, lineHeight: 1.35 }}>{msg.title}</div>
            <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.45 }}>{msg.body}</div>
            {!msg.ack && (
              <button style={{ marginTop: 10, width: '100%', padding: '9px 0', background: sevColor, color: 'white', border: 0, borderRadius: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer' }}>
                ตอบรับ
              </button>
            )}
            {msg.ack && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#059669', fontWeight: 600 }}>
                <Icon name="check" size={12} color="#059669" /> ตอบรับแล้ว
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
