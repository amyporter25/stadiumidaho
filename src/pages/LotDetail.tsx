import { useEffect, useState } from 'react'
import { lots, type Lot } from '../data/lots'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import LotMap from '../components/LotMap'

interface LotDetailProps {
  lotId: string
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

function statusColors(status: Lot['status']): { fg: string; bg: string; border: string } {
  switch (status) {
    case 'Available':
      return { fg: '#1a6b3a', bg: '#e8f5e9', border: '#1a6b3a' }
    case 'Under Contract':
      return { fg: '#8a5a00', bg: '#fdf3e0', border: '#8a5a00' }
    case 'Sold':
      return { fg: '#8a1a1a', bg: '#fbeaea', border: '#8a1a1a' }
    case 'Coming Soon':
      return { fg: '#1a4a8a', bg: '#e8f0fb', border: '#1a4a8a' }
  }
}

export default function LotDetail({ lotId, onBack }: LotDetailProps) {
  const lot = lots.find((l) => l.id === lotId)
  const [hovered, setHovered] = useState(false)
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sent'>('idle')
  const { user, isLoading: authLoading } = useAuth()

  const createInquiry = trpc.inquiry.create.useMutation({
    onSuccess: () => {
      setInquiryStatus('sent')
    },
  })

  const handleInquire = () => {
    if (!lot) return
    if (!user) {
      // Store intended inquiry in sessionStorage, redirect to login
      sessionStorage.setItem('pending_inquiry_lot_id', lot.id)
      sessionStorage.setItem('pending_inquiry_lot_title', lot.title)
      window.location.href = getOAuthUrl()
      return
    }
    createInquiry.mutate({
      fullName: user.name || '',
      email: user.email || '',
      interest: 'Lot Inquiry',
      lotId: lot.id,
      lotTitle: lot.title,
    })
  }

  // Check for pending inquiry after OAuth redirect
  useEffect(() => {
    const pendingLotId = sessionStorage.getItem('pending_inquiry_lot_id')
    const pendingLotTitle = sessionStorage.getItem('pending_inquiry_lot_title')
    if (pendingLotId && pendingLotTitle && user && lotId === pendingLotId) {
      sessionStorage.removeItem('pending_inquiry_lot_id')
      sessionStorage.removeItem('pending_inquiry_lot_title')
      createInquiry.mutate({
        fullName: user.name || '',
        email: user.email || '',
        interest: 'Lot Inquiry',
        lotId: pendingLotId,
        lotTitle: pendingLotTitle,
      })
    }
  }, [user, lotId])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [lotId])

  if (!lot) {
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
          ← Back to lots
        </button>
      </div>
    )
  }

  const status = statusColors(lot.status)

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* Hero image */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(400px, 70vh, 720px)',
          overflow: 'hidden',
          backgroundColor: '#0b0b0b',
        }}
      >
        <img
          src={lot.img}
          alt={lot.title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 'clamp(100px, 14vh, 140px)',
            left: 'clamp(24px, 4vw, 60px)',
            fontSize: '12px',
            letterSpacing: '0.16em',
            padding: '12px 24px',
            border: '1px solid #ffffff',
            backgroundColor: 'rgba(0,0,0,0.35)',
            color: '#ffffff',
            cursor: 'pointer',
            textTransform: 'uppercase',
            fontFamily: '"Helvetica Neue", sans-serif',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          ← Back
        </button>
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(32px, 5vw, 60px)',
            left: 'clamp(24px, 4vw, 60px)',
            right: 'clamp(24px, 4vw, 60px)',
            color: '#ffffff',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              opacity: 0.8,
              marginBottom: '12px',
            }}
          >
            Lot {lot.id} · {lot.phase} · {lot.type}
          </p>
          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 80px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
              margin: 0,
              maxWidth: '900px',
            }}
          >
            {lot.title}
          </h1>
        </div>
      </div>

      {/* Satellite lot view */}
      {lot.coordinates && (
        <div style={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000' }}>
          <LotMap
            lots={[lot]}
            center={lot.coordinates}
            zoom={17}
            height="clamp(320px, 50vh, 520px)"
          />
        </div>
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
        {/* Left: description + features */}
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
            {lot.tagline}
          </p>

          {lot.description.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize: '16px',
                lineHeight: 1.8,
                color: '#333333',
                marginBottom: '24px',
                maxWidth: '680px',
              }}
            >
              {p}
            </p>
          ))}

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
              {lot.features.map((f) => (
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
        </div>

        {/* Right: pricing panel */}
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
              {lot.status === 'Sold' ? 'Last list price' : 'List price'}
            </p>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: status.fg,
                backgroundColor: status.bg,
                border: `1px solid ${status.border}`,
                padding: '5px 10px',
              }}
            >
              {lot.status}
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
            {lot.price}
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#666666',
              lineHeight: 1.5,
              marginBottom: '28px',
            }}
          >
            {lot.priceNote}
          </p>

          <dl
            style={{
              borderTop: '1px solid #e5e5e5',
              borderBottom: lot.home ? 'none' : '1px solid #e5e5e5',
              padding: '16px 0',
              margin: 0,
              display: 'grid',
              gap: '10px',
            }}
          >
            <Row k="Lot size" v={lot.lotSize} />
            <Row k="Dimensions" v={lot.dimensions} />
            <Row k="Zoning" v={lot.zoning} />
            <Row k="Utilities" v={lot.utilities} />
            <Row k="HOA dues" v={lot.hoa} />
          </dl>

          {lot.home && (
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
              <Row k="Bedrooms" v={lot.home.beds} />
              <Row k="Bathrooms" v={lot.home.baths} />
              <Row k="Living area" v={lot.home.livingArea} />
              <Row k="Builder" v={lot.home.builder} />
            </dl>
          )}

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
          ) : lot.status === 'Sold' ? (
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
              {createInquiry.isPending
                ? 'Submitting...'
                : lot.status === 'Coming Soon'
                  ? 'Join the Interest List'
                  : 'Inquire About This Lot'}
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
