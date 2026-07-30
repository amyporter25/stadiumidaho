export default function Footer() {
  return (
    <footer
      id="footer"
      style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #000000',
        padding: '80px clamp(20px, 4vw, 60px) 0',
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      {/* Top: Office Info */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
          paddingBottom: '80px',
        }}
      >
        <OfficeColumn
          city="The Stadium"
          cityEn="NORTH CALDWELL, ID"
          address="West of Wagner Rd, north of Goodson Rd, Caldwell, ID 83607"
          coords="43.7658° N, 116.7378° W"
          timezone="Middleton School District"
        />
        <OfficeColumn
          city="Phase 1"
          cityEn="NOW SELLING"
          address="Vacant homesites and new custom builds on Iron Horse Dr, Commerce Comet Way, Triple Crown Pl & Pins Triple Ct"
          coords="Lots from 1.0 to 2+ acres"
          timezone="Homes from $1.15M"
        />
        <OfficeColumn
          city="Phase 2"
          cityEn="COMING SOON"
          address="Stadium Subdivision No. 2 — 60+ homesites off Moscow Way & Goodson Rd"
          coords="0.35 to 3.27 acres"
          timezone="Interest list open now"
        />
        <div>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.18em',
              color: '#000000',
              marginBottom: '20px',
            }}
          >
            CONTACT
          </p>
          <p style={{ fontSize: '14px', color: '#666666', lineHeight: 2 }}>
            info@thestadiumidaho.com
            <br />
            +1 (208) 555-0123
            <br />
            LandVest Idaho
          </p>
        </div>
      </div>

      {/* Bottom: Giant Wordmark */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          lineHeight: 0.85,
          paddingBottom: '0',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'clamp(80px, 18vw, 320px)',
            fontWeight: 400,
            letterSpacing: '-0.04em',
            color: '#000000',
            whiteSpace: 'nowrap',
            transform: 'translateY(15%)',
            userSelect: 'none',
          }}
        >
          THE STADIUM
        </span>
      </div>
    </footer>
  )
}

function OfficeColumn({
  city,
  cityEn,
  address,
  coords,
  timezone,
}: {
  city: string
  cityEn: string
  address: string
  coords: string
  timezone: string
}) {
  return (
    <div>
      <p
        style={{
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: '#000000',
          marginBottom: '20px',
        }}
      >
        {cityEn}
      </p>
      <p style={{ fontSize: '16px', fontWeight: 500, color: '#000000', marginBottom: '8px' }}>
        {city}
      </p>
      <p
        style={{
          fontSize: '14px',
          color: '#666666',
          lineHeight: 1.6,
          marginBottom: '12px',
          maxWidth: '260px',
        }}
      >
        {address}
      </p>
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.05em',
          color: '#666666',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {coords}
        <br />
        {timezone}
      </p>
    </div>
  )
}
