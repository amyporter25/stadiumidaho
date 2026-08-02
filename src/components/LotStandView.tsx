import { useEffect, useMemo, useRef, useState } from 'react'
import { useGoogleMaps } from './LotMap'

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

function bearingDeg(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLng = (toLng - fromLng) * D2R
  const y = Math.sin(dLng) * Math.cos(toLat * D2R)
  const x =
    Math.cos(fromLat * D2R) * Math.sin(toLat * D2R) -
    Math.sin(fromLat * D2R) * Math.cos(toLat * D2R) * Math.cos(dLng)
  return (Math.atan2(y, x) * R2D + 360) % 360
}

/* ------------------------------------------------------------------ */
/* viewer                                                              */
/* ------------------------------------------------------------------ */
type Season = 'summer' | 'equinox' | 'winter'
const SEASONS: Record<Season, { month: number; day: number; label: string; tz: number }> = {
  summer: { month: 5, day: 21, label: 'Summer', tz: -6 },
  equinox: { month: 2, day: 20, label: 'Spring / Fall', tz: -6 },
  winter: { month: 11, day: 21, label: 'Winter', tz: -7 },
}

interface LotStandViewProps {
  lotName: string
  center: { lat: number; lng: number }
  polygon: number[][] | null
}

export default function LotStandView({ lotName, center, polygon }: LotStandViewProps) {
  const { isLoaded, loadError } = useGoogleMaps()
  const hostRef = useRef<HTMLDivElement>(null)
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null)

  const [season, setSeason] = useState<Season>('summer')
  const [minutes, setMinutes] = useState(17 * 60)
  const [svStatus, setSvStatus] = useState<'loading' | 'found' | 'none'>('loading')
  const [svNote, setSvNote] = useState<string>('')

  /* ---- sun position ---- */
  const seasonInfo = SEASONS[season]
  const sun = useMemo(() => {
    const year = new Date().getFullYear()
    const utcMs = Date.UTC(year, seasonInfo.month, seasonInfo.day) + (minutes - seasonInfo.tz * 60) * 60000
    return sunPosition(utcMs, center.lat, center.lng)
  }, [season, minutes, seasonInfo, center])
  const sunUp = sun.altitude > 0.5

  /* ---- candidate stand points: edge of the lot + nearby, toward the lot ---- */
  const candidates = useMemo(() => {
    const pts: { lat: number; lng: number }[] = []
    if (polygon) {
      // push outward from centroid through each vertex midpoint
      for (const [lng, lat] of polygon) {
        const dx = lng - center.lng
        const dy = lat - center.lat
        const len = Math.hypot(dx, dy) || 1
        // ~25m beyond the lot edge
        pts.push({ lat: lat + (dy / len) * 0.00025, lng: lng + (dx / len) * 0.00025 })
      }
    }
    pts.push(center) // last resort
    return pts
  }, [polygon, center])

  /* ---- init Street View once maps are ready ---- */
  useEffect(() => {
    if (!isLoaded || !hostRef.current) return

    const pano = new google.maps.StreetViewPanorama(hostRef.current, {
      pov: { heading: 0, pitch: 0 },
      zoom: 0,
      addressControl: false,
      linksControl: true,
      panControl: true,
      enableCloseButton: false,
      fullscreenControl: true,
      motionTracking: false,
      motionTrackingControl: false,
    })
    panoRef.current = pano

    const service = new google.maps.StreetViewService()

    // try candidate points, widest search first for the closest real panorama
    let cancelled = false
    setSvStatus('loading')

    const tryPoint = (idx: number) => {
      if (cancelled || idx >= candidates.length) {
        if (!cancelled) {
          setSvStatus('none')
          setSvNote('Street View has not photographed this street yet.')
        }
        return
      }
      service.getPanorama(
        { location: candidates[idx], radius: 150, preference: google.maps.StreetViewPreference.NEAREST },
        (data, status) => {
          if (cancelled) return
          if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
            const pos = data.location.latLng
            pano.setPosition(pos)
            // face the lot
            const heading = bearingDeg(pos.lat(), pos.lng(), center.lat, center.lng)
            pano.setPov({ heading, pitch: 0 })
            setSvStatus('found')
            const desc = data.location.description ?? ''
            const distM = Math.round(
              Math.hypot(
                (pos.lat() - center.lat) * 111320,
                (pos.lng() - center.lng) * 111320 * Math.cos(center.lat * D2R)
              )
            )
            setSvNote(
              distM > 120
                ? `Nearest Street View is ~${distM} m away${desc ? ` on ${desc}` : ''} — the lots themselves aren't photographed yet.`
                : desc
                  ? `Standing near ${desc}, looking toward Lot ${lotName}.`
                  : `Looking toward Lot ${lotName}.`
            )
          } else {
            tryPoint(idx + 1)
          }
        }
      )
    }
    tryPoint(0)

    return () => {
      cancelled = true
      panoRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, lotName])

  const sliderLabel = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  return (
    <div style={{ borderBottom: '1px solid #000000', backgroundColor: '#0b0b0b' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px clamp(24px, 4vw, 60px)' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
          Stand on the lot
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '640px', lineHeight: 1.6 }}>
          Look around the real surroundings at street level — drag to turn, scroll to zoom, click the
          road to move. Below, the sun readout shows where the light sits at any time of day.
        </p>

        {/* Street View */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(380px, 60vh, 600px)', backgroundColor: '#111' }}>
          {loadError ? (
            <Centered>Note: map view unavailable — check the Google Maps key.</Centered>
          ) : !isLoaded || svStatus === 'loading' ? (
            <Centered>Finding the nearest street view…</Centered>
          ) : svStatus === 'none' ? (
            <Centered>
              {svNote} Satellite imagery is your best look for now — see the map above.
            </Centered>
          ) : null}

          {/* the panorama mounts here; stays mounted but hidden behind status messages */}
          <div
            ref={hostRef}
            style={{
              position: 'absolute',
              inset: 0,
              visibility: svStatus === 'found' ? 'visible' : 'hidden',
            }}
          />

          {svStatus === 'found' && svNote && (
            <div
              style={{
                position: 'absolute',
                bottom: '14px',
                left: '14px',
                maxWidth: '70%',
                backgroundColor: 'rgba(11,11,11,0.78)',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
              }}
            >
              {svNote}
            </div>
          )}
        </div>

        {/* sun readout */}
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(Object.keys(SEASONS) as Season[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '8px 16px',
                    border: season === s ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.25)',
                    backgroundColor: season === s ? 'rgba(242,176,74,0.12)' : 'transparent',
                    color: season === s ? '#f2b04a' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                  }}
                >
                  {SEASONS[s].label}
                </button>
              ))}
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
            <p style={{ fontSize: 'clamp(17px, 1.8vw, 22px)', color: '#ffffff', letterSpacing: '-0.01em' }}>
              {sunUp ? (
                <>
                  In {SEASONS[season].label.toLowerCase()} at {sliderLabel}, the sun is{' '}
                  <strong>{sun.altitude.toFixed(0)}°</strong> up in the{' '}
                  <strong>{bearingToCompass(sun.azimuth)}</strong> sky ({Math.round(sun.azimuth)}°)
                  {bearingToCompass(sun.azimuth) === 'W' || bearingToCompass(sun.azimuth) === 'WSW' || bearingToCompass(sun.azimuth) === 'WNW' || bearingToCompass(sun.azimuth) === 'SW' || bearingToCompass(sun.azimuth) === 'NW'
                    ? ' — golden light toward the lot.'
                    : '.'}
                </>
              ) : (
                <>In {SEASONS[season].label.toLowerCase()} at {sliderLabel}, the sun is below the horizon.</>
              )}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.6 }}>
          Street View shows the nearest real photography to this lot — drag to look in any
          direction. The new internal streets may not be photographed yet; in that case you'll
          see the closest existing road. Sun position is calculated for the lot's exact location.
        </p>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 32px',
        color: 'rgba(255,255,255,0.45)',
        fontSize: '13px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        lineHeight: 1.8,
      }}
    >
      {children}
    </div>
  )
}
