import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LotMap from '../components/LotMap'
import { lots } from '../data/lots'

gsap.registerPlugin(ScrollTrigger)

interface MapExplorerProps {
  onSelectLot: (id: string) => void
}

export default function MapExplorer({ onSelectLot }: MapExplorerProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const head = headRef.current
    if (!section || !head) return

    const ctx = gsap.context(() => {
      gsap.from(head.children, {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          once: true,
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="map"
      ref={sectionRef}
      style={{
        backgroundColor: '#0b0b0b',
        padding: 'clamp(100px, 12vw, 160px) clamp(20px, 4vw, 60px)',
      }}
    >
      <div style={{ maxWidth: '1560px', margin: '0 auto' }}>
        <div
          ref={headRef}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '48px',
            borderBottom: '1px solid rgba(255,255,255,0.35)',
            paddingBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#ffffff',
            }}
          >
            Explore the Land
          </h2>
          <span
            style={{
              fontSize: '12px',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.6)',
              textTransform: 'uppercase',
            }}
          >
            Live satellite view · Click a lot
          </span>
        </div>

        <LotMap lots={lots} onSelectLot={onSelectLot} height="clamp(420px, 65vh, 680px)" />

        <p
          style={{
            marginTop: '24px',
            fontSize: '13px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.55)',
            maxWidth: '640px',
          }}
        >
          Lot positions shown are illustrative. Surveyed lot boundaries will
          appear here once final plat data is published. Select any lot marker
          to view its full details.
        </p>
      </div>
    </section>
  )
}
