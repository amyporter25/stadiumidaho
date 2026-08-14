import { useEffect, useRef } from 'react'
import { assetUrl } from '../lib/assetUrl'

interface FlyoverVideoProps {
  /** When set, copy references the specific lot page the visitor is on. */
  lotName?: string
}

/**
 * Real drone flyover of The Stadium (shot July 2026) — the actual roads and
 * graded lots, not a rendering. Autoplays muted, loops, with full controls.
 */
export default function FlyoverVideo({ lotName }: FlyoverVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div style={{ borderBottom: '1px solid #000000', backgroundColor: '#0b0b0b' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px clamp(24px, 4vw, 60px)' }}>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '8px',
          }}
        >
          Drone flyover · July 2026
        </p>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '24px',
            maxWidth: '640px',
            lineHeight: 1.6,
          }}
        >
          {lotName
            ? `The real ground around Lot ${lotName}, from the air — roads are paved, lots are graded. This is footage of the actual property, not a rendering.`
            : `The real ground at The Stadium, from the air — roads are paved, lots are graded. This is footage of the actual property, not a rendering.`}
        </p>

        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(360px, 55vh, 580px)',
            backgroundColor: '#111',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            src={assetUrl('/videos/stadium-flyover.mp4')}
            poster={assetUrl('/videos/stadium-flyover-poster.jpg')}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              backgroundColor: 'rgba(11,11,11,0.78)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 14px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.04em',
              pointerEvents: 'none',
            }}
          >
            Aerial footage · The Stadium, north Caldwell
          </div>
        </div>
      </div>
    </div>
  )
}
