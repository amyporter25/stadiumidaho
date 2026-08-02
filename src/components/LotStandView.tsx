import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { trpc } from '@/providers/trpc'
import { useGoogleMaps } from './LotMap'

/* ------------------------------------------------------------------ */
/* solar position — same approximation as the server, so the light     */
/* direction here always agrees with the Sun & Terrain panel           */
/* ------------------------------------------------------------------ */
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

function sunPosition(dateUtcMs: number, lat: number, lng: number) {
  const d = new Date(dateUtcMs)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const doy = Math.floor((dateUtcMs - start) / 86400000)
  const hour =
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600

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
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(az / 22.5) % 16]
}

/** a point meters offset from a lat/lng (flat-earth, fine at lot scale) */
function offsetPoint(lat: number, lng: number, dEast: number, dNorth: number) {
  const dLat = dNorth / 111320
  const dLng = dEast / (111320 * Math.cos(lat * D2R))
  return { lat: lat + dLat, lng: lng + dLng }
}

/* ------------------------------------------------------------------ */
/* viewer                                                              */
/* ------------------------------------------------------------------ */
type Season = 'summer' | 'equinox' | 'winter'
type ViewDir = 'N' | 'E' | 'S' | 'W' | 'street'

const SEASON_DATES: Record<Season, { month: number; day: number; label: string; tz: number }> = {
  summer: { month: 5, day: 21, label: 'Summer', tz: -6 }, // Jun 21, MDT
  equinox: { month: 2, day: 20, label: 'Spring / Fall', tz: -6 }, // Mar 20, MDT
  winter: { month: 11, day: 21, label: 'Winter', tz: -7 }, // Dec 21, MST
}

const CARDINALS: { dir: ViewDir; label: string }[] = [
  { dir: 'N', label: 'N' },
  { dir: 'E', label: 'E' },
  { dir: 'S', label: 'S' },
  { dir: 'W', label: 'W' },
  { dir: 'street', label: 'Street' },
]

interface LotStandViewProps {
  lotName: string
  center: { lat: number; lng: number }
  polygon: number[][] | null
}

