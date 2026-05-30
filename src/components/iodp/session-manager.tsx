'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from './icon';

const LocationPickerMap = dynamic(() => import('./location-picker-map'), { ssr: false });
import { createClient } from '@/lib/supabase/client';
import {
  createSession, updateSessionStatus, deleteSession,
  addSite, deleteSite, addTeam, deleteTeam,
  lookupPostalCode,
} from '@/lib/iodp/supabase';
import type { IodpSession, IodpSite, IodpTeam } from '@/lib/iodp/types';


/* ─── Styles shortcuts ─────────────────────────────────────── */
const card = {
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '14px 16px',
} as const;

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border-strong)', background: 'var(--bg-1)',
  color: 'var(--text-1)', fontSize: 12, fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

const labelStyle = { fontSize: 11, color: 'var(--text-3)', marginBottom: 4, display: 'block' };

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--green)', planned: 'var(--cyan)', paused: 'var(--amber)',
  completed: 'var(--text-3)', cancelled: 'red',
};
const STATUS_TH: Record<string, string> = {
  active: 'กำลังดำเนินการ', planned: 'วางแผนแล้ว', paused: 'หยุดชั่วคราว',
  completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};
const MODE_TH: Record<string, string> = { operation: 'ปฏิบัติการ', drill: 'ฝึก' };
const SITE_TYPE_TH: Record<string, string> = {
  incident: 'จุดเกิดเหตุ', facility: 'โรงพยาบาล / สถานพยาบาล',
  ccp: 'จุดรวมผู้ป่วย (CCP)', lz: 'ลานจอดอากาศยาน (LZ)',
  uav: 'UAV / โดรน', team: 'ตำแหน่งทีม',
};

