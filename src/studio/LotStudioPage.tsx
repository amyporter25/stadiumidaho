import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import StudioCanvas, { type StudioMode } from './StudioCanvas'
import { resolveLotName, resolveWorldMode, STUDIO_WORLD } from './config'
import { useHouseCutout } from './useHouseCutout'
import { useStadiumLots, type StadiumLotFeature } from '../components/LotMap'
import { studioPlans, type HomePlan } from '../data/plans'
import {
  formatUsd,
  PLANT_LABELS,
  type DrivewayEstimate,
  type DrivewayMaterial,
  type PlantKind,
} from './costs'

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
 * Aerial + plat + builder GLB + driveway estimate + landscaping.
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
  const [planId, setPlanId] = useState<string | null>(null)
  const [widthFt, setWidthFt] = useState(STUDIO_WORLD.defaultHouseWidthFt)
  const [yawDeg, setYawDeg] = useState(0)
  const [driveway, setDriveway] = useState<DrivewayEstimate | null>(null)
  const [drivewayMaterial, setDrivewayMaterial] = useState<DrivewayMaterial>('concrete')
  const [plantKind, setPlantKind] = useState<PlantKind>('tree')
  const [landscapeUsd, setLandscapeUsd] = useState(0)
  const [landscapeCount, setLandscapeCount] = useState(0)
  const [landscapeRevision, setLandscapeRevision] = useState(0)

  const cutout = useHouseCutout()
  const houseActive = Boolean(planId || cutout.objectUrl)
  const activePlan = studioPlans.find((p) => p.id === planId) ?? null

  const selectPlan = useCallback((plan: HomePlan) => {
    cutout.clear()
    setPlanId(plan.id)
    setWidthFt(plan.footprintFt.width)
    setMode('place')
    setLoadError(null)
  }, [cutout])

  const clearHouse = useCallback(() => {
    cutout.clear()
    setPlanId(null)
    setMode('look')
    setWidthFt(STUDIO_WORLD.defaultHouseWidthFt)
    setYawDeg(0)
    setDriveway(null)
  }, [cutout])

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setPlanId(null)
      await cutout.processFile(file)
      setWidthFt(STUDIO_WORLD.defaultHouseWidthFt)
      setMode('place')
    },
    [cutout]
  )

  const selectLot = (name: string) => {
    const q = new URLSearchParams(location.search)
    q.set('lot', name)
    q.delete('world')
    navigate({ pathname: '/studio', search: q.toString() })
    clearHouse()
    setLandscapeRevision((n) => n + 1)
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
        </div>
      </div>
    )
  }

  const siteExtras = (driveway?.costUsd ?? 0) + landscapeUsd

  return (
    <div style={shell}>
      {lot ? (
        <StudioCanvas
          lot={lot}
          neighbors={neighbors}
          mode={mode}
          planId={planId}
          houseImageUrl={planId ? null : cutout.objectUrl}
          houseWidthFt={widthFt}
          houseYawDeg={yawDeg}
          plantKind={plantKind}
          drivewayMaterial={drivewayMaterial}
          landscapeRevision={landscapeRevision}
          onStatus={setStatus}
          onLoadError={setLoadError}
          onDrivewayChange={setDriveway}
          onLandscapeCostChange={(usd, count) => {
            setLandscapeUsd(usd)
            setLandscapeCount(count)
          }}
          onYawSuggest={setYawDeg}
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
          {activePlan && (
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
              {activePlan.name} · {activePlan.subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
          <label style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 8, alignItems: 'center' }}>
            Lot
            <select
              value={lotName}
              onChange={(e) => selectLot(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.65)',
                color: '#1a1c1e',
                border: '1px solid rgba(26,28,30,0.2)',
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
          <Link to="/studio/earth" style={linkBtn}>
            Neighborhood map
          </Link>
          <Link to="/" style={linkBtn}>
            ← Marketing site
          </Link>
        </div>
      </header>

      <aside style={planRail} aria-label="Builder plans">
        <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 8 }}>
          Builder plans
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {studioPlans.map((plan) => {
            const selected = planId === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => selectPlan(plan)}
                style={{
                  ...planCard,
                  outline: selected ? '2px solid #1a1c1e' : '1px solid rgba(26,28,30,0.12)',
                  background: selected ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.88)',
                }}
              >
                <img
                  src={plan.elevationImg}
                  alt=""
                  style={{
                    width: '100%',
                    height: 108,
                    objectFit: 'cover',
                    objectPosition: 'center 58%',
                    display: 'block',
                    background: '#d5e0ea',
                  }}
                />
                <div style={{ padding: '8px 10px', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{plan.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{plan.subtitle}</div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {(driveway || landscapeCount > 0) && (
        <aside style={costCard} aria-live="polite">
          <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.55 }}>
            Site extras (est.)
          </div>
          {driveway && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>
                Driveway · {Math.round(driveway.lengthFt)} ft
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                {Math.round(driveway.areaSqFt)} sq ft {driveway.material} · {formatUsd(driveway.costUsd)}
              </div>
            </div>
          )}
          {landscapeCount > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>
                Landscaping · {landscapeCount} items
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                {formatUsd(landscapeUsd)}
              </div>
            </div>
          )}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(26,28,30,0.12)' }}>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Extras total</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{formatUsd(siteExtras)}</div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, lineHeight: 1.35 }}>
              Ballpark only — confirm with builder. Does not include home price or lot.
            </div>
          </div>
        </aside>
      )}

      <div style={dock}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: 'look', label: 'Look around' },
            { id: 'place', label: 'Move house', disabled: !houseActive },
            { id: 'plant', label: 'Landscaping' },
          ]}
        />

        {mode === 'plant' && (
          <>
            {(Object.keys(PLANT_LABELS) as PlantKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPlantKind(k)}
                style={{
                  ...chipBtn,
                  background: plantKind === k ? '#1a1c1e' : 'transparent',
                  color: plantKind === k ? '#f4f1ea' : '#1a1c1e',
                }}
              >
                {PLANT_LABELS[k]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLandscapeRevision((n) => n + 1)}
              style={ghostBtn}
              disabled={landscapeCount === 0}
            >
              Clear plants
            </button>
          </>
        )}

        {houseActive && mode !== 'plant' && (
          <>
            <Slider
              label={`Width ${widthFt} ft`}
              min={40}
              max={120}
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
            <label style={{ fontSize: 11, opacity: 0.75, display: 'flex', gap: 6, alignItems: 'center' }}>
              Driveway
              <select
                value={drivewayMaterial}
                onChange={(e) => setDrivewayMaterial(e.target.value as DrivewayMaterial)}
                style={{
                  fontSize: 12,
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: '1px solid rgba(26,28,30,0.2)',
                  background: '#fff',
                }}
              >
                <option value="concrete">Concrete</option>
                <option value="asphalt">Asphalt</option>
              </select>
            </label>
            <button type="button" onClick={clearHouse} style={ghostBtn}>
              Clear house
            </button>
          </>
        )}

        <label
          style={{
            cursor: cutout.status === 'loading' ? 'wait' : 'pointer',
            padding: '8px 14px',
            borderRadius: 999,
            background: 'transparent',
            color: '#1a1c1e',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid rgba(26,28,30,0.25)',
            opacity: cutout.status === 'loading' ? 0.7 : 1,
          }}
        >
          {cutout.status === 'loading' ? 'Cutting out…' : 'Upload your photo'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={cutout.status === 'loading'}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <div style={statusBox}>
        {loadError ? <span style={{ color: '#8b2e2e' }}>{loadError}</span> : status}
        {cutout.error && <div style={{ color: '#6b4e16', marginTop: 4 }}>{cutout.error}</div>}
        <div style={{ marginTop: 6, opacity: 0.65, fontSize: 11 }}>
          Builder home GLB · driveway · landscaping · estimates only
        </div>
      </div>
    </div>
  )
}

const shell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#6ea8e0',
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
  background: 'none',
  border: 'none',
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: 'rgba(26,28,30,0.35)',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}

const planRail: CSSProperties = {
  position: 'absolute',
  top: 88,
  right: 16,
  width: 200,
  maxHeight: 'calc(100vh - 220px)',
  overflowY: 'auto',
  zIndex: 2,
  padding: 10,
  borderRadius: 14,
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(26,28,30,0.1)',
}

const costCard: CSSProperties = {
  position: 'absolute',
  top: 88,
  left: 16,
  width: 220,
  zIndex: 2,
  padding: 12,
  borderRadius: 14,
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(26,28,30,0.1)',
}

const planCard: CSSProperties = {
  padding: 0,
  borderRadius: 10,
  overflow: 'hidden',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'inherit',
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
  maxWidth: 'min(980px, calc(100% - 24px))',
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(26,28,30,0.1)',
  zIndex: 2,
  color: '#1a1c1e',
}

const ghostBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(26,28,30,0.2)',
  background: 'transparent',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#1a1c1e',
}

const chipBtn: CSSProperties = {
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid rgba(26,28,30,0.2)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
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
