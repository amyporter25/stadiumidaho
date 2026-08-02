import { useMemo, useState } from 'react'
import { trpc } from '@/providers/trpc'

/* ---------- types mirroring api/lot-analysis.ts ---------- */
interface SunSample {
  time: string
  altitude: number
  azimuth: number
  up: boolean
}
interface DaySun {
  label: string
  date: string
  sunrise: string | null
  sunset: string | null
  daylightHours: number
  visibleHours: number
  path: SunSample[]
}
interface LotAnalysis {
  elevation: {
    minM: number
    maxM: number
    centroidM: number
    grid: { lats: number[]; lngs: number[]; z: number[][]; polygonMask: boolean[][] }
  }
  slope: {
    avgPct: number
    maxPct: number
    reliefM: number
    cutFillM3: number
    rating: 'gentle' | 'moderate' | 'steep'
    summary: string
  }
  sun: {
    summer: DaySun
    equinox: DaySun
    winter: DaySun
    sunsetBearingSummer: number
    sunsetBearingWinter: number
  }
  horizon: { azimuth: number; elevationAngle: number }[]
}

const M_TO_FT = 3.28084

function bearingToCompass(az: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(az / 22.5) % 16]
}

const RATING_STYLE: Record<string, { color: string; label: string }> = {
  gentle: { color: '#1a6b3a', label: 'Gentle — standard pad' },
  moderate: { color: '#8a5a00', label: 'Moderate — some grading' },
  steep: { color: '#8a1a1a', label: 'Steep — significant grading' },
}

