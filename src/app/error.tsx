'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="th">
      <body>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
          <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>เกิดข้อผิดพลาด</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
              {error.message || 'ระบบพบข้อผิดพลาดที่ไม่คาดคิด'}
              {error.digest && (
                <><br /><span style={{ fontFamily: 'monospace', fontSize: 11 }}>ref: {error.digest}</span></>
              )}
            </p>
            <button
              onClick={reset}
              style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