/* ─── Main Component ───────────────────────────────────────── */
export function SessionManager({ fireEvent }: { fireEvent: (e: any) => void }) {
  const [sessions, setSessions] = useState<IodpSession[]>([]);
  const [selected, setSelected] = useState<IodpSession | null>(null);
  const [sites, setSites] = useState<IodpSite[]>([]);
  const [teams, setTeams] = useState<IodpTeam[]>([]);
  const [tab, setTab] = useState<'sessions' | 'sites' | 'teams'>('sessions');
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('iodp_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, []);

  const loadSessionData = useCallback(async (sess: IodpSession) => {
    const supabase = createClient();
    const [s, t] = await Promise.all([
      supabase.from('iodp_sites').select('*').eq('session_id', sess.id).order('site_code'),
      supabase.from('iodp_teams').select('*').eq('session_id', sess.id).order('team_code'),
    ]);
    setSites(s.data ?? []);
    setTeams(t.data ?? []);
  }, []);

  useEffect(() => { loadSessions(); }, []);

  const selectSession = (sess: IodpSession) => {
    setSelected(sess);
    setTab('sites');
    loadSessionData(sess);
  };

  const handleStatusChange = async (sess: IodpSession, status: string) => {
    const err = await updateSessionStatus(sess.id, status);
    if (!err) {
      fireEvent({ severity: 'info', title: 'SESSION_UPDATED', body: `${sess.code} → ${STATUS_TH[status]}` });
      loadSessions();
      if (selected?.id === sess.id) setSelected({ ...sess, status });
    }
  };

  const handleDeleteSession = async (sess: IodpSession) => {
    if (!confirm(`ลบสถานการณ์ "${sess.code}" และข้อมูลทั้งหมด?`)) return;
    setDeleting(sess.id);
    const err = await deleteSession(sess.id);
    if (!err) {
      if (selected?.id === sess.id) { setSelected(null); setTab('sessions'); }
      loadSessions();
    }
    setDeleting(null);
  };

  const handleDeleteSite = async (site: IodpSite) => {
    if (!confirm(`ลบจุด "${site.site_code}"?`)) return;
    await deleteSite(site.id);
    if (selected) loadSessionData(selected);
  };

  const handleDeleteTeam = async (team: IodpTeam) => {
    if (!confirm(`ลบทีม "${team.team_code}"?`)) return;
    await deleteTeam(team.id);
    if (selected) loadSessionData(selected);
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin · จัดการสถานการณ์</div>
          <h1>สถานการณ์ (IODP Sessions)</h1>
          <div className="sub">สร้าง แก้ไข และบริหารสถานการณ์ปฏิบัติการและการฝึก</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowCreateSession(true)}>
            <Icon name="plus" size={14} /> สร้างสถานการณ์ใหม่
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel" style={{ padding: 0 }}>
        <div className="tabs" style={{ padding: '0 16px' }}>
          {([
            ['sessions', 'สถานการณ์ทั้งหมด', sessions.length],
            ['sites', 'จุดปฏิบัติการ', selected ? sites.length : null],
            ['teams', 'ทีม', selected ? teams.length : null],
          ] as const).map(([id, lbl, cnt]) => (
            <button
              key={id}
              className={'tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
              disabled={id !== 'sessions' && !selected}
              style={{ opacity: id !== 'sessions' && !selected ? 0.4 : 1 }}
            >
              {lbl}
              {cnt !== null && <span className="badge" style={{ marginLeft: 6 }}>{cnt}</span>}
            </button>
          ))}
        </div>

        <div className="panel-body" style={{ padding: 16 }}>

          {/* ── Sessions Tab ── */}
          {tab === 'sessions' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>กำลังโหลด…</div>}
              {!loading && sessions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                  <Icon name="target" size={36} color="var(--text-4)" />
                  <div style={{ marginTop: 12, fontSize: 13 }}>ยังไม่มีสถานการณ์</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>กด "สร้างสถานการณ์ใหม่" เพื่อเริ่มต้น</div>
                </div>
              )}
              {sessions.map(sess => (
                <div
                  key={sess.id}
                  style={{
                    ...card,
                    cursor: 'pointer',
                    border: selected?.id === sess.id ? '1px solid var(--cyan)' : '1px solid var(--border)',
                    background: selected?.id === sess.id ? 'rgba(8,145,178,0.05)' : 'var(--bg-2)',
                  }}
                  onClick={() => selectSession(sess)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                      background: STATUS_COLOR[sess.status] ?? 'var(--text-3)',
                      boxShadow: sess.status === 'active' ? `0 0 8px ${STATUS_COLOR.active}` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{sess.code}</span>
                        <span className={`badge ${sess.mode === 'operation' ? 'cyan' : 'magenta'}`}>{MODE_TH[sess.mode]}</span>
                        <span className="badge">{STATUS_TH[sess.status] ?? sess.status}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{sess.title_th}</div>
                      {sess.title_en && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{sess.title_en}</div>}
                      {sess.scenario_type && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{sess.scenario_type}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {/* Status quick actions */}
                      {sess.status === 'planned' && (
                        <button className="btn sm" onClick={() => handleStatusChange(sess, 'active')} title="เริ่มดำเนินการ">
                          <Icon name="play" size={12} /> เริ่ม
                        </button>
                      )}
                      {sess.status === 'active' && (
                        <button className="btn sm" onClick={() => handleStatusChange(sess, 'paused')} title="หยุดชั่วคราว">
                          <Icon name="pause" size={12} /> หยุด
                        </button>
                      )}
                      {sess.status === 'paused' && (
                        <button className="btn sm" onClick={() => handleStatusChange(sess, 'active')} title="ดำเนินการต่อ">
                          <Icon name="play" size={12} /> ต่อ
                        </button>
                      )}
                      {['active', 'paused'].includes(sess.status) && (
                        <button className="btn sm" onClick={() => handleStatusChange(sess, 'completed')} title="จบสถานการณ์">
                          <Icon name="check" size={12} /> จบ
                        </button>
                      )}
                      <button
                        className="btn sm danger"
                        onClick={() => handleDeleteSession(sess)}
                        disabled={deleting === sess.id}
                        title="ลบสถานการณ์"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    <span>📍 {sess.center_lat.toFixed(4)}, {sess.center_lng.toFixed(4)}</span>
                    {sess.op_period && <span>ห้วง: {sess.op_period}</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      {new Date(sess.created_at ?? '').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Sites Tab ── */}
          {tab === 'sites' && selected && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  จุดปฏิบัติการของ <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selected.code}</span>
                </div>
                <button className="btn sm primary" onClick={() => setShowAddSite(true)}>
                  <Icon name="plus" size={12} /> เพิ่มจุด
                </button>
              </div>
              {sites.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  ยังไม่มีจุดปฏิบัติการ — กด "เพิ่มจุด" เพื่อเริ่ม
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {sites.map(site => (
                  <div key={site.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      <Icon name={site.type === 'facility' ? 'hospital' : site.type === 'incident' ? 'incident' : site.type === 'lz' ? 'helicopter' : site.type === 'uav' ? 'drone' : 'pin'} size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{site.site_code}</span>
                        <span className="badge">{SITE_TYPE_TH[site.type] ?? site.type}</span>
                        {site.status && <span className="badge" style={{ background: site.status === 'active' ? 'var(--green-bg)' : 'var(--bg-3)', color: site.status === 'active' ? 'var(--green)' : 'var(--text-3)' }}>{site.status}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2 }}>{site.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
                        {site.capacity ? ` · ขีดความสามารถ ${site.current_load}/${site.capacity}` : ''}
                      </div>
                    </div>
                    <button className="btn sm danger" onClick={() => handleDeleteSite(site)} title="ลบจุด">
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Teams Tab ── */}
          {tab === 'teams' && selected && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  ทีมของ <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selected.code}</span>
                </div>
                <button className="btn sm primary" onClick={() => setShowAddTeam(true)}>
                  <Icon name="plus" size={12} /> เพิ่มทีม
                </button>
              </div>
              {teams.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  ยังไม่มีทีม — กด "เพิ่มทีม" เพื่อเริ่ม
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {teams.map(team => (
                  <div key={team.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      <Icon name={team.type === 'boat' ? 'boat' : team.type === 'drone' ? 'drone' : team.type === 'helicopter' ? 'helicopter' : team.type === 'medical' ? 'hospital' : 'user'} size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{team.team_code}</span>
                        {team.type && <span className="badge">{team.type}</span>}
                        <span className="badge" style={{ background: team.status === 'active' || team.status === 'on_scene' ? 'var(--green-bg)' : 'var(--bg-3)', color: team.status === 'active' || team.status === 'on_scene' ? 'var(--green)' : 'var(--text-3)' }}>{team.status}</span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2 }}>{team.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {team.personnel} นาย · ความพร้อม {team.readiness}%
                        {team.meta?.capability ? ` · ${team.meta.capability}` : ''}
                      </div>
                    </div>
                    <button className="btn sm danger" onClick={() => handleDeleteTeam(team)} title="ลบทีม">
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      {showCreateSession && (
        <CreateSessionModal
          onClose={() => setShowCreateSession(false)}
          onCreated={() => { setShowCreateSession(false); loadSessions(); }}
          fireEvent={fireEvent}
        />
      )}
      {showAddSite && selected && (
        <AddSiteModal
          session={selected}
          onClose={() => setShowAddSite(false)}
          onAdded={() => { setShowAddSite(false); loadSessionData(selected); }}
        />
      )}
      {showAddTeam && selected && (
        <AddTeamModal
          session={selected}
          onClose={() => setShowAddTeam(false)}
          onAdded={() => { setShowAddTeam(false); loadSessionData(selected); }}
        />
      )}
    </div>
  );
}

/* ─── Place Search (OpenStreetMap Nominatim — no API key) ──── */
type NominatimResult = { display_name: string; lat: string; lon: string; address?: Record<string, string> };

function PlaceSearchInput({ onPlaceSelect }: {
  onPlaceSelect: (lat: number, lng: number, postalCode?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(onPlaceSelect);
  useEffect(() => { callbackRef.current = onPlaceSelect; });

  const search = useCallback((q: string) => {
    clearTimeout(timer.current);
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=th&limit=6&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'th,en' } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 450);
  }, []);

  const handleSelect = (item: NominatimResult) => {
    const postal = item.address?.postcode;
    callbackRef.current(parseFloat(item.lat), parseFloat(item.lon), postal);
    setQuery(item.display_name.split(',')[0].trim());
    setOpen(false);
    setResults([]);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingLeft: 34 }}
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="ค้นหาสถานที่… เช่น สะพานสิรินธร กรุงเทพ"
          autoComplete="off"
        />
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          {loading
            ? <span style={{ fontSize: 10, color: 'var(--text-3)' }}>⏳</span>
            : <Icon name="search" size={13} color="var(--text-3)" />}
        </div>
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 100001, background: 'var(--bg-1)',
          border: '1px solid var(--border-strong)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
          {results.map((r, i) => {
            const parts = r.display_name.split(',').map(s => s.trim());
            return (
              <button
                key={i} type="button"
                onMouseDown={() => handleSelect(r)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border-soft)' : 'none',
                  background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-1)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Icon name="pin" size={12} color="var(--cyan)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{parts[0]}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{parts.slice(1, 4).join(', ')}</div>
                </div>
              </button>
            );
          })}
          <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text-4)', borderTop: '1px solid var(--border-soft)' }}>
            © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Create Session Modal ─────────────────────────────────── */
function CreateSessionModal({ onClose, onCreated, fireEvent }: {
  onClose: () => void; onCreated: () => void; fireEvent: (e: any) => void;
}) {
  const [form, setForm] = useState({
    code: '', title_th: '', title_en: '', mode: 'operation' as 'operation' | 'drill',
    scenario_type: '', op_period: 'OP-1',
    center_lat: '13.7775', center_lng: '100.4582',
    postal_code: '', province: '', district: '',
    command_mode: 'JOINT', lead_org: '', response_level: 'REGIONAL',
  });
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [postalLoading, setPostalLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsTrigger, setGpsTrigger] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  /* Postal code → province / district auto-fill */
  useEffect(() => {
    const code = form.postal_code;
    if (!/^\d{5}$/.test(code)) {
      // Clear when editing (not 5 digits yet)
      setDistrictOptions([]);
      setForm(f => ({ ...f, province: '', district: '' }));
      return;
    }
    let active = true;
    setPostalLoading(true);
    lookupPostalCode(code).then(rows => {
      if (!active) return;
      if (rows.length > 0) {
        const districts = rows.map(r => r.district_th);
        setForm(f => ({
          ...f,
          province: rows[0].province_th,
          district: districts.length === 1 ? districts[0] : '',
        }));
        setDistrictOptions(districts);
      } else {
        setDistrictOptions([]);
      }
      setPostalLoading(false);
    });
    return () => { active = false; };
  }, [form.postal_code]);

  /* Map click / drag → lat/lng */
  const handleMapMove = useCallback((lat: number, lng: number) => {
    setForm(f => ({ ...f, center_lat: lat.toFixed(6), center_lng: lng.toFixed(6) }));
  }, []);

  /* Nominatim place select → lat/lng + maybe postal code */
  const handlePlaceSelect = useCallback((lat: number, lng: number, postalCode?: string) => {
    setForm(f => ({
      ...f,
      center_lat: lat.toFixed(6),
      center_lng: lng.toFixed(6),
      ...(postalCode ? { postal_code: postalCode } : {}),
    }));
    setGpsTrigger(t => t + 1);
  }, []);

  /* GPS → lat/lng + fly map */
  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          center_lat: pos.coords.latitude.toFixed(6),
          center_lng: pos.coords.longitude.toFixed(6),
        }));
        setGpsTrigger(t => t + 1);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.title_th) { setError('กรุณากรอก รหัส และ ชื่อสถานการณ์'); return; }
    setSaving(true); setError('');
    const { error: err } = await createSession({
      code: form.code.toUpperCase(),
      title_th: form.title_th,
      title_en: form.title_en || undefined,
      mode: form.mode,
      scenario_type: form.scenario_type || undefined,
      op_period: form.op_period || undefined,
      center_lat: parseFloat(form.center_lat) || 13.7775,
      center_lng: parseFloat(form.center_lng) || 100.4582,
      meta: {
        command_mode: form.command_mode,
        lead_org: form.lead_org,
        response_level: form.response_level,
        ...(form.postal_code ? { postal_code: form.postal_code } : {}),
        ...(form.province ? { province: form.province } : {}),
        ...(form.district ? { district: form.district } : {}),
      },
    });
    if (err) { setError(err.message); setSaving(false); return; }
    fireEvent({ severity: 'info', title: 'SESSION_CREATED', body: `${form.code} · ${form.title_th}` });
    onCreated();
  };

  return (
    <Modal title="สร้างสถานการณ์ใหม่" onClose={onClose} width={580}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        {/* ── Basic info ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="รหัสสถานการณ์ *">
            <input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="INC-2026-0999" required />
          </Field>
          <Field label="โหมด *">
            <select style={inputStyle} value={form.mode} onChange={e => set('mode', e.target.value as any)}>
              <option value="operation">ปฏิบัติการ (Operation)</option>
              <option value="drill">ฝึก (Drill)</option>
            </select>
          </Field>
        </div>

        <Field label="ชื่อสถานการณ์ (ภาษาไทย) *">
          <input style={inputStyle} value={form.title_th} onChange={e => set('title_th', e.target.value)} placeholder="น้ำท่วม + MCI ตลิ่งชัน" required />
        </Field>

        <Field label="ชื่อสถานการณ์ (ภาษาอังกฤษ)">
          <input style={inputStyle} value={form.title_en} onChange={e => set('title_en', e.target.value)} placeholder="Flood + MCI Taling Chan" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="ประเภทสถานการณ์">
            <input style={inputStyle} value={form.scenario_type} onChange={e => set('scenario_type', e.target.value)} placeholder="Flood / Mass Casualty" />
          </Field>
          <Field label="ห้วงปฏิบัติการ">
            <input style={inputStyle} value={form.op_period} onChange={e => set('op_period', e.target.value)} placeholder="OP-1" />
          </Field>
        </div>

        {/* ── Location ── */}
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            ตำแหน่งศูนย์กลาง
          </div>

          {/* Postal code */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: 12 }}>
              📮 รหัสไปรษณีย์{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>กรอก 5 หลัก → จังหวัด/อำเภอ auto-fill อัตโนมัติ</span>
              {postalLoading && <span style={{ color: 'var(--cyan)', marginLeft: 6 }}>⏳</span>}
            </label>
            <input
              style={inputStyle}
              value={form.postal_code}
              onChange={e => set('postal_code', e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="เช่น 10400"
              maxLength={5}
              inputMode="numeric"
            />
          </div>

          {/* Province + District */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, marginTop: 10 }}>
            <Field label="จังหวัด *">
              <input
                style={inputStyle}
                value={form.province}
                onChange={e => set('province', e.target.value)}
                placeholder="— เลือกจังหวัด —"
              />
            </Field>
            <Field label="อำเภอ / พื้นที่">
              {districtOptions.length > 1 ? (
                <select style={inputStyle} value={form.district} onChange={e => set('district', e.target.value)}>
                  <option value="">— เลือกอำเภอ —</option>
                  {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input
                  style={inputStyle}
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                  placeholder="ระบุอำเภอหรือพื้นที่"
                />
              )}
            </Field>
          </div>

          {/* Place name search */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: 12 }}>
              🔍 ค้นหาชื่อสถานที่{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>พิมพ์ชื่อ → เลือก → pin เลื่อนอัตโนมัติ</span>
            </label>
            <PlaceSearchInput onPlaceSelect={handlePlaceSelect} />
          </div>

          {/* Map */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: 12 }}>
              📍 พิกัดจุดเกิดเหตุ{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>คลิกบนแผนที่ / ลาก marker / กด GPS</span>
            </label>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
              <LocationPickerMap
                lat={parseFloat(form.center_lat) || 13.7775}
                lng={parseFloat(form.center_lng) || 100.4582}
                onMove={handleMapMove}
                flyTrigger={gpsTrigger}
                height={260}
              />
            </div>
          </div>

          {/* GPS button + coordinate display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 8,
                border: 'none', cursor: locating ? 'wait' : 'pointer',
                background: locating ? 'var(--bg-3)' : '#2563eb',
                color: 'white', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600, flexShrink: 0,
              }}
            >
              <Icon name="pin" size={14} color="white" />
              {locating ? 'กำลังดึง GPS…' : 'GPS อัตโนมัติ'}
            </button>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
              background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
            }}>
              {parseFloat(form.center_lat).toFixed(5)}°N, {parseFloat(form.center_lng).toFixed(5)}°E
            </span>
          </div>
        </div>

        {/* ── Command ── */}
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            ข้อมูลการบัญชาการ
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="รูปแบบบัญชาการ">
              <select style={inputStyle} value={form.command_mode} onChange={e => set('command_mode', e.target.value)}>
                <option value="JOINT">JOINT — ร่วม</option>
                <option value="UNIFIED">UNIFIED — เอกภาพ</option>
                <option value="SINGLE">SINGLE — เดี่ยว</option>
              </select>
            </Field>
            <Field label="ระดับการตอบสนอง">
              <select style={inputStyle} value={form.response_level} onChange={e => set('response_level', e.target.value)}>
                <option value="LOCAL">LOCAL</option>
                <option value="REGIONAL">REGIONAL</option>
                <option value="NATIONAL">NATIONAL</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="หน่วยงานนำ">
              <input style={inputStyle} value={form.lead_org} onChange={e => set('lead_org', e.target.value)} placeholder="Bangkok EOC + Royal Thai Army Medical" />
            </Field>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'กำลังสร้าง…' : <><Icon name="plus" size={13} /> สร้างสถานการณ์</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Add Site Modal ───────────────────────────────────────── */
function AddSiteModal({ session, onClose, onAdded }: { session: IodpSession; onClose: () => void; onAdded: () => void; }) {
  const [form, setForm] = useState({
    site_code: '', name: '', type: 'incident' as IodpSite['type'],
    lat: session.center_lat.toString(), lng: session.center_lng.toString(), capacity: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const err = await addSite({
      session_id: session.id,
      site_code: form.site_code.toUpperCase(),
      name: form.name,
      type: form.type,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
    });
    if (!err) onAdded();
    setSaving(false);
  };

  return (
    <Modal title={`เพิ่มจุดปฏิบัติการ · ${session.code}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="รหัสจุด *">
            <input style={inputStyle} value={form.site_code} onChange={e => set('site_code', e.target.value)} placeholder="SITE-A" required />
          </Field>
          <Field label="ประเภท *">
            <select style={inputStyle} value={form.type} onChange={e => set('type', e.target.value as any)}>
              {Object.entries(SITE_TYPE_TH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="ชื่อ *">
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="จุดเกิดเหตุหลัก" required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Latitude">
            <input style={inputStyle} type="number" step="0.00001" value={form.lat} onChange={e => set('lat', e.target.value)} required />
          </Field>
          <Field label="Longitude">
            <input style={inputStyle} type="number" step="0.00001" value={form.lng} onChange={e => set('lng', e.target.value)} required />
          </Field>
          <Field label="ขีดความสามารถ">
            <input style={inputStyle} type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="ไม่จำกัด" />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : <><Icon name="pin" size={13} /> เพิ่มจุด</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Add Team Modal ───────────────────────────────────────── */
function AddTeamModal({ session, onClose, onAdded }: { session: IodpSession; onClose: () => void; onAdded: () => void; }) {
  const [form, setForm] = useState({
    team_code: '', name: '', type: 'medical',
    personnel: '', capability: '', org: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const err = await addTeam({
      session_id: session.id,
      team_code: form.team_code.toUpperCase(),
      name: form.name,
      type: form.type || undefined,
      personnel: parseInt(form.personnel) || 0,
      meta: { capability: form.capability, org: form.org },
    });
    if (!err) onAdded();
    setSaving(false);
  };

  return (
    <Modal title={`เพิ่มทีม · ${session.code}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="รหัสทีม *">
            <input style={inputStyle} value={form.team_code} onChange={e => set('team_code', e.target.value)} placeholder="MED-ALPHA" required />
          </Field>
          <Field label="ประเภท">
            <select style={inputStyle} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="medical">Medical</option>
              <option value="boat">Boat Rescue</option>
              <option value="drone">UAV / โดรน</option>
              <option value="helicopter">HEMS / เฮลิคอปเตอร์</option>
              <option value="truck">Logistics / รถ</option>
              <option value="safety">Safety Officer</option>
              <option value="controller">Controller</option>
              <option value="evaluator">Evaluator</option>
              <option value="unit">หน่วยทั่วไป</option>
            </select>
          </Field>
        </div>
        <Field label="ชื่อทีม *">
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Medical Alpha" required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="กำลังพล (นาย)">
            <input style={inputStyle} type="number" value={form.personnel} onChange={e => set('personnel', e.target.value)} placeholder="0" />
          </Field>
          <Field label="หน่วยงาน">
            <input style={inputStyle} value={form.org} onChange={e => set('org', e.target.value)} placeholder="RTA Medical" />
          </Field>
        </div>
        <Field label="ขีดความสามารถ">
          <input style={inputStyle} value={form.capability} onChange={e => set('capability', e.target.value)} placeholder="MCI Triage, Advanced Trauma" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : <><Icon name="user" size={13} /> เพิ่มทีม</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Helper components ────────────────────────────────────── */
function Modal({ title, onClose, children, width = 480 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', zIndex: 10000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width, maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-soft)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
            display: 'grid', placeItems: 'center', padding: 4,
          }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, placeholder }: { label: string; children: React.ReactNode; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
