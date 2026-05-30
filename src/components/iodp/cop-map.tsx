'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Icon } from './icon';

interface Site {
  id: string;
  lat?: number; lng?: number;
  /* legacy SVG fields */
  x?: number; y?: number;
  type: string; status?: string; name?: string; site_code?: string;
}
interface PatientMarker { lat?: number; lng?: number; x?: number; y?: number; lvl: string; triage_level?: string; }

interface COPMapProps {
  data: { sites: Site[]; patient_markers?: PatientMarker[]; patients?: PatientMarker[] };
  onMarkerClick?: (id: string) => void;
  selected?: string | null;
  showLabels?: boolean;
  height?: number;
  drillMode?: boolean;
}

const BANGKOK_CENTER = { lat: 13.7775, lng: 100.4582 };
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

const TRIAGE_COLORS: Record<string, string> = {
  P1: '#dc2626', p1: '#dc2626',
  P2: '#d97706', p2: '#d97706',
  P3: '#059669', p3: '#059669',
  BLACK: '#475569', black: '#475569',
};

const SITE_COLORS: Record<string, string> = {
  facility: '#059669', incident: '#dc2626', ccp: '#d97706',
  lz: '#059669', uav: '#7c3aed', team: '#0891b2',
};

export function COPMap({ data, onMarkerClick, selected, showLabels = true, height = 480, drillMode = false }: COPMapProps) {
  const sites: Site[] = (data?.sites || []).map((s, i) => ({
    ...s,
    id: s.id || s.site_code || String(i),
    lat: s.lat ?? svgToLat(s.y ?? 35),
    lng: s.lng ?? svgToLng(s.x ?? 50),
  }));

  const patients: PatientMarker[] = (data?.patient_markers || data?.patients || []).map(p => ({
    ...p,
    lat: p.lat ?? svgToLat(p.y ?? 35),
    lng: p.lng ?? svgToLng(p.x ?? 50),
    lvl: p.lvl || p.triage_level || 'P3',
  }));

  if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
    return <FallbackMap sites={sites} patients={patients} onMarkerClick={onMarkerClick} selected={selected} showLabels={showLabels} height={height} drillMode={drillMode} />;
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY}>
      <div style={{ position: 'relative', height, borderRadius: 0, overflow: 'hidden' }}>
        <Map
          mapId="iodp-cop-map"
          defaultCenter={BANGKOK_CENTER}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeId="roadmap"
          style={{ width: '100%', height: '100%' }}
          styles={MAP_STYLES}
        >
          {/* Patient markers */}
          {patients.map((p, i) => (
            <AdvancedMarker key={`pat-${i}`} position={{ lat: p.lat!, lng: p.lng! }}>
              <div style={{
                width: 10, height: 10,
                background: TRIAGE_COLORS[p.lvl] || '#475569',
                borderRadius: 2,
                boxShadow: '0 0 0 2px white, 0 1px 4px rgba(0,0,0,0.3)',
                border: `2px solid ${TRIAGE_COLORS[p.lvl] || '#475569'}`,
              }} />
            </AdvancedMarker>
          ))}

          {/* Site markers */}
          {sites.map(site => (
            <SiteMarker
              key={site.id}
              site={site}
              selected={selected === site.id}
              showLabel={showLabels}
              onClick={() => onMarkerClick?.(site.id)}
              drillMode={drillMode}
            />
          ))}
        </Map>

        {/* Overlays */}
        <MapLegend drillMode={drillMode} />
        <MapHUD drillMode={drillMode} />
      </div>
    </APIProvider>
  );
}

