'use client';
import React from 'react';
import { Icon } from './icon';

const STATUS_LABELS_TH: Record<string, string> = {
  active: 'พร้อมใช้งาน', live: 'สด', on_scene: 'ถึงที่เกิดเหตุ', en_route: 'กำลังเดินทาง',
  pending: 'รอ', queued: 'ในคิว', divert: 'เบี่ยง', warning: 'เตือน',
  critical: 'วิกฤต', blocked: 'ถูกบล็อก', failed: 'ไม่ผ่าน', overload: 'เกินรับ', full: 'เต็ม',
  passed: 'ผ่าน', accept: 'รับ', completed: 'เสร็จสิ้น', ok: 'ปกติ',
  drill: 'ฝึก', paused: 'หยุดพัก', info: 'ข้อมูล', inactive: 'ไม่พร้อม',
  waived: 'ยกเว้น', available: 'พร้อม', acknowledged: 'ตอบรับแล้ว', pushed: 'ส่งแล้ว',
  triaged: 'คัดแยกแล้ว',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  active: 'cyan', live: 'cyan', on_scene: 'cyan', en_route: 'cyan',
  pending: 'amber', queued: 'amber', divert: 'amber', warning: 'amber',
  critical: 'red', blocked: 'red', failed: 'red', overload: 'red', full: 'red',
  passed: 'green', accept: 'green', completed: 'green', ok: 'green', acknowledged: 'green',
  drill: 'magenta', paused: 'magenta', pushed: 'cyan',
  info: 'gray', inactive: 'gray', waived: 'gray', available: 'gray', triaged: 'cyan',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = (status || '').toLowerCase();
  const color = STATUS_COLOR_MAP[key] || 'gray';
  return (
    <span className={`badge ${color}`}>
      <span className="dot" />
      {label || STATUS_LABELS_TH[key] || status}
    </span>
  );
}

export function Triage({ level }: { level: string }) {
  const cls = (level || '').toLowerCase();
  return <span className={`triage ${cls}`}>{level}</span>;
}

export function Readiness({ percent }: { percent: number }) {
  const pct = Number(percent) || 0;
  const filled = Math.round(pct / 25);
  const bars = [0, 1, 2, 3].map(i => {
    const on = i < filled;
    const tone = pct >= 75 ? 'on' : pct >= 50 ? 'warn' : pct >= 25 ? 'warn' : 'bad';
    return <i key={i} className={on ? tone : ''} />;
  });
  return (
    <span className="readiness">
      <span className="bars">{bars}</span>
      <span>{pct}%</span>
    </span>
  );
}

export function SafetyGate({ status, code }: { status: string; code: string }) {
  const map: Record<string, string> = { passed: 'green', pending: 'amber', failed: 'red', waived: 'gray', critical: 'red' };
  const c = map[status] || 'gray';
  return (
    <span className={`badge ${c}`}>
      <Icon name="shield" size={11} />
      {code}
    </span>
  );
}

export function Metric({ label, value, unit, footer, tone, icon }: {
  label: string; value: string | number; unit?: string; footer?: string; tone?: string; icon?: string;
}) {
  return (
    <div className={`metric ${tone || ''}`}>
      <div className="label">
        {icon && <Icon name={icon} size={12} />}
        {label}
      </div>
      <div className="value">
        <span>{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {footer && <div className="footer">{footer}</div>}
    </div>
  );
}

export function Panel({ title, count, actions, children, flush, style, className }: {
  title?: string; count?: number; actions?: React.ReactNode; children: React.ReactNode;
  flush?: boolean; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`panel ${className || ''}`} style={style}>
      {(title || actions) && (
        <div className="panel-head">
          <h3>{title}{count != null && <span className="count">{count}</span>}</h3>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className={`panel-body${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  );
}

export function EventRow({ time, code, actor, target, severity, flagged }: {
  time: string; code: string; actor?: string; target?: string; severity?: string; flagged?: boolean;
}) {
  const sev = (severity || 'info').toLowerCase();
  const dotColor = sev === 'critical' ? 'var(--red)' : sev === 'warning' ? 'var(--amber)' : 'var(--cyan)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 12px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{time}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <span style={{ width: 7, height: 7, borderRadius: 50, background: dotColor, marginTop: 5, display: 'block', boxShadow: `0 0 6px ${dotColor}` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-1)', fontWeight: 600 }}>{code}</span>
          {flagged && <span className="badge red"><span className="dot" />ละเมิดความปลอดภัย</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {actor && <span style={{ color: 'var(--text-1)' }}>{actor}</span>}
          {actor && target && ' → '}
          {target}
        </div>
      </div>
    </div>
  );
}

export function KV({ pairs }: { pairs: [string, React.ReactNode][] }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {pairs.map(([k, v], i) => (
        <div key={i} className="between" style={{ paddingBottom: 6, borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
          <div style={{ fontSize: 12.5, textAlign: 'right' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
