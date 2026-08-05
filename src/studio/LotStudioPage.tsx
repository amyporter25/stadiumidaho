import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import StudioCanvas, { type StudioMode } from './StudioCanvas'
import { resolveLotName, resolveWorldMode, STUDIO_WORLD } from './config'
import { useHouseCutout } from './useHouseCutout'
import { useStadiumLots, type StadiumLotFeature } from '../components/LotMap'

function centroid(feature: StadiumLotFeature): { lat: number; lng: number } | null {
  if (feature.properties.label) {
    return { lng: feature.properties.label[0], lat: feature.properties.label[1] }
  }
  if (!feature.geometry) return null
  const ring = feature.geometry.coordinates[0]
  let lat = 0
  let lng = 0
  for (const [x, y] of ring) {
    lng += x
    lat += y
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

/**
 * Track B — Lot Studio (lot-first).
 * Aerial photo + plat lines + house photo placement. The splat experiment is
 * demoted to ?world=splat because it does not read as a sellable lot.
 */
export default function LotStudioPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const worldMode = useMemo(() => resolveWorldMode(location.search), [location.search])
  const lotName = useMemo(() => resolveLotName(location.search), [location.search])

  const features = useStadiumLots()
  const lot = useMemo(
    () => features?.find((f) => f.properties.name === lotName) ?? null,
    [features, lotName]
  )

  const neighbors = useMemo(() => {
    if (!features || !lot) return []
    const c = centroid(lot)
    if (!c) return []
    const NEAR = 0.004
    return features.filter((f) => {
      if (f.properties.name === lotName || !f.geometry) return false
      const n = centroid(f)
      return n && Math.abs(n.lat - c.lat) < NEAR && Math.abs(n.lng - c.lng) < NEAR
    })
  }, [features, lot, lotName])

  const lotOptions = useMemo(() => {
    if (!features) return []
    return [...features]
      .filter((f) => f.geometry)
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name, undefined, { numeric: true }))
  }, [features])

  const [mode, setMode] = useState<StudioMode>('look')
  const [status, setStatus] = useState('Starting…')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [widthFt, setWidthFt] = useState(STUDIO_WORLD.defaultHouseWidthFt)
  const [yawDeg, setYawDeg] = useState(0)

  const cutout = useHouseCutout()

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      await cutout.processFile(file)
      setMode('place')
    },
    [cutout]
  )

  const selectLot = (name: string) => {
    const q = new URLSearchParams(location.search)
    q.set('lot', name)
    q.delete('world')
    navigate({ pathname: '/studio', search: q.toString() })
    cutout.clear()
    setMode('look')
    setLoadError(null)
  }

  if (worldMode === 'splat') {
    return (
      <div style={shell}>
        <header style={topBar}>
          <div>
            <div style={eyebrow}>Track B · experiment</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Polycam splat (not the default)</div>
          </div>
          <button type="button" style={linkBtn} onClick={() => selectLot(lotName)}>
            ← Back to lot view
          </button>
        </header>
        <div style={{ padding: 48, maxWidth: 520, lineHeight: 1.5, opacity: 0.9 }}>
          <p>
            The site-wide Gaussian splat reads as a blotchy blob in the browser — not a
            usable lot. Lot Studio now defaults to aerial photo + plat lines instead.
          </p>
          <p style={{ opacity: 0.7, fontSize: 14 }}>
            If you still want to inspect the raw capture:{' '}
            <a href={STUDIO_WORLD.polycamUrl} target="_blank" rel="noreferrer" style={{ color: '#c4a574' }}>
              open it on Polycam
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      {lot ? (
        <StudioCanvas
          lot={lot}
          neighbors={neighbors}
          mode={mode}
          houseImageUrl={cutout.objectUrl}
          houseWidthFt={widthFt}
          houseYawDeg={yawDeg}
          onStatus={setStatus}
          onLoadError={setLoadError}
        />
      ) : (
        <div style={{ padding: 48 }}>Loading lots…</div>
      )}

      <header style={topBar}>
        <div style={{ pointerEvents: 'auto' }}>
          <div style={eyebrow}>Track B · Lot Studio</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
            {lot
              ? `Lot ${lot.properties.name}${lot.properties.acreage ? ` · ${lot.properties.acreage} acres` : ''}`
              : STUDIO_WORLD.label}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
          <label style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 8, alignItems: 'center' }}>
            Lot
            <select
              value={lotName}
              onChange={(e) => selectLot(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.35)',
                color: '#f4f1ea',
                border: '1px solid rgba(244,241,234,0.25)',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              {lotOptions.map((f) => (
                <option key={f.properties.name} value={f.properties.name}>
                  {f.properties.name}
                  {f.properties.acreage ? ` (${f.properties.acreage} ac)` : ''}
                </option>
              ))}
            </select>
          </label>
          <Link to="/" style={linkBtn}>
            ← Marketing site
          </Link>
        </div>
      </header>

      <div style={dock}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: 'look', label: 'Look around' },
            { id: 'place', label: 'Move house', disabled: !cutout.objectUrl },
          ]}
        />

        <label
          style={{
            cursor: cutout.status === 'loading' ? 'wait' : 'pointer',
            padding: '8px 14px',
            borderRadius: 999,
            background: '#c4a574',
            color: '#1a1410',
            fontSize: 13,
            fontWeight: 600,
            opacity: cutout.status === 'loading' ? 0.7 : 1,
          }}
        >
          {cutout.status === 'loading' ? 'Cutting out…' : 'Upload house photo'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={cutout.status === 'loading'}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {cutout.objectUrl && (
          <>
            <Slider
              label={`Width ${widthFt} ft`}
              min={20}
              max={90}
              value={widthFt}
              onChange={setWidthFt}
            />
            <Slider
              label={`Turn ${yawDeg}°`}
              min={-180}
              max={180}
              value={yawDeg}
              onChange={setYawDeg}
            />
          </>
        )}
      </div>

      <div style={statusBox}>
        {loadError ? <span style={{ color: '#8b2e2e' }}>{loadError}</span> : status}
        {cutout.error && <div style={{ color: '#6b4e16', marginTop: 4 }}>{cutout.error}</div>}
        <div style={{ marginTop: 6, opacity: 0.65, fontSize: 11 }}>
          Aerial · plat outline · photo placement (approximate — not a survey)
        </div>
      </div>
    </div>
  )
}