function SiteMarker({ site, selected, onClick, showLabel, drillMode }: {
  site: Site; selected: boolean; onClick: () => void; showLabel: boolean; drillMode: boolean;
}) {
  const { type, status } = site;
  const isFacility = type === 'facility';
  const isCcp = type === 'ccp';
  const isLz = type === 'lz';
  const isUav = type === 'uav';

  let color = SITE_COLORS[type] || '#0891b2';
  let icon = 'pin';
  let shape: 'round' | 'square' | 'diamond' = 'round';

  if (isFacility) {
    color = status === 'divert' ? '#d97706' : status === 'call' ? '#dc2626' : '#059669';
    icon = 'hospital'; shape = 'square';
  } else if (type === 'incident') { color = '#dc2626'; icon = 'casualty'; }
  else if (isCcp) { color = '#d97706'; icon = 'plus'; }
  else if (isLz) { color = '#059669'; icon = 'helicopter'; shape = 'diamond'; }
  else if (isUav) { color = '#7c3aed'; icon = 'drone'; }
  else if (type === 'team') { color = drillMode ? '#7c3aed' : '#0891b2'; icon = 'user'; }

  const size = isFacility ? 28 : isCcp ? 26 : 22;
  const ping = type === 'incident' || (isFacility && status !== 'accept');

  return (
    <AdvancedMarker position={{ lat: site.lat!, lng: site.lng! }} onClick={onClick} zIndex={selected ? 20 : 10}>
      <div style={{ position: 'relative', cursor: 'pointer' }}>
        {ping && (
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            background: color, opacity: 0.18,
            animation: 'iodp-ping 2s ease-out infinite',
          }} />
        )}
        <div style={{
          width: size, height: size, background: 'white',
          border: `2px solid ${color}`,
          borderRadius: shape === 'round' ? '50%' : shape === 'diamond' ? 4 : 6,
          transform: shape === 'diamond' ? 'rotate(45deg)' : 'none',
          display: 'grid', placeItems: 'center',
          boxShadow: `0 2px 6px rgba(0,0,0,0.2), 0 0 0 ${selected ? '3px' : '0'} ${color}40`,
        }}>
          <span style={{ transform: shape === 'diamond' ? 'rotate(-45deg)' : 'none', display: 'flex' }}>
            <Icon name={icon} size={size === 28 ? 14 : 12} color={color} />
          </span>
        </div>
        {showLabel && (
          <div style={{
            position: 'absolute', top: size + 4, left: '50%',
            transform: 'translateX(-50%)', fontSize: 10,
            fontFamily: 'var(--font-mono)', color: 'var(--text-1)',
            background: 'rgba(255,255,255,0.96)', padding: '1px 6px',
            borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid var(--border)',
            fontWeight: 600, boxShadow: 'var(--shadow-sm)',
          }}>
            {site.name || site.id}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function MapLegend({ drillMode }: { drillMode: boolean }) {
  return (
    <div style={{
      position: 'absolute', bottom: 32, left: 12,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '8px 10px', display: 'flex', gap: 12, alignItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)',
      boxShadow: 'var(--shadow-sm)', fontWeight: 600, zIndex: 10,
      pointerEvents: 'none',
    }}>
      {[['#dc2626','P1'],['#d97706','P2'],['#059669','P3'],['#475569','เสียชีวิต']].map(([c,l]) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, background: c, borderRadius: 1, display: 'block' }}/>
          {l}
        </span>
      ))}
      <span style={{ borderLeft: '1px solid var(--border)', height: 10, display: 'block' }}/>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 8, height: 8, background: '#059669', borderRadius: '50%', display: 'block' }}/>โรงพยาบาล
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 8, height: 8, background: '#0891b2', borderRadius: '50%', display: 'block' }}/>ทีม/จุดเกิดเหตุ
      </span>
    </div>
  );
}

function MapHUD({ drillMode }: { drillMode: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-2)',
      boxShadow: 'var(--shadow-sm)', fontWeight: 600, zIndex: 10,
      pointerEvents: 'none',
    }}>
      <span style={{ color: 'var(--text-3)' }}>13.7775°N · 100.4582°E</span>
      <span style={{ borderLeft: '1px solid var(--border)', height: 10 }}/>
      <span>ZOOM 14</span>
      <span style={{ borderLeft: '1px solid var(--border)', height: 10 }}/>
      <span style={{ color: drillMode ? 'var(--magenta)' : 'var(--cyan)' }}>● สด</span>
    </div>
  );
}

/* ─── SVG coordinate conversion (legacy data without lat/lng) ─── */
/* SVG viewBox 0-100 x, 0-70 y → Bangkok Taling Chan bounding box */
const LNG_MIN = 100.42, LNG_MAX = 100.50;
const LAT_MAX = 13.80, LAT_MIN = 13.75;

function svgToLat(y: number) { return LAT_MAX - (y / 70) * (LAT_MAX - LAT_MIN); }
function svgToLng(x: number) { return LNG_MIN + (x / 100) * (LNG_MAX - LNG_MIN); }

