'use client'

import dynamic from 'next/dynamic'

const COPMap = dynamic(() => import('./cop-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
      กำลังโหลดแผนที่...
    </div>
  ),
})

export default function COPMapWrapper() {
  return <COPMap />
}
