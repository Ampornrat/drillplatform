'use client'

import { useEffect, useRef } from 'react'
import { RefreshCw, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mockMarkers, mockIncident } from '@/lib/mock/cop-data'

const markerColors: Record<string, string> = {
  uav: '#7c3aed',
  site: '#dc2626',
  ccp: '#ea580c',
  lz: '#16a34a',
  hospital: '#0369a1',
}

const markerIcons: Record<string, string> = {
  uav: '◎',
  site: '⚠',
  ccp: '✚',
  lz: '◇',
  hospital: '🏥',
}

export default function COPMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return

    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [mockIncident.center.lat, mockIncident.center.lng],
        zoom: mockIncident.zoom,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Add markers
      mockMarkers.forEach((m) => {
        const color = markerColors[m.type] ?? '#6b7280'
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              background:${color};
              color:white;
              border-radius:${m.type === 'lz' ? '4px' : '50%'};
              transform:${m.type === 'lz' ? 'rotate(45deg)' : 'none'};
              width:32px;height:32px;
              display:flex;align-items:center;justify-content:center;
              font-size:12px;font-weight:700;
              border:2px solid white;
              box-shadow:0 2px 6px rgba(0,0,0,0.4);
              cursor:pointer;
            ">
              <span style="transform:${m.type === 'lz' ? 'rotate(-45deg)' : 'none'};font-size:10px">${m.id.split('-')[0]}</span>
            </div>
            <div style="
              position:absolute;top:36px;left:50%;transform:translateX(-50%);
              background:rgba(0,0,0,0.75);color:white;
              padding:1px 5px;border-radius:3px;
              font-size:10px;white-space:nowrap;font-weight:600;
            ">${m.label}</div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${m.label}</b><br>ประเภท: ${m.type.toUpperCase()}`)
      })

      // Flood zone overlay
      const floodZone = L.polygon([
        [13.790, 100.435], [13.790, 100.460],
        [13.765, 100.465], [13.760, 100.440],
      ], {
        color: '#3b82f6',
        fillColor: '#93c5fd',
        fillOpacity: 0.25,
        weight: 1,
        dashArray: '6,4',
      }).addTo(map)
      floodZone.bindPopup('พื้นที่น้ำท่วม — ตลิ่งชัน')

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Map toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">ภาพรวมสถานการณ์ — ตลิ่งชัน</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium">สด</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Layers className="w-3 h-3" />
            ชั้นข้อมูล
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="flex-1 z-0" />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-white text-xs text-gray-600 flex-wrap">
        {[
          { color: '#dc2626', label: 'P1' },
          { color: '#f97316', label: 'P2' },
          { color: '#22c55e', label: 'P3' },
          { color: '#111827', label: 'เสียชีวิต' },
          { color: '#0369a1', label: 'โรงพยาบาล' },
          { color: '#7c3aed', label: 'ทีม/ชุดเกิดเหตุ' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
            {label}
          </div>
        ))}
        <span className="ml-auto text-gray-400 font-mono">
          {mockIncident.center.lat}°N · {mockIncident.center.lng}°E ZOOM {mockIncident.zoom}
        </span>
      </div>
    </div>
  )
}
