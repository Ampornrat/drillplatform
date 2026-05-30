'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { useEffect, useRef, useMemo } from 'react';

/* Red pin icon */
const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
    <g filter="url(#s)">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 28 14 28s14-17.5 14-28C28 6.268 21.732 0 14 0z" fill="#dc2626"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
    </g>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

function MapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function DraggableMarker({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) { const p = m.getLatLng(); onMove(p.lat, p.lng); }
    },
  }), [onMove]);

  return (
    <Marker
      draggable
      position={[lat, lng]}
      icon={PIN_ICON}
      eventHandlers={handlers}
      ref={markerRef}
    />
  );
}

function MapController({ lat, lng, flyTrigger }: { lat: number; lng: number; flyTrigger: number }) {
  const map = useMap();
  const prev = useRef(flyTrigger);
  useEffect(() => {
    if (flyTrigger !== prev.current) {
      prev.current = flyTrigger;
      map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
    }
  }, [flyTrigger, lat, lng, map]);
  return null;
}

export interface LocationPickerMapProps {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
  flyTrigger?: number;
  height?: number;
}

export default function LocationPickerMap({ lat, lng, onMove, flyTrigger = 0, height = 260 }: LocationPickerMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={10}
      style={{ height, width: '100%', borderRadius: 8, cursor: 'crosshair' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapClickHandler onMove={onMove} />
      <DraggableMarker lat={lat} lng={lng} onMove={onMove} />
      <MapController lat={lat} lng={lng} flyTrigger={flyTrigger} />
    </MapContainer>
  );
}
