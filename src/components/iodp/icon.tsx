'use client';
import React from 'react';

export function Icon({ name, size = 16, color = 'currentColor', className = '' }: {
  name: string; size?: number; color?: string; className?: string;
}) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, className, 'aria-hidden': true,
  };
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
    map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    incident: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></>,
    plan: <><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></>,
    hospital: <><path d="M4 21V8l8-5 8 5v13"/><path d="M12 12v6"/><path d="M9 15h6"/><path d="M4 21h16"/></>,
    aar: <><circle cx="12" cy="12" r="9"/><path d="M3 12a9 9 0 0 1 14-7.5"/><polyline points="17 0 17 5 12 5"/><path d="M9 12l2 2 4-4"/></>,
    scenario: <><path d="M19 21l-2-2H7l-2 2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M8 8h8"/><path d="M8 12h5"/></>,
    casualty: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M9 13l1 2"/></>,
    control: <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>,
    inject: <><path d="M14 4l6 6"/><path d="M3 21l9-9"/><path d="M11 9l4 4"/><path d="M17 7l-3-3 2-2 3 3z"/></>,
    eval: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    field: <><path d="M5 20l4-7 4 5 5-9"/><path d="M3 20h18"/></>,
    registry: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    chevron: <><polyline points="6 9 12 15 18 9"/></>,
    chevron_r: <><polyline points="9 18 15 12 9 6"/></>,
    chevron_l: <><polyline points="15 18 9 12 15 6"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    stop: <><rect x="5" y="5" width="14" height="14"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    radio: <><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    truck: <><path d="M1 3h15v13H1z"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    boat: <><path d="M2 20a4 4 0 0 0 4 0 4 4 0 0 0 4 0 4 4 0 0 0 4 0 4 4 0 0 0 4 0 4 4 0 0 0 4 0"/><path d="M22 16l-1-7-9-2-9 2-1 7"/><path d="M12 7V2"/><path d="M8 4h8"/></>,
    drone: <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8" y1="8" x2="10" y2="10"/><line x1="16" y1="8" x2="14" y2="10"/><line x1="8" y1="16" x2="10" y2="14"/><line x1="16" y1="16" x2="14" y2="14"/><rect x="10" y="10" width="4" height="4" rx="1"/></>,
    helicopter: <><path d="M3 5h18"/><path d="M12 5v3"/><path d="M9 8h6l2 4-3 5h-4l-3-5z"/><path d="M3 17h6"/></>,
    flag: <><path d="M4 21V4a1 1 0 0 1 1-1h11l-2 5 2 5H5"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9A9 9 0 0 1 18.36 5.64L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3" y2="6"/><line x1="3" y1="12" x2="3" y2="12"/><line x1="3" y1="18" x2="3" y2="18"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><line x1="12" y1="12" x2="20" y2="6"/></>,
  };
  return <svg {...common}>{paths[name] || <rect width="20" height="20" x="2" y="2"/>}</svg>;
}
