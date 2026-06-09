'use client'

import dynamic from 'next/dynamic'
import type { COPMarker } from './cop-map'

const COPMap = dynamic(() => import('./cop-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
      กำลังโหลดแผนที่...
    </div>
  ),
})

interface COPMapWrapperProps {
  markers?: COPMarker[]
  center?: { lat: number; lng: number }
  zoom?: number
  title?: string
}

export default function COPMapWrapper({ markers, center, zoom, title }: COPMapWrapperProps) {
  return <COPMap markers={markers} center={center} zoom={zoom} title={title} />
}
