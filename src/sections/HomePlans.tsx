import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { homePlans, type HomePlan } from '../data/plans'

gsap.registerPlugin(ScrollTrigger)

export default function HomePlans() {
  const sectionRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<HomePlan | null>(null)
  const [view, setView] = useState<'elevation' | 'floorplan'>('elevation')

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.from('.plan-item', {
        y: 60,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          once: true,
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected])

  return (
    <section
      id="plans"
      ref={sectionRef}
      style={{
        backgroundColor: '#ffffff',
        padding: 'clamp(100px, 12vw, 160px) clamp(20px, 4vw, 60px)',
      }}
    >
      <div style={{ maxWidth: '1560px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '60px',
            borderBottom: '1px solid #1a1a1a',
            paddingBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#000000',
            }}
          >
            Home Plans
          </h2>
          <span
            style={{
              fontSize: '12px',
              letterSpacing: '0.18em',
              color: '#666666',
              textTransform: 'uppercase',
            }}
          >
            From our builders
          </span>
        </div>

        <p
          style={{
            fontSize: 'clamp(15px, 1.2vw, 18px)',
            fontWeight: 300,
            lineHeight: 1.6,
            color: '#444444',
            maxWidth: '720px',
            marginBottom: '56px',
          }}
        >
          Every plan below comes from a builder already working in the
          community — each designed for an acreage lot, with oversized
          garages and RV bays as standard. Pick one as-is, or use it as a
          starting point for your own custom build.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: '2px',
          }}
        >
          {homePlans.map((plan) => (
            <button
              key={plan.id}
              className="plan-item"
              onClick={() => {
                setSelected(plan)
                setView('elevation')
              }}
              style={{
                border: '1px solid #000000',
                backgroundColor: '#ffffff',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'block',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '56.25%',
                  overflow: 'hidden',
                  backgroundColor: '#e5e5e5',
                }}
              >
                <img
                  src={plan.elevationImg}
                  alt={plan.name}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
              <div
                style={{
                  padding: '20px 24px',
                  borderTop: '1px solid #000000',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      color: '#666666',
                      textTransform: 'uppercase',
                      marginBottom: '6px',
                    }}
                  >
                    {plan.builder} · {plan.livingArea}
                  </p>
                  <p
                    style={{
                      fontSize: '18px',
                      fontWeight: 500,
                      color: '#000000',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                    }}
                  >
                    {plan.name}
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#555555',
                      marginTop: '4px',
                      lineHeight: 1.35,
                    }}
                  >
                    {plan.subtitle}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.14em',
                    color: '#000000',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Plan modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.72)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(12px, 3vw, 48px)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              width: '100%',
              maxWidth: '1080px',
              maxHeight: '92vh',
              overflowY: 'auto',
              border: '1px solid #000000',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 28px',
                borderBottom: '1px solid #000000',
                position: 'sticky',
                top: 0,
                backgroundColor: '#ffffff',
                zIndex: 2,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    color: '#666666',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  {selected.builder}
                </p>
                <p
                  style={{
                    fontSize: '22px',
                    fontWeight: 500,
                    color: '#000000',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {selected.name}
                </p>
                <p style={{ fontSize: '13px', color: '#555555', marginTop: '4px' }}>
                  {selected.subtitle}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.14em',
                  padding: '10px 20px',
                  border: '1px solid #000000',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}
              >
                Close ✕
              </button>
            </div>

            {/* View toggle */}
            <div
              style={{
                display: 'flex',
                gap: '2px',
                padding: '16px 28px 0',
              }}
            >
              {(['elevation', 'floorplan'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.16em',
                    padding: '10px 22px',
                    border: '1px solid #000000',
                    backgroundColor: view === v ? '#000000' : 'transparent',
                    color: view === v ? '#ffffff' : '#000000',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontFamily: 'inherit',
                  }}
                >
                  {v === 'elevation' ? 'Exterior' : 'Floor Plan'}
                </button>
              ))}
            </div>

            {/* Image */}
            <div style={{ padding: '16px 28px' }}>
              <img
                src={view === 'elevation' ? selected.elevationImg : selected.floorplanImg}
                alt={`${selected.name} ${view}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>

            {/* Specs */}
            <div
              style={{
                padding: '8px 28px 32px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: '32px',
              }}
            >
              <dl
                style={{
                  display: 'grid',
                  gap: '10px',
                  margin: 0,
                  alignContent: 'start',
                }}
              >
                <Spec k="Living area" v={selected.livingArea} />
                <Spec k="Bedrooms" v={selected.beds} />
                <Spec k="Bathrooms" v={selected.baths} />
                <Spec k="Garage" v={selected.garage} />
                {selected.porches.map((p, i) => (
                  <Spec key={p} k={i === 0 ? 'Porches' : ''} v={p} />
                ))}
                <dt style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#888', marginTop: 8 }}>
                  Construction PDF
                </dt>
                <dd style={{ margin: 0 }}>
                  <a
                    href={selected.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 14, color: '#000', textDecoration: 'underline' }}
                  >
                    Open full plan set →
                  </a>
                </dd>
              </dl>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: '12px',
                  alignContent: 'start',
                }}
              >
                {selected.highlights.map((h) => (
                  <li
                    key={h}
                    style={{
                      fontSize: '14px',
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
                        top: '11px',
                        width: '8px',
                        height: '1px',
                        backgroundColor: '#000000',
                      }}
                    />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        fontSize: '13px',
        borderBottom: '1px solid #e5e5e5',
        paddingBottom: '8px',
      }}
    >
      <dt style={{ color: '#666666', flexShrink: 0 }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 500, color: '#000000', textAlign: 'right' }}>{v}</dd>
    </div>
  )
}