/* ─── Fallback SVG map when no API key ─── */
function FallbackMap({ sites, patients, onMarkerClick, selected, showLabels, height, drillMode }: {
  sites: Site[]; patients: PatientMarker[];
  onMarkerClick?: (id: string) => void; selected?: string | null;
  showLabels: boolean; height: number; drillMode: boolean;
}) {
  /* Convert lat/lng back to SVG x/y for the static fallback */
  const toSvgX = (lng: number) => ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
  const toSvgY = (lat: number) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 70;

  return (
    <div style={{
      position: 'relative', height,
      background: 'linear-gradient(135deg, #f0f4f9 0%, #e8eef5 100%)',
      overflow: 'hidden',
    }}>
      {/* "No API key" banner */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid rgba(220,38,38,0.2)',
        padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
        color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="shield" size={12} color="#dc2626"/>
        กรุณาตั้งค่า NEXT_PUBLIC_GOOGLE_MAPS_KEY ใน .env.local เพื่อใช้ Google Maps
      </div>

      <svg viewBox="0 0 100 70" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="iodp-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(15,23,42,0.05)" strokeWidth="0.1"/>
          </pattern>
          <linearGradient id="iodp-water" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#bedfee" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#9bc7dd" stopOpacity="0.85"/>
          </linearGradient>
        </defs>
        <rect width="100" height="70" fill="url(#iodp-grid)"/>
        <path d="M 0 25 Q 15 20, 25 30 T 50 38 Q 60 42, 70 38 Q 80 36, 90 42 L 100 45 L 100 55 Q 88 50, 78 50 Q 65 52, 52 48 Q 35 42, 22 44 Q 10 46, 0 38 Z" fill="url(#iodp-water)"/>
        <g stroke="rgba(15,23,42,0.12)" strokeWidth="0.25" fill="none">
          <path d="M 0 15 L 100 18"/><path d="M 0 62 L 100 60"/>
          <path d="M 20 0 L 22 70"/><path d="M 60 0 L 62 70"/>
        </g>
        <text x="34" y="33" fill="rgba(15,23,42,0.4)" fontSize="1.4" fontFamily="monospace" textAnchor="middle">ตลิ่งชัน</text>
        <text x="76" y="20" fill="rgba(15,23,42,0.35)" fontSize="1.3" fontFamily="monospace" textAnchor="middle">บางซื่อ</text>
        <g stroke={drillMode ? '#7c3aed' : '#0891b2'} strokeWidth="0.2" fill="none" opacity="0.7">
          <path d="M 65 52 L 36 48" strokeDasharray="0.8 0.5"/>
          <path d="M 72 30 L 42 56" strokeDasharray="0.8 0.5"/>
        </g>
      </svg>

      {patients.map((p, i) => {
        const x = toSvgX(p.lng!);
        const y = toSvgY(p.lat!);
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: 7, height: 7,
            background: TRIAGE_COLORS[p.lvl] || '#475569',
            borderRadius: 1, transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1.5px white, 0 1px 3px rgba(0,0,0,0.2)',
          }}/>
        );
      })}

      {sites.map(site => {
        const x = toSvgX(site.lng!);
        const y = toSvgY(site.lat!);
        const color = SITE_COLORS[site.type] || '#0891b2';
        return (
          <div key={site.id} onClick={() => onMarkerClick?.(site.id)} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            transform: 'translate(-50%,-50%)', cursor: 'pointer', zIndex: selected === site.id ? 20 : 10,
          }}>
            <div style={{
              width: 20, height: 20, background: 'white', border: `2px solid ${color}`,
              borderRadius: '50%', display: 'grid', placeItems: 'center',
              boxShadow: `0 2px 6px rgba(0,0,0,0.15), 0 0 0 ${selected === site.id ? '3px' : '0'} ${color}40`,
            }}>
              <Icon name={site.type === 'facility' ? 'hospital' : site.type === 'ccp' ? 'plus' : site.type === 'lz' ? 'helicopter' : site.type === 'uav' ? 'drone' : 'pin'} size={11} color={color}/>
            </div>
          </div>
        );
      })}

      <MapLegend drillMode={drillMode}/>
      <MapHUD drillMode={drillMode}/>
    </div>
  );
}

/* ─── Subtle map style (light, muted colors to match the design) ─── */
const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bedfee' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f4f9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e3e7ee' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#d1d9e6' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c8d0db' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8eef5' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d1fae5' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#dde2eb' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c8d0db' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#677489' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
];
