import { useEffect, useRef, useState, useCallback } from 'react'
import { assetUrl } from '../lib/assetUrl'

/**
 * StreetWalk — proof of concept for ground-level lot viewing.
 *
 * Real frames from the August 2026 on-site iPhone capture (lot 46, Yogi),
 * re-projected along the actual walking path by structure-from-motion, so
 * dragging left/right moves you forward and back along the street at an
 * even pace — the same "step along the road" feel as Street View, using
 * nothing but real captured imagery.
 *
 * Frames are evenly spaced ~0.3 m apart along the walk, then a short
 * look-around pan at the end of the path.
 */

type Manifest = { frames: number; path: number[]; panFrom: number }

const SRC = (base: string, i: number) => `${base}/${String(i).padStart(3, '0')}.jpg`

interface StreetWalkProps {
  /** folder under /walk containing 000.jpg… + manifest.json */
  srcBase?: string
  /** small uppercase label above the blurb */
  eyebrow?: string
  blurb?: string
}

export default function StreetWalk({
  srcBase = assetUrl('/walk/lot46'),
  eyebrow = 'Walk the street · proof of concept — lot 46, Yogi',
  blurb = 'This is real footage shot standing on the street in August 2026 — not a rendering. Drag across the image to walk down the street and look around, exactly the way you would standing there.',
}: StreetWalkProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)
  const [idx, setIdx] = useState(0)
  const idxRef = useRef(0)
  const dragRef = useRef<{ x: number; idx: number } | null>(null)
  const playRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)

  // boot when scrolled into view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) {
          setActive(true)
          ob.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  // fetch manifest + preload frames progressively
  useEffect(() => {
    if (!active) return
    let cancelled = false
    ;(async () => {
      const m: Manifest = await (await fetch(`${srcBase}/manifest.json`)).json()
      if (cancelled) return
      setManifest(m)
      // first frame gates "ready"; the rest stream in behind it
      await new Promise<void>((res) => {
        const im = new Image()
        im.onload = () => res()
        im.onerror = () => res()
        im.src = SRC(srcBase, 0)
      })
      if (cancelled) return
      setReady(true)
      for (let i = 1; i < m.frames; i++) {
        const im = new Image()
        im.src = SRC(srcBase, i)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  const setIdxClamped = useCallback(
    (v: number) => {
      if (!manifest) return
      const c = Math.max(0, Math.min(manifest.frames - 1, v))
      idxRef.current = c
      setIdx(c)
    },
    [manifest]
  )

  // auto-play
  useEffect(() => {
    if (!playing || !manifest) return
    playRef.current = window.setInterval(() => {
      const next = idxRef.current + 0.12
      if (next >= manifest.frames - 1) {
        setPlaying(false)
        return
      }
      setIdxClamped(next)
    }, 50)
    return () => {
      if (playRef.current) window.clearInterval(playRef.current)
    }
  }, [playing, manifest, setIdxClamped])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, idx: idxRef.current }
    setPlaying(false)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !manifest) return
    // ~14px of drag per step along the path
    setIdxClamped(d.idx + (e.clientX - d.x) / 14)
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const base = Math.floor(idx)
  const frac = idx - base
  const next = Math.min((manifest?.frames ?? 1) - 1, base + 1)
  const panning = manifest ? idx >= manifest.panFrom : false
  const meters = manifest ? manifest.path[Math.round(idx)] ?? 0 : 0

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
          {eyebrow}
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
          {blurb}
        </p>

        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(320px, 56vh, 600px)',
            backgroundColor: '#111',
            overflow: 'hidden',
            cursor: 'grab',
            touchAction: 'pan-y',
            userSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {ready && manifest ? (
            <>
              <img
                src={SRC(srcBase, base)}
                alt="On-site street footage"
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {next !== base && (
                <img
                  src={SRC(srcBase, next)}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: frac,
                  }}
                />
              )}

              {/* position strip */}
              <div
                style={{
                  position: 'absolute',
                  left: '24px',
                  right: '24px',
                  bottom: '56px',
                  height: '3px',
                  background: 'rgba(255,255,255,0.25)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: `${(idx / (manifest.frames - 1)) * 100}%`,
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: '#fff',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
                  }}
                />
              </div>

              {/* controls */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: '14px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <button
                  onClick={() => setIdxClamped(Math.round(idxRef.current) - 1)}
                  style={btn}
                  aria-label="Step back"
                >
                  ◀
                </button>
                <button onClick={() => setPlaying((p) => !p)} style={btn} aria-label="Play">
                  {playing ? '❚❚' : '▶'}
                </button>
                <button
                  onClick={() => setIdxClamped(Math.round(idxRef.current) + 1)}
                  style={btn}
                  aria-label="Step forward"
                >
                  ▶
                </button>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', minWidth: '150px' }}>
                  {panning ? 'looking around' : `${meters.toFixed(1)} m along the street`}
                </span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '16px',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.85)',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '6px 10px',
                  borderRadius: '999px',
                }}
              >
                Drag to walk · real footage
              </div>
            </>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
              }}
            >
              {active ? 'Loading footage…' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  background: 'rgba(0,0,0,0.45)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: '999px',
  width: '38px',
  height: '38px',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: 1,
}
