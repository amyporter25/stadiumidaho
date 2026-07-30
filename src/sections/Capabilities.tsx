import { useEffect, useRef } from 'react'
import gsap from 'gsap'

const amenities: { label: string; detail: string }[] = [
  { label: '1+ Acre Homesites', detail: 'Real elbow room — space for shops, RV parking, pools, and play' },
  { label: 'Community Trail', detail: 'A 1.8-mile equestrian, pedestrian, and bike-friendly trail through the neighborhood' },
  { label: 'Custom Builders', detail: 'Build with one of the Valley’s top custom builders — or bring your own plan' },
  { label: 'Mountain Views', detail: 'Open sky and views in every direction from level, buildable ground' },
  { label: 'Detached Shops Allowed', detail: 'Oversized garages, shops, and barns welcome — bring your toys' },
  { label: 'Middleton Schools', detail: 'Purple Sage Elementary, Middleton Middle, and Middleton High' },
  { label: 'Paved Streets', detail: 'Established streetscape with power to the lot line' },
  { label: 'Room for Horses', detail: 'Equestrian-friendly community with acreage that fits the lifestyle' },
]

export default function Capabilities() {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.play().catch(() => {})
  }, [])

  return (
    <section
      id="capabilities"
      ref={sectionRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#0b0b0b',
        padding: 'clamp(100px, 12vw, 160px) clamp(20px, 4vw, 60px)',
      }}
    >
      <video
        ref={videoRef}
        src="/videos/spatial.mp4"
        muted
        loop
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* Top: title row */}
        <div
          style={{
            display: 'flex',
            gap: 'clamp(32px, 6vw, 80px)',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            marginBottom: '60px',
            paddingBottom: '28px',
            borderBottom: '1px solid rgba(255,255,255,0.35)',
          }}
        >
          <div style={{ flex: '1 1 500px' }}>
            <p
              style={{
                fontSize: '11px',
                letterSpacing: '0.24em',
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                marginBottom: '18px',
              }}
            >
              Community highlights
            </p>
            <h2
              style={{
                fontSize: 'clamp(40px, 6vw, 80px)',
                fontWeight: 400,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: '#ffffff',
                marginBottom: '24px',
              }}
            >
              Life at The Stadium
            </h2>
            <p
              style={{
                fontSize: 'clamp(15px, 1.2vw, 18px)',
                fontWeight: 300,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.78)',
                maxWidth: '640px',
              }}
            >
              From a morning ride on the trail to an evening watching the sun
              drop behind the mountains, life here is built around open space.
              A few of the things every homeowner enjoys:
            </p>
          </div>
          <div
            style={{
              flex: '0 0 clamp(180px, 22vw, 280px)',
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OrbitalBadge />
          </div>
        </div>

        {/* Bullet grid */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '2px',
            backgroundColor: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          {amenities.map((amenity, i) => (
            <BulletItem key={amenity.label} index={i} {...amenity} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function BulletItem({
  label,
  detail,
  index,
}: {
  label: string
  detail: string
  index: number
}) {
  return (
    <li
      style={{
        backgroundColor: 'rgba(11,11,11,0.55)',
        padding: '28px 32px',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        minHeight: '140px',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          width: '28px',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.55)',
          fontVariantNumeric: 'tabular-nums',
          paddingTop: '7px',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: '1 1 0%' }}>
        <h3
          style={{
            fontSize: 'clamp(18px, 1.6vw, 24px)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            color: '#ffffff',
            marginBottom: '10px',
          }}
        >
          {label}
        </h3>
        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.72)',
            margin: 0,
          }}
        >
          {detail}
        </p>
      </div>
    </li>
  )
}

function OrbitalBadge() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const pathId = `orbital-path-${Math.floor(Math.random() * 10000)}`
    const duration = 25

    const path = svg.querySelector('path')
    if (!path) return

    path.setAttribute('id', pathId)
    path.setAttribute('fill', 'none')

    const textContent = 'THE STADIUM \u2022 NORTH CALDWELL IDAHO \u2022 NOW SELLING \u2022 '

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    textEl.setAttribute('fill', '#ffffff')
    textEl.setAttribute('font-family', "'Helvetica Neue', sans-serif")
    textEl.setAttribute('font-size', '18px')
    textEl.setAttribute('font-weight', '500')
    textEl.setAttribute('letter-spacing', '2px')

    const tp1 = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
    tp1.setAttribute('href', `#${pathId}`)
    tp1.setAttribute('startOffset', '0%')
    tp1.textContent = textContent

    const tp2 = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
    tp2.setAttribute('href', `#${pathId}`)
    tp2.setAttribute('startOffset', '0%')
    tp2.textContent = textContent

    textEl.appendChild(tp1)
    textEl.appendChild(tp2)
    svg.appendChild(textEl)

    const textPaths = svg.querySelectorAll('textPath')

    const tween1 = gsap.fromTo(
      textPaths[0],
      { attr: { startOffset: '0%' } },
      { attr: { startOffset: '-100%' }, duration, ease: 'none', repeat: -1 }
    )

    const tween2 = gsap.fromTo(
      textPaths[1],
      { attr: { startOffset: '100%' } },
      { attr: { startOffset: '0%' }, duration, ease: 'none', repeat: -1 }
    )

    return () => {
      tween1.kill()
      tween2.kill()
    }
  }, [])

  return (
    <div
      className="orbital-svg-container"
      style={{
        width: '100%',
        height: '100%',
        transform: 'rotate(-15deg)',
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        style={{ width: '100%', height: '100%' }}
      >
        <path
          d="M200,40 A160,160 0 1,1 199.99,40"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.5"
          opacity="0.25"
        />
      </svg>
    </div>
  )
}
