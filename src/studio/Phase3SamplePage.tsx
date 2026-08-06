import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

/**
 * Sample preview from the real Phase 3 drone clip (DJI_0034.MP4).
 * Full source is ~15.6 min / 3.9 GB — this page only ships a short web cut + stills.
 */
export default function Phase3SamplePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(45)

  const stills = useMemo(
    () => [
      { src: '/studio/phase3-sample/aerial-02m.jpg', label: '~2 min · roads + pads' },
      { src: '/studio/phase3-sample/aerial-05m.jpg', label: '~5 min · canal / dirt track' },
      { src: '/studio/phase3-sample/aerial-08m.jpg', label: '~8 min · cul-de-sac + basin' },
      { src: '/studio/phase3-sample/aerial-14m.jpg', label: '~14 min · lots + farmland' },
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
            Phase 3 drone — what this can power
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <Link to="/studio/earth" style={linkStyle}>
            ← Neighborhood explorer
          </Link>
          <Link to="/studio" style={linkStyle}>
            Place a house
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
              onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 45)}
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
            Sample cut from ~5:00–5:45 of DJI_0034 · scrub {t.toFixed(1)}s / {dur.toFixed(1)}s
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
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>What we received (correct file)</h2>
          <ul style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>
              <strong>DJI_0034.MP4</strong> — ~<strong>15.6 minutes</strong>, 1080p, ~3.9 GB
            </li>
            <li>
              <strong>Elevated oblique aerial</strong> — paved roads, dirt pads, scrub lots,
              neighbors, canal, power-line corridor at the edge
            </li>
            <li>Matches “covers Phase 3 except under the power lines”</li>
          </ul>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Lot experiences this enables</h2>
          <ol style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>
              <strong>Site flyover tour</strong> — scrubbable / chaptered video (this sample)
            </li>
            <li>
              <strong>Custom site ortho</strong> — stitch nadir-ish frames into a sharper map
              drape than generic satellite for Lot Studio
            </li>
            <li>
              <strong>Per-lot bookmarks</strong> — jump the camera to “over lot X” moments in
              the flight, then hand off to house-photo placement on the aerial lot view
            </li>
          </ol>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>What we should <em>not</em> do with it</h2>
          <ul style={{ paddingLeft: 18, margin: '0 0 18px', opacity: 0.9 }}>
            <li>Another full-site Gaussian splat as the main product (we already saw that fail)</li>
            <li>Ship the raw 3.9 GB file in the web app</li>
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
            Neighborhood explorer is live: aerial + plat lines + fly/orbit (Google Earth–style).
            This drone clip remains the cinematic flyover — not a splat rebuild.
            <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
              <Link to="/studio/earth" style={{ color: '#c4a574' }}>
                Open neighborhood explorer →
              </Link>
              <Link to="/studio?lot=46/3" style={{ color: '#c4a574' }}>
                Place a house →
              </Link>
            </div>
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