/* ---------- sun arc (SVG) ---------- */
function SunArc({ day }: { day: DaySun }) {
  const W = 520
  const H = 190
  const PAD = 28

  const pts = day.path
  if (!pts.length) return null

  const azMin = Math.min(...pts.map((p) => p.azimuth))
  const azMax = Math.max(...pts.map((p) => p.azimuth))
  const altMax = Math.max(...pts.map((p) => p.altitude), 10)

  const x = (az: number) => PAD + ((az - azMin) / Math.max(azMax - azMin, 1)) * (W - PAD * 2)
  const y = (alt: number) => H - PAD - (alt / altMax) * (H - PAD * 2)

  const pathUp = pts.filter((p) => p.up)
  const pathDown = pts.filter((p) => !p.up)
  const line = (arr: SunSample[]) =>
    arr.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.azimuth).toFixed(1)},${y(p.altitude).toFixed(1)}`).join(' ')

  const rise = pts[0]
  const set = pts[pts.length - 1]
  const noon = pts.reduce((a, b) => (a.altitude > b.altitude ? a : b))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* horizon */}
      <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* grid altitudes */}
      {[15, 30, 45, 60].map((a) =>
        a < altMax ? (
          <g key={a}>
            <line x1={PAD} y1={y(a)} x2={W - PAD} y2={y(a)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={6} y={y(a) + 4} fill="rgba(255,255,255,0.35)" fontSize="9">
              {a}°
            </text>
          </g>
        ) : null
      )}
      {/* sun path */}
      {pathUp.length > 1 && (
        <path d={line(pathUp)} fill="none" stroke="#f2b04a" strokeWidth="2.5" />
      )}
      {pathDown.length > 1 && (
        <path d={line(pathDown)} fill="none" stroke="rgba(242,176,74,0.35)" strokeWidth="2" strokeDasharray="3 4" />
      )}
      {/* markers */}
      {[
        { p: rise, label: day.sunrise, anchor: 'start' as const },
        { p: noon, label: 'Solar noon', anchor: 'middle' as const },
        { p: set, label: day.sunset, anchor: 'end' as const },
      ].map(({ p, label, anchor }, i) => (
        <g key={i}>
          <circle cx={x(p.azimuth)} cy={y(p.altitude)} r={i === 1 ? 6 : 4.5} fill="#f2b04a" />
          <text
            x={x(p.azimuth)}
            y={i === 1 ? y(p.altitude) - 12 : y(0) + 16}
            fill="rgba(255,255,255,0.75)"
            fontSize="10"
            textAnchor={anchor}
          >
            {i === 1 ? bearingToCompass(p.azimuth) : label}
          </text>
        </g>
      ))}
      {/* azimuth labels under horizon */}
      {[rise.azimuth, noon.azimuth, set.azimuth].map((az, i) => (
        <text key={i} x={x(az)} y={y(0) + 30} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">
          {bearingToCompass(az)} {Math.round(az)}°
        </text>
      ))}
    </svg>
  )
}

/* ---------- slope cross-section (SVG) ---------- */
function SlopeProfileViz({ a }: { a: LotAnalysis }) {
  const W = 520
  const H = 120
  const PAD = 20

  const { grid } = a.elevation
  const { lats, lngs, z, polygonMask } = grid

  // find the row with the most in-lot cells = widest cross-section
  let bestRow = 0
  let bestCount = 0
  for (let r = 0; r < lats.length; r++) {
    const c = polygonMask[r].filter(Boolean).length
    if (c > bestCount) {
      bestCount = c
      bestRow = r
    }
  }
  const cells: { x: number; z: number }[] = []
  for (let c = 0; c < lngs.length; c++) {
    if (polygonMask[bestRow][c]) cells.push({ x: c, z: z[bestRow][c] })
  }
  if (cells.length < 2) return null

  const zMin = Math.min(...cells.map((c) => c.z))
  const zMax = Math.max(...cells.map((c) => c.z))
  const range = Math.max(zMax - zMin, 0.5)

  const px = (i: number) => PAD + (i / (cells.length - 1)) * (W - PAD * 2)
  const py = (zz: number) => H - PAD - ((zz - zMin) / range) * (H - PAD * 2)

  const dLine = cells.map((c, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(c.z).toFixed(1)}`).join(' ')
  const dArea = `${dLine} L${px(cells.length - 1)},${H - 6} L${px(0)},${H - 6} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={dArea} fill="rgba(242,176,74,0.12)" />
      <path d={dLine} fill="none" stroke="#f2b04a" strokeWidth="2" />
      <text x={PAD} y={py(zMax) - 6} fill="rgba(255,255,255,0.7)" fontSize="10">
        high {(zMax * M_TO_FT).toFixed(0)} ft
      </text>
      <text x={W - PAD} y={py(zMin) + 16} fill="rgba(255,255,255,0.7)" fontSize="10" textAnchor="end">
        low {(zMin * M_TO_FT).toFixed(0)} ft
      </text>
      <text x={W / 2} y={H - 2} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">
        ground cross-section across the lot
      </text>
    </svg>
  )
}

/* ---------- main panel ---------- */
export default function LotSunTerrain({ lotName }: { lotName: string }) {
  const q = trpc.lots.analysis.useQuery(
    { lotName },
    { staleTime: 24 * 3600 * 1000, retry: 1 }
  )
  const [season, setSeason] = useState<'summer' | 'equinox' | 'winter'>('summer')

  const a = q.data as LotAnalysis | undefined
  const day = useMemo(() => (a ? a.sun[season] : null), [a, season])

  return (
    <div
      style={{
        marginTop: '64px',
        paddingTop: '32px',
        borderTop: '1px solid #1a1a1a',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: '#000000',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        Sun & Terrain
      </p>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '28px', maxWidth: '560px', lineHeight: 1.6 }}>
        Sunlight and ground slope estimated from elevation data at this lot's exact
        boundaries — a first look at where the sun lands and how much site work to expect.
      </p>

      {q.isLoading && (
        <p style={{ fontSize: '13px', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Analyzing terrain…
        </p>
      )}
      {q.isError && (
        <p style={{ fontSize: '13px', color: '#999' }}>
          Terrain analysis is unavailable for this lot right now.
        </p>
      )}

      {a && day && (
        <div
          style={{
            backgroundColor: '#0b0b0b',
            padding: 'clamp(20px, 3vw, 36px)',
            display: 'grid',
            gap: '36px',
          }}
        >
          {/* season switch */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(
              [
                ['summer', 'Summer'],
                ['equinox', 'Spring / Fall'],
                ['winter', 'Winter'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSeason(key)}
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '10px 20px',
                  border: season === key ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.25)',
                  backgroundColor: season === key ? 'rgba(242,176,74,0.12)' : 'transparent',
                  color: season === key ? '#f2b04a' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* big numbers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
              gap: '24px',
            }}
          >
            {[
              { label: 'Direct sun', value: `${day.visibleHours} hrs` },
              { label: 'Daylight', value: `${day.daylightHours} hrs` },
              { label: 'Sunrise', value: day.sunrise ?? '—' },
              {
                label: 'Sun sets toward',
                value: `${bearingToCompass(day.path.length ? day.path[day.path.length - 1].azimuth : 270)} · ${Math.round(
                  day.path.length ? day.path[day.path.length - 1].azimuth : 270
                )}°`,
              },
            ].map((s) => (
              <div key={s.label}>
                <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', color: '#ffffff', fontWeight: 400, letterSpacing: '-0.02em' }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <SunArc day={day} />

          {/* terrain */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.14)', paddingTop: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                Ground & grading
              </p>
              <span
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  border: `1px solid ${RATING_STYLE[a.slope.rating].color}`,
                  color: RATING_STYLE[a.slope.rating].color,
                }}
              >
                {RATING_STYLE[a.slope.rating].label}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
                gap: '20px',
                marginBottom: '20px',
              }}
            >
              {[
                { label: 'Rise across lot', value: `${(a.slope.reliefM * M_TO_FT).toFixed(1)} ft` },
                { label: 'Average grade', value: `${a.slope.avgPct.toFixed(1)}%` },
                { label: 'Steepest spot', value: `${a.slope.maxPct.toFixed(0)}%` },
                {
                  label: 'Est. earthwork',
                  value: `${Math.round(a.slope.cutFillM3 * 1.30795).toLocaleString()} yd³`,
                },
              ].map((s) => (
                <div key={s.label}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: 'clamp(18px, 2vw, 26px)', color: '#ffffff', fontWeight: 400 }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <SlopeProfileViz a={a} />

            <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', marginTop: '18px', maxWidth: '640px' }}>
              {a.slope.summary}
            </p>
          </div>

          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            Estimates from USGS/SRTM elevation data (≈10 m sample grid) and standard solar
            geometry. Tree and building shade aren't modeled; earthwork is a planning
            estimate, not a bid — confirm with a site survey and your builder.
          </p>
        </div>
      )}
    </div>
  )
}
