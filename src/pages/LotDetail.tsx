import { useEffect, useMemo, useState } from 'react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import LotMap, {
  useStadiumLots,
  statusPinColor,
  type StadiumLotFeature,
  type StadiumStatus,
} from '../components/LotMap'
import LotSunTerrain from '../components/LotSunTerrain'
import LotVisualizer from '../components/lotVisualizer/LotVisualizer'

interface LotDetailProps {
  lotName: string
  onBack: () => void
}

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL
  const appID = import.meta.env.VITE_APP_ID
  const redirectUri = `${window.location.origin}/api/oauth/callback`
  const state = btoa(redirectUri)

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`)
  url.searchParams.set('client_id', appID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'profile')
  url.searchParams.set('state', state)

  return url.toString()
}

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

function fmtPrice(price: number | null): string {
  return price ? `$${price.toLocaleString()}` : 'Contact for pricing'
}

export default function LotDetail({ lotName, onBack }: LotDetailProps) {
  const features = useStadiumLots()
  const [hovered, setHovered] = useState(false)
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sent'>('idle')
  const { user, isLoading: authLoading } = useAuth()

  const lot = useMemo(
    () => features?.find((f) => f.properties.name === lotName) ?? null,
    [features, lotName]
  )

  const center = useMemo(() => (lot ? centroid(lot) : null), [lot])

  // neighboring lot polygons for 3D context (how this lot sits among others)
  const neighbors = useMemo(() => {
    if (!features || !center || !lot) return []
    const NEAR_DEG = 0.004 // ~400 m
    return features
      .filter((f) => {
        if (f.properties.name === lotName || !f.geometry) return false
        const c = centroid(f)
        return (
          c &&
          Math.abs(c.lat - center.lat) < NEAR_DEG &&
          Math.abs(c.lng - center.lng) < NEAR_DEG
        )
      })
      .map((f) => f.geometry!.coordinates[0])
  }, [features, lot, lotName, center])

  const createInquiry = trpc.inquiry.create.useMutation({
    onSuccess: () => setInquiryStatus('sent'),
  })

  const handleInquire = () => {
    if (!lot) return
    const title = `Lot ${lot.properties.name}, ${lot.properties.phase} — Stadium Subdivision No. 2`
    if (!user) {
      sessionStorage.setItem('pending_inquiry_lot_name', lot.properties.name)
      sessionStorage.setItem('pending_inquiry_lot_title', title)
      window.location.href = getOAuthUrl()
      return
    }
    createInquiry.mutate({
      fullName: user.name || '',
      email: user.email || '',
      interest: 'Lot Inquiry',
      lotId: lot.properties.name,
      lotTitle: title,
    })
  }

  useEffect(() => {
    const pendingName = sessionStorage.getItem('pending_inquiry_lot_name')
    const pendingTitle = sessionStorage.getItem('pending_inquiry_lot_title')
    if (pendingName && pendingTitle && user && lotName === pendingName) {
      sessionStorage.removeItem('pending_inquiry_lot_name')
      sessionStorage.removeItem('pending_inquiry_lot_title')
      createInquiry.mutate({
        fullName: user.name || '',
        email: user.email || '',
        interest: 'Lot Inquiry',
        lotId: pendingName,
        lotTitle: pendingTitle,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lotName])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [lotName])

  if (features && !lot) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          color: '#000000',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <p style={{ fontSize: '20px' }}>Lot not found.</p>
        <button
          onClick={onBack}
          style={{
            fontSize: '13px',
            letterSpacing: '0.14em',
            padding: '14px 32px',
            border: '1px solid #000',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          ← Back to map
        </button>
      </div>
    )
  }

  if (!lot) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0b0b',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
        }}
      >
        Loading lot…
      </div>
    )
  }

  const p = lot.properties
  const statusColor = statusPinColor(p.status as StadiumStatus)
  const highlights = [
    ...(p.acreage ? [`${p.acreage}-acre homesite`] : []),
    ...(p.facing ? [`Faces ${p.facing}`] : []),
    ...p.features,
    'Bring your own builder',
    'Middleton School District',
  ]
  // de-dup while preserving order
  const uniqueHighlights = highlights.filter((h, i) => highlights.indexOf(h) === i)

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* Header band */}
      <div
        style={{
          backgroundColor: '#0b0b0b',
          color: '#ffffff',
          padding: 'clamp(120px, 16vh, 160px) clamp(24px, 4vw, 60px) clamp(40px, 6vw, 64px)',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <button
            onClick={onBack}
            style={{
              fontSize: '12px',
              letterSpacing: '0.16em',
              padding: '12px 24px',
              border: '1px solid #ffffff',
              backgroundColor: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: '"Helvetica Neue", sans-serif',
              marginBottom: '40px',
            }}
          >
            ← Back to map
          </button>
          <p
            style={{
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              opacity: 0.7,
              marginBottom: '12px',
            }}
          >
            Stadium Subdivision No. 2 · {p.phase} · Lot {p.name}
          </p>
          <h1
            style={{
              fontSize: 'clamp(40px, 6vw, 84px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
              margin: 0,
            }}
          >
            Lot {p.name}
          </h1>
        </div>
      </div>

      {/* Map */}
      {center && (
        <div style={{ borderBottom: '1px solid #000000' }}>
          <LotMap
            height="clamp(360px, 55vh, 560px)"
            center={center}
            zoom={17}
            interactive={false}
            filterLot={(f) => f.properties.name === p.name}
          />
        </div>
      )}

      {/* 3D visualizer — only for lots that can be built on */}
      {center && lot.geometry && p.status === 'Available' && (
        <LotVisualizer
          lotName={p.name}
          center={center}
          polygon={lot.geometry.coordinates[0]}
          facing={p.facing}
          neighbors={neighbors}
        />
      )}

      {/* Body */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '80px clamp(24px, 4vw, 60px) 120px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'flex-start',
        }}
      >
        {/* Left */}
        <div style={{ flex: '2 1 600px', minWidth: 0 }}>
          <p
            style={{
              fontSize: 'clamp(20px, 2.2vw, 30px)',
              fontWeight: 400,
              lineHeight: 1.4,
              letterSpacing: '-0.015em',
              color: '#000000',
              marginBottom: '48px',
              maxWidth: '680px',
            }}
          >
            {p.acreage
              ? `A ${p.acreage}-acre homesite in The Stadium's ${p.phase}, ready for your custom build.`
              : `A homesite in The Stadium's ${p.phase}, ready for your custom build.`}
          </p>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.8,
              color: '#333333',
              marginBottom: '24px',
              maxWidth: '680px',
            }}
          >
            Every lot in The Stadium comes with paved streets, power at the lot
            line, and room for the things city lots can't hold — a detached
            shop, RV parking, a real backyard. Bring your own builder, or
            choose from plans already being built in the community.
          </p>

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
                marginBottom: '28px',
              }}
            >
              Lot Highlights
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '14px 40px',
              }}
            >
              {uniqueHighlights.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: '#333333',
                    paddingLeft: '20px',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '12px',
                      width: '8px',
                      height: '1px',
                      backgroundColor: '#000000',
                    }}
                  />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <LotSunTerrain lotName={p.name} />
        </div>

        {/* Right: panel */}
        <aside
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            position: 'sticky',
            top: '112px',
            border: '1px solid #000000',
            padding: '32px 28px',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#666666',
                margin: 0,
              }}
            >
              List price
            </p>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#ffffff',
                backgroundColor: statusColor,
                padding: '5px 10px',
              }}
            >
              {p.grooveStatus}
            </span>
          </div>
          <p
            style={{
              fontSize: 'clamp(36px, 4vw, 52px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#000000',
              marginBottom: '6px',
            }}
          >
            {p.status === 'Available' ? fmtPrice(p.price) : p.grooveStatus}
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#666666',
              lineHeight: 1.5,
              marginBottom: '28px',
            }}
          >
            {p.status === 'Available' ? 'vacant land, bring your own builder' : 'contact us about similar lots'}
          </p>

          <dl
            style={{
              borderTop: '1px solid #e5e5e5',
              borderBottom: '1px solid #e5e5e5',
              padding: '16px 0',
              margin: 0,
              display: 'grid',
              gap: '10px',
            }}
          >
            <Row k="Lot" v={p.name} />
            <Row k="Phase" v={p.phase} />
            {p.acreage && <Row k="Size" v={`${p.acreage} acres`} />}
            {p.facing && <Row k="Facing" v={p.facing} />}
            <Row k="Schools" v="Middleton SD" />
          </dl>

          <div style={{ height: '28px' }} />

          {inquiryStatus === 'sent' ? (
            <div
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#1a6b3a',
                backgroundColor: '#e8f5e9',
                border: '1px solid #1a6b3a',
                textAlign: 'center',
              }}
            >
              Inquiry submitted. Our sales team will contact you shortly.
            </div>
          ) : p.status === 'Sold' ? (
            <div
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#666666',
                backgroundColor: '#f4f4f5',
                border: '1px solid #e5e5e5',
                textAlign: 'center',
              }}
            >
              This lot has sold. Ask us about similar homesites.
            </div>
          ) : (
            <button
              onClick={handleInquire}
              disabled={createInquiry.isPending || authLoading}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                width: '100%',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.16em',
                color: hovered ? '#ffffff' : '#000000',
                backgroundColor: hovered ? '#000000' : '#ffffff',
                border: '1px solid #000000',
                padding: '16px 24px',
                cursor: createInquiry.isPending || authLoading ? 'wait' : 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.25s ease',
                fontFamily: '"Helvetica Neue", sans-serif',
                opacity: createInquiry.isPending || authLoading ? 0.6 : 1,
              }}
            >
              {createInquiry.isPending ? 'Submitting...' : 'Inquire About This Lot'}
            </button>
          )}
          <button
            onClick={onBack}
            style={{
              width: '100%',
              marginTop: '14px',
              fontSize: '12px',
              letterSpacing: '0.14em',
              color: '#666666',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: '"Helvetica Neue", sans-serif',
            }}
          >
            ← Back to all lots
          </button>
        </aside>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        fontSize: '13px',
        color: '#333333',
      }}
    >
      <dt style={{ color: '#666666', flexShrink: 0 }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 500, color: '#000000', textAlign: 'right' }}>{v}</dd>
    </div>
  )
}
