import { useEffect, useRef, useState } from 'react'

/**
 * Interactive 3D capture of The Stadium — a Gaussian splat built from the
 * August 2026 drone footage (the same flight as the flyover video). Rendered
 * in the browser; visitors can orbit and zoom the actual terrain.
 *
 * The canvas is transparent, so the sky-gradient backdrop shows through where
 * the capture ends at the edges of the site.
 */
export default function StadiumSplat() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only boot the WebGL viewer once the section scrolls into view.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!active || !containerRef.current) return
    let disposed = false
    let viewer: import('@mkkellogg/gaussian-splats-3d').Viewer | null = null

    ;(async () => {
      try {
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
        if (disposed || !containerRef.current) return
        viewer = new GaussianSplats3D.Viewer({
          rootElement: containerRef.current,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 2.1, 3.1],
          initialCameraLookAt: [0, -0.4, 0],
          selfDrivenMode: true,
          useBuiltInControls: true,
          ignoreDevicePixelRatio: false,
          sharedMemoryForWorkers: false,
        })
        await viewer.addSplatScene('/splats/stadium.ksplat', {
          progressiveLoad: false,
          showLoadingUI: true,
        })
        if (disposed) return
        viewer.start()
      } catch (e) {
        if (!disposed) setError('The 3D view could not be loaded in this browser.')
      }
    })()

    return () => {
      disposed = true
      viewer?.dispose()
    }
  }, [active])

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
          Interactive 3D · captured on site
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
          A three-dimensional capture of The Stadium, built from the August 2026 drone flight.
          Drag to orbit around the property and scroll to zoom — this is the actual ground,
          reconstructed from real footage.
        </p>

        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(360px, 55vh, 580px)',
            background: 'linear-gradient(to bottom, #6d9bc4 0%, #a9c6dd 55%, #d9e2e8 82%, #c9cdc2 100%)',
            overflow: 'hidden',
          }}
        >
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(11,11,11,0.75)',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}
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
            3D capture · The Stadium, north Caldwell
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '14px',
              backgroundColor: 'rgba(11,11,11,0.78)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.04em',
              pointerEvents: 'none',
            }}
          >
            Drag to orbit · Scroll to zoom
          </div>
        </div>
      </div>
    </div>
  )
}
