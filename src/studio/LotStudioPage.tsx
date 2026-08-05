import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import StudioCanvas, { type StudioMode } from './StudioCanvas'
import { resolveSplatUrl, STUDIO_WORLD } from './config'
import { useHouseCutout } from './useHouseCutout'

/**
 * Track B — Lot Studio.
 * Isolated full-viewport experience: real site splat + photo house placement.
 * Not wired into the marketing lot pages yet on purpose.
 */
export default function LotStudioPage() {
  const location = useLocation()
  const splatUrl = useMemo(() => resolveSplatUrl(location.search), [location.search])

  const [mode, setMode] = useState<StudioMode>('look')
  const [status, setStatus] = useState('Starting…')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [widthFt, setWidthFt] = useState(STUDIO_WORLD.defaultHouseWidthFt)
  const [yawDeg, setYawDeg] = useState(0)
  /**
   * Rough scale bridge: the current stadium.ksplat is a normalized site capture
   * (~a few units across). Tunable until we geo-align Stadium 3D TWO.
   */
  const [unitsPerFoot, setUnitsPerFoot] = useState(0.012)
  const [groundY, setGroundY] = useState(STUDIO_WORLD.groundY)
  const [showAlign, setShowAlign] = useState(false)

  const cutout = useHouseCutout()

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      await cutout.processFile(file)
      setMode('place')
    },
    [cutout]
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#121416',
        color: '#f4f1ea',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <StudioCanvas
        splatUrl={splatUrl}
        mode={mode}
        houseImageUrl={cutout.objectUrl}
        houseWidthFt={widthFt}
        houseYawDeg={yawDeg}
        unitsPerFoot={unitsPerFoot}
        groundY={groundY}
        onStatus={setStatus}
        onLoadError={setLoadError}
      />

      {/* Top bar */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 18px',
          background: 'linear-gradient(to bottom, rgba(10,12,14,0.72), transparent)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            Track B · Lot Studio
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
            {STUDIO_WORLD.label}
          </div>
        </div>
        <Link
          to="/"
          style={{
            pointerEvents: 'auto',
            color: '#f4f1ea',
            textDecoration: 'none',
            fontSize: 13,
            opacity: 0.85,
            borderBottom: '1px solid rgba(244,241,234,0.35)',
          }}
        >
          ← Marketing site
        </Link>
      </header>

      {/* Mode + upload */}
      <div
        style={{
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
          background: 'rgba(18,20,22,0.78)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(244,241,234,0.12)',
          zIndex: 2,
        }}
      >
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

        <button
          type="button"
          onClick={() => setShowAlign((v) => !v)}
          style={ghostBtn}
        >
          {showAlign ? 'Hide align' : 'Align'}
        </button>
      </div>

      {showAlign && (
        <aside
          style={{
            position: 'absolute',
            right: 16,
            top: 72,
            width: 260,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(18,20,22,0.88)',
            border: '1px solid rgba(244,241,234,0.12)',
            zIndex: 2,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Alignment (temporary)</div>
          <p style={{ opacity: 0.75, margin: '0 0 10px' }}>
            Until Stadium 3D TWO is geo-aligned, nudge scale and ground so the
            cutout sits on the dirt.
          </p>
          <Slider
            label={`Scale ${unitsPerFoot.toFixed(3)} u/ft`}
            min={0.004}
            max={0.04}
            step={0.001}
            value={unitsPerFoot}
            onChange={setUnitsPerFoot}
          />
          <Slider
            label={`Ground Y ${groundY.toFixed(2)}`}
            min={-2}
            max={1}
            step={0.01}
            value={groundY}
            onChange={setGroundY}
          />
          <a
            href={STUDIO_WORLD.polycamUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#c4a574', display: 'inline-block', marginTop: 8 }}
          >
            Open Polycam source →
          </a>
        </aside>
      )}

      <div
        style={{
          position: 'absolute',
          left: 18,
          bottom: 100,
          maxWidth: 360,
          fontSize: 12,
          lineHeight: 1.4,
          opacity: 0.85,
          zIndex: 2,
          textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        {loadError ? <span style={{ color: '#f0a8a0' }}>{loadError}</span> : status}
        {cutout.error && (
          <div style={{ color: '#f0d9a0', marginTop: 4 }}>{cutout.error}</div>
        )}
      </div>
    </div>
  )
}

const ghostBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(244,241,234,0.25)',
  background: 'transparent',
  color: '#f4f1ea',
  fontSize: 12,
  cursor: 'pointer',
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
        background: 'rgba(255,255,255,0.06)',
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
            background: value === o.id ? '#f4f1ea' : 'transparent',
            color: value === o.id ? '#121416' : 'rgba(244,241,234,0.75)',
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
      <span style={{ fontSize: 11, opacity: 0.75 }}>{label}</span>
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