export default function LotStandView({ lotName, center, polygon }: LotStandViewProps) {
  const { isLoaded, loadError } = useGoogleMaps()

  const [season, setSeason] = useState<Season>('summer')
  const [minutes, setMinutes] = useState(17 * 60) // 5:00 PM default
  const [viewDir, setViewDir] = useState<ViewDir>('street')
  const [lightOn, setLightOn] = useState(true)

  const mapRef = useRef<google.maps.Map | null>(null)
  const rectRef = useRef<google.maps.Rectangle | null>(null)

  // facing direction → which way the street is
  const { data: liveData } = trpc.lots.live.useQuery(undefined, { staleTime: 6 * 3600 * 1000 })
  const facing = useMemo(() => {
    const f = liveData?.features?.find(
      (x: { properties: { name: string } }) => x.properties.name === lotName
    ) as { properties: { facing?: string | null } } | undefined
    return f?.properties?.facing ?? null
  }, [liveData, lotName])

  // sun position for the current season + time
  const seasonInfo = SEASON_DATES[season]
  const sun = useMemo(() => {
    const year = new Date().getFullYear()
    const utcMs =
      Date.UTC(year, seasonInfo.month, seasonInfo.day) +
      (minutes - seasonInfo.tz * 60) * 60000
    return sunPosition(utcMs, center.lat, center.lng)
  }, [season, minutes, seasonInfo, center])

  const sunUp = sun.altitude > 0.5

  // where the camera should sit + look
  const view = useMemo(() => {
    const R = 200 // meters back from the lot
    const bearingToDeg: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    }

    let heading: number
    if (viewDir === 'street') {
      const streetAz = facing ? bearingToDeg[facing] ?? 0 : 0
      // camera sits out in the street, looking INTO the lot = opposite of facing
      heading = (streetAz + 180) % 360
    } else {
      // stand in the lot looking toward the chosen compass direction
      heading = bearingToDeg[viewDir]
    }

    let camLat: number
    let camLng: number
    if (viewDir === 'street') {
      // place the camera outside the lot toward the street
      const streetAz = facing ? bearingToDeg[facing] ?? 0 : 0
      const d = offsetPoint(
        center.lat, center.lng,
        R * Math.sin(streetAz * D2R),
        R * Math.cos(streetAz * D2R)
      )
      camLat = d.lat
      camLng = d.lng
    } else {
      // camera behind the lot, opposite the look direction
      const back = (heading + 180) % 360
      const d = offsetPoint(
        center.lat, center.lng,
        R * 0.7 * Math.sin(back * D2R),
        R * 0.7 * Math.cos(back * D2R)
      )
      camLat = d.lat
      camLng = d.lng
    }
    return { heading, camLat, camLng }
  }, [viewDir, facing, center])

  // apply camera + light overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    map.setOptions({
      center: { lat: view.camLat, lng: view.camLng },
      zoom: 18,
      tilt: 45,
      heading: view.heading,
    })

    // light / dusk overlay — dim the scene when the sun is low or down
    if (!rectRef.current) {
      rectRef.current = new google.maps.Rectangle({
        bounds: {
          north: center.lat + 0.02,
          south: center.lat - 0.02,
          east: center.lng + 0.02,
          west: center.lng - 0.02,
        },
        strokeWeight: 0,
        fillColor: '#060a18',
        clickable: false,
        zIndex: 1,
      })
    }
    const rect = rectRef.current
    rect.setMap(lightOn ? map : null)

    // darkness: 0 at full sun, rising as the sun drops below ~20°
    const darkness = lightOn
      ? Math.min(0.62, Math.max(0, (20 - sun.altitude) / 20) * 0.62)
      : 0
    rect.setOptions({ fillOpacity: darkness })

    // golden-hour tint just above the horizon
    if (lightOn && sun.altitude > 0.5 && sun.altitude < 18) {
      rect.setOptions({ fillColor: '#2a1a3a' })
    } else {
      rect.setOptions({ fillColor: '#060a18' })
    }
  }, [isLoaded, view, sun, lightOn, center])

  const sliderLabel = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60
  ).padStart(2, '0')}`

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
          Stand on the lot
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '640px', lineHeight: 1.6 }}>
          Look around from street level{facing ? ` (this lot faces ${facing})` : ''}, then drag the
          time slider to see where the sun sits and when the light fades.
        </p>

        {/* viewer */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(380px, 60vh, 600px)' }}>
          {isLoaded && !loadError ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              onLoad={(m) => {
                mapRef.current = m
              }}
              options={{
                mapTypeId: 'satellite',
                tilt: 45,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                rotateControl: true,
                gestureHandling: 'greedy',
                scrollwheel: true,
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Loading view…
            </div>
          )}

          {/* lot outline hint */}
          {polygon && (
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
                letterSpacing: '0.06em',
              }}
            >
              Lot {lotName} · {bearingToCompass(view.heading)} view
            </div>
          )}

          {/* sun badge */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              backgroundColor: 'rgba(11,11,11,0.78)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: sunUp ? '#f2b04a' : '#3a4a6a',
                boxShadow: sunUp ? '0 0 10px #f2b04a' : 'none',
              }}
            />
            {sunUp
              ? `Sun ${bearingToCompass(sun.azimuth)} · ${sun.altitude.toFixed(0)}° up`
              : 'Sun below the horizon'}
          </div>
        </div>

        {/* controls */}
        <div
          style={{
            display: 'grid',
            gap: '20px',
            marginTop: '24px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            alignItems: 'center',
          }}
        >
          {/* season */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(Object.keys(SEASON_DATES) as Season[]).map((s) => (
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
                {SEASON_DATES[s].label}
              </button>
            ))}
          </div>

          {/* time slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#f2b04a', fontVariantNumeric: 'tabular-nums', minWidth: '46px' }}>
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

          {/* view direction */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {CARDINALS.map(({ dir, label }) => (
              <button
                key={dir}
                onClick={() => setViewDir(dir)}
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '8px 14px',
                  border: viewDir === dir ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.25)',
                  backgroundColor: viewDir === dir ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: viewDir === dir ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setLightOn((v) => !v)}
              style={{
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '8px 14px',
                marginLeft: '8px',
                border: lightOn ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.25)',
                backgroundColor: lightOn ? 'rgba(242,176,74,0.12)' : 'transparent',
                color: lightOn ? '#f2b04a' : 'rgba(255,255,255,0.65)',
                cursor: 'pointer',
              }}
            >
              Sunlight {lightOn ? 'on' : 'off'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.6 }}>
          Satellite view tilted to street level. The sunlight overlay dims the scene as the sun
          drops; it shows sun position, not cast shadows. A full 3D photoreal view is coming once
          Google's 3D tiles cover this area.
        </p>
      </div>
    </div>
  )
}