const shell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#b8c7d4',
  color: '#1a1c1e',
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  overflow: 'hidden',
}

const topBar: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 18px',
  background: 'linear-gradient(to bottom, rgba(255,255,255,0.72), transparent)',
  pointerEvents: 'none',
  zIndex: 2,
  color: '#1a1c1e',
}

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  opacity: 0.55,
}

const linkBtn: CSSProperties = {
  color: '#1a1c1e',
  textDecoration: 'none',
  fontSize: 13,
  opacity: 0.85,
  borderBottom: '1px solid rgba(26,28,30,0.35)',
  background: 'none',
  border: 'none',
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: 'rgba(26,28,30,0.35)',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}

const dock: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 22,
  transform: 'translateX(-50%)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: 'min(920px, calc(100% - 24px))',
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(26,28,30,0.1)',
  zIndex: 2,
  color: '#1a1c1e',
}

const statusBox: CSSProperties = {
  position: 'absolute',
  left: 18,
  bottom: 100,
  maxWidth: 380,
  fontSize: 12,
  lineHeight: 1.4,
  zIndex: 2,
  color: '#1a1c1e',
  textShadow: '0 1px 0 rgba(255,255,255,0.5)',
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: StudioMode
  onChange: (m: StudioMode) => void
  options: { id: StudioMode; label: string; disabled?: boolean }[]
}) {
  return (
    <div
      style={{
        display: 'flex',
        padding: 3,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.06)',
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          style={{
            padding: '7px 12px',
            borderRadius: 999,
            border: 'none',
            cursor: o.disabled ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: value === o.id ? '#1a1c1e' : 'transparent',
            color: value === o.id ? '#f4f1ea' : 'rgba(26,28,30,0.7)',
            opacity: o.disabled ? 0.4 : 1,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 120 }}
      />
    </label>
  )
}
