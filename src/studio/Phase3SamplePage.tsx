import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

/**
 * Sample preview from DJI_0029.MP4 (the Drive clip).
 * Honest about what the file actually is: ~17s ground-level street view,
 * not a long aerial survey of Phase 3.
 */
export default function Phase3SamplePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(17)

  const stills = useMemo(
    () => [
      { src: '/studio/phase3-sample/t01.jpg', label: '0:01 · curb / pad edge' },
      { src: '/studio/phase3-sample/t06.jpg', label: '0:06 · road ahead' },
      { src: '/studio/phase3-sample/t10.jpg', label: '0:10 · utility stakes' },
      { src: '/studio/phase3-sample/t14.jpg', label: '0:14 · open skyline' },
    ],
    []
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1214',
        color: '#f2efe8',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          padding: '18px clamp(16px, 3vw, 36px)',
          borderBottom: '1px solid rgba(242,239,232,0.1)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              opacity: 0.55,
            }}
          >
            Track B · footage sample
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 600 }}>
            What this clip can power
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <Link to="/studio" style={linkStyle}>
            ← Lot Studio (aerial)
          </Link>
          <Link to="/" style={linkStyle}>
            Marketing site
          </Link>
        </div>
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)',
          gap: 28,
          padding: '24px clamp(16px, 3vw, 36px) 48px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <section>
          <div
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#000',
              aspectRatio: '16 / 9',
            }}
          >
            <video
              ref={videoRef}
              src="/studio/phase3-sample/flyover.mp4"
              playsInline
              controls
              autoPlay
              muted
              loop
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 17)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={dur}
            step={0.05}
            value={t}
            onChange={(e) => {
              const v = Number(e.target.value)
              setT(v)
              if (videoRef.current) videoRef.current.currentTime = v
            }}
            style={{ width: '100%', marginTop: 12 }}
          />
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
            Scrub {t.toFixed(1)}s / {dur.toFixed(1)}s · web-compressed preview of DJI_0029.MP4
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginTop: 16,
            }}
          >
            {stills.map((s) => (
              <figure key={s.src} style={{ margin: 0 }}>
                <img
                  src={s.src}
                  alt={s.label}
                  style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                    borderRadius: 8,
                    display: 'block',
                  }}
                />
                <figcaption style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{s.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <aside style={{ fontSize: 14, lineHeight: 1.55 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>What I actually received</h2>
          <ul style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>
              <strong>DJI_0029.MP4</strong> — about <strong>17 seconds</strong>, 1080p
            </li>
            <li>
              <strong>Ground / street-level</strong> looking down a newly paved road (car door in
              frame) — not a high aerial of the whole phase
            </li>
            <li>
              GPS tag ≈ <strong>43.7684, −116.7488</strong> — nearest plat lots include{' '}
              <strong>43/2, 45/2, 42/2</strong> (~50–70 m)
            </li>
          </ul>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Experience this clip supports</h2>
          <p style={{ margin: '0 0 12px', opacity: 0.9 }}>
            A strong <em>“stand in the street and look toward the lots”</em> moment — honest empty
            land, sky, road, utility stakes. Good for:
          </p>
          <ol style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>Scrubbable street approach (this page)</li>
            <li>Equirect / still “look around” if you shoot a slow 360° pan from the pad</li>
            <li>
              Pairing with Lot Studio aerial for the same homesite (
              <Link to="/studio?lot=43/2" style={{ color: '#c4a574' }}>
                try lot 43/2
              </Link>
              )
            </li>
          </ol>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>What it does <em>not</em> give us yet</h2>
          <ul style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>Coverage of all Phase 3 lots from the air</li>
            <li>A site orthophoto / map drape better than satellite</li>
            <li>A Street View network with many stand points</li>
          </ul>

          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'rgba(196,165,116,0.12)',
              border: '1px solid rgba(196,165,116,0.35)',
              fontSize: 13,
            }}
          >
            If you meant a <strong>longer aerial</strong> of Phase 3, this may be the wrong Drive
            file (or only a short takeoff/street clip). Send the longer MP4 the same way and we’ll
            sample that next — ideally a higher, slower pass over the lots.
          </div>
        </aside>
      </main>

      <style>{`
        @media (max-width: 900px) {
          main { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const linkStyle: CSSProperties = {
  color: '#f2efe8',
  textDecoration: 'none',
  borderBottom: '1px solid rgba(242,239,232,0.35)',
}
