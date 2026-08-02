import { useEffect, useMemo, useRef, useState } from 'react'

/* ------------------------------------------------------------------ */
/* solar position — same approximation as the server                   */
/* ------------------------------------------------------------------ */
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

function sunPosition(dateUtcMs: number, lat: number, lng: number) {
  const d = new Date(dateUtcMs)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const doy = Math.floor((dateUtcMs - start) / 86400000)
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600

  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  const tst = hour * 60 + eqTime + 4 * lng
  const ha = ((tst / 4 - 180) * D2R) % (2 * Math.PI)

  const latR = lat * D2R
  const cosAlt =
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)
  const altitude = Math.asin(Math.min(1, Math.max(-1, cosAlt))) * R2D

  const azRad = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)
  )
  const azimuth = (azRad * R2D + 180 + 360) % 360
  return { altitude, azimuth }
}

function bearingToCompass(az: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(az / 22.5) % 16]
}

/* ------------------------------------------------------------------ */
/* viewer                                                              */
/* ------------------------------------------------------------------ */
type Season = 'summer' | 'equinox' | 'winter'
const SEASONS: Record<Season, { month: number; day: number; label: string; tz: number; tag: string }> = {
  summer: { month: 5, day: 21, label: 'Summer', tz: -6, tag: 'the longest day' },
  equinox: { month: 2, day: 20, label: 'Spring / Fall', tz: -6, tag: 'day and night are equal' },
  winter: { month: 11, day: 21, label: 'Winter', tz: -7, tag: 'the shortest day' },
}

interface LotStandViewProps {
  lotName: string
  center: { lat: number; lng: number }
  polygon: number[][] | null
}

export default function LotStandView({ lotName, center }: LotStandViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [season, setSeason] = useState<Season>('summer')
  const [minutes, setMinutes] = useState(17 * 60)

  const seasonInfo = SEASONS[season]
  const sun = useMemo(() => {
    const year = new Date().getFullYear()
    const utcMs = Date.UTC(year, seasonInfo.month, seasonInfo.day) + (minutes - seasonInfo.tz * 60) * 60000
    return sunPosition(utcMs, center.lat, center.lng)
  }, [season, minutes, seasonInfo, center])
  const sunUp = sun.altitude > 0.5
  const golden =
    sunUp &&
    sun.altitude < 35 &&
    ['W', 'WSW', 'WNW', 'SW', 'NW'].includes(bearingToCompass(sun.azimuth))

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const sliderLabel = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  return (
    <div style={{ borderBottom: '1px solid #000000', backgroundColor: '#0b0b0b' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px clamp(24px, 4vw, 60px)' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
          See the land
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '640px', lineHeight: 1.6 }}>
          Real drone footage over The Stadium's roads and lots — this is the actual ground
          around Lot {lotName}, not a rendering. Below, track where the sun sits at any
          hour of the year.
        </p>

        {/* drone video */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(360px, 55vh, 580px)', backgroundColor: '#111', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src="/videos/stadium-road.mp4"
            muted
            loop
            playsInline
            controls
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

        {/* sun tracker */}
        <div
          style={{
            marginTop: '28px',
            border: '1px solid rgba(255,255,255,0.14)',
            padding: '24px clamp(16px, 2.5vw, 32px)',
            display: 'grid',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <label
                htmlFor="stand-season"
                style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}
              >
                Sunlight in
              </label>
              <select
                id="stand-season"
                value={season}
                onChange={(e) => setSeason(e.target.value as Season)}
                style={{
                  fontSize: '14px',
                  padding: '9px 14px',
                  backgroundColor: '#1a1a1a',
                  color: '#f2b04a',
                  border: '1px solid #f2b04a',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="summer">Summer (Jun 21)</option>
                <option value="equinox">Spring / Fall (Mar 20)</option>
                <option value="winter">Winter (Dec 21)</option>
              </select>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>— {seasonInfo.tag}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 280px', maxWidth: '460px' }}>
              <span style={{ fontSize: '15px', color: '#f2b04a', fontVariantNumeric: 'tabular-nums', minWidth: '48px' }}>
                {sliderLabel}
              </span>
              <input
                type="range"
                min={4 * 60}
                max={22 * 60}
                step={15}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#f2b04a' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: sunUp ? '#f2b04a' : '#3a4a6a',
                boxShadow: sunUp ? '0 0 12px #f2b04a' : 'none',
                flexShrink: 0,
              }}
            />
            <p style={{ fontSize: 'clamp(17px, 1.8vw, 22px)', color: '#ffffff', letterSpacing: '-0.01em', lineHeight: 1.4 }}>
              {sunUp ? (
                <>
                  In {seasonInfo.label.toLowerCase()} at {sliderLabel}, the sun is{' '}
                  <strong>{sun.altitude.toFixed(0)}°</strong> up in the{' '}
                  <strong>{bearingToCompass(sun.azimuth)}</strong> sky ({Math.round(sun.azimuth)}°)
                  {golden ? ' — golden light toward the lot.' : '.'}
                </>
              ) : (
                <>In {seasonInfo.label.toLowerCase()} at {sliderLabel}, the sun is below the horizon.</>
              )}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.6 }}>
          Video shot on site at The Stadium. Sun position is calculated for Lot {lotName}'s exact
          location — ground-level sun angle is what determines morning light on the porch and
          where the evening sun lands.
        </p>
      </div>
    </div>
  )
}
